#!/usr/bin/env python3
"""Bridge: runs the C core as a subprocess and streams its JSON-line events to the browser (SSE).
Standard library only (Python 3.8+). Start:  python3 src/server/server.py [--port 8000]
"""
import argparse, json, mimetypes, os, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE = os.path.join(ROOT, "core", "pc")
UI_DIR = os.path.join(ROOT, "ui")

# name: (label, min, max, default)  -- must match limits in core/pc.c
LIMITS = {
    "duration":  ("Хугацаа (сек)", 1, 3600, 20),
    "producers": ("Producer-ийн тоо", 0, 200, 2),
    "consumers": ("Consumer-ийн тоо", 0, 200, 2),
    "buffer":    ("Буферийн хэмжээ", 1, 64, 5),
    "sleep_max": ("Унтах дээд хугацаа (мс)", 0, 10000, 1000),
    "seed":      ("Seed", 0, 2147483647, None),
}

cond = threading.Condition()
run = {"id": 0, "events": [], "done": True, "proc": None}


def validate(cfg):
    """Returns (clean_dict, errors[])."""
    clean, errors = {}, []
    for key, (label, lo, hi, default) in LIMITS.items():
        raw = cfg.get(key, default)
        if raw in (None, ""):
            if key == "seed":
                continue
            errors.append(f"{label}: утга дутуу")
            continue
        if isinstance(raw, bool) or not isinstance(raw, (int, str)) or (isinstance(raw, str) and not raw.strip().lstrip("-").isdigit()):
            errors.append(f"{label}: бүхэл тоо байх ёстой (өгсөн: {raw!r})")
            continue
        v = int(raw)
        if v < lo or v > hi:
            errors.append(f"{label}: {lo}..{hi} хооронд байх ёстой (өгсөн: {v})")
            continue
        clean[key] = v
    return clean, errors


def reader(proc, run_id):
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            ev = {"ev": "log", "message": line}
        with cond:
            if run["id"] != run_id:
                return
            run["events"].append(ev)
            cond.notify_all()
    code = proc.wait()
    err = proc.stderr.read().strip()
    with cond:
        if run["id"] != run_id:
            return
        if code != 0 and err:
            run["events"].append({"ev": "error_msg", "message": err})
        run["events"].append({"ev": "closed", "code": code})
        run["done"] = True
        cond.notify_all()


def start_run(cfg):
    clean, errors = validate(cfg)
    if errors:
        return 400, {"errors": errors}
    if not os.path.exists(CORE):
        return 500, {"errors": ["Core бүтээгдээгүй байна. Эхлээд: cd src/core && make"]}
    with cond:
        if not run["done"]:
            return 409, {"errors": ["Ажиллаж байна. Эхлээд Stop эсвэл Reset дарна уу."]}
        args = [CORE, str(clean["duration"]), str(clean["producers"]), str(clean["consumers"]),
                "--buffer", str(clean["buffer"]), "--sleep-max", str(clean["sleep_max"])]
        if "seed" in clean:
            args += ["--seed", str(clean["seed"])]
        if cfg.get("mutex") is False:
            args.append("--no-mutex")
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        run["id"] += 1
        run.update(events=[], done=False, proc=proc)
        rid = run["id"]
    threading.Thread(target=reader, args=(proc, rid), daemon=True).start()
    return 200, {"run": rid, "args": args[1:]}


def stop_run(clear=False):
    with cond:
        proc = run["proc"]
        if proc and not run["done"]:
            proc.terminate()
    if clear:
        # wait briefly for the process to finish, then drop the log
        for _ in range(100):
            with cond:
                if run["done"]:
                    break
            time.sleep(0.05)
        with cond:
            run["id"] += 1
            run.update(events=[], done=True, proc=None)
            cond.notify_all()
    return 200, {"ok": True}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/events":
            return self.sse(int(parse_qs(url.query).get("run", ["0"])[0]))
        if url.path == "/api/limits":
            return self.send_json(200, {k: {"label": v[0], "min": v[1], "max": v[2], "default": v[3]} for k, v in LIMITS.items()})
        name = "index.html" if url.path in ("/", "") else url.path.lstrip("/")
        path = os.path.abspath(os.path.join(UI_DIR, name))
        if not path.startswith(UI_DIR) or not os.path.isfile(path):
            return self.send_json(404, {"errors": ["Олдсонгүй"]})
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(path)[0] or "application/octet-stream") + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            cfg = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(cfg, dict):
                raise ValueError
        except ValueError:
            return self.send_json(400, {"errors": ["JSON буруу байна"]})
        path = urlparse(self.path).path
        if path == "/api/start":
            return self.send_json(*start_run(cfg))
        if path == "/api/stop":
            return self.send_json(*stop_run())
        if path == "/api/reset":
            return self.send_json(*stop_run(clear=True))
        self.send_json(404, {"errors": ["Олдсонгүй"]})

    def sse(self, run_id):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        idx = 0
        try:
            while True:
                with cond:
                    while run["id"] == run_id and idx >= len(run["events"]) and not run["done"]:
                        if not cond.wait(timeout=15):
                            break
                    if run["id"] != run_id:
                        return
                    batch = run["events"][idx:]
                    idx += len(batch)
                    finished = run["done"] and idx >= len(run["events"])
                if not batch:
                    self.wfile.write(b": keepalive\n\n")
                for ev in batch:
                    self.wfile.write(b"data: " + json.dumps(ev).encode() + b"\n\n")
                self.wfile.flush()
                if finished:
                    return
        except (BrokenPipeError, ConnectionResetError):
            return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    srv.daemon_threads = True
    print(f"Producer-Consumer UI: http://{a.host}:{a.port}  (Ctrl+C дарж зогсооно)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        stop_run()


if __name__ == "__main__":
    main()
