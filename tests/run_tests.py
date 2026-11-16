#!/usr/bin/env python3
"""Automated tests for the C core. Run: python3 tests/run_tests.py   (after: cd src/core && make)
Prints a table (input -> expected -> actual) and writes tests/results.md for the report."""
import json, os, resource, signal, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PC = os.path.join(ROOT, "src", "core", "pc")


def run(args, timeout=30, limit=None):
    p = subprocess.run([PC] + [str(a) for a in args], capture_output=True, text=True, timeout=timeout, preexec_fn=limit)
    ev = []
    for l in p.stdout.splitlines():
        ev.append(json.loads(l))
    return p.returncode, ev, p.stderr


def check_log(ev):
    """Verify the log against the bounded-buffer rules. Returns list of problems."""
    bad = []
    if not ev or ev[0]["ev"] != "start" or ev[-1]["ev"] != "end":
        return ["start/end event missing"]
    n = ev[0]["buffer"]
    fifo, pc, cc = [], 0, 0
    for e in ev:
        if e["ev"] == "produce":
            if e["slot"] != pc % n: bad.append(f"t={e['t']} produce slot {e['slot']} != expected {pc % n}")
            fifo.append(e["item"]); pc += 1
        elif e["ev"] == "consume":
            if e["slot"] != cc % n: bad.append(f"t={e['t']} consume slot {e['slot']} != expected {cc % n}")
            if not fifo: bad.append(f"t={e['t']} consume from empty buffer")
            elif fifo.pop(0) != e["item"]: bad.append(f"t={e['t']} FIFO violated")
            cc += 1
        elif e["ev"] == "error":
            bad.append(f"t={e['t']} error event {e['role']}{e['id']}")
        if "count" in e and not 0 <= e["count"] <= n: bad.append(f"t={e['t']} count {e['count']} out of range")
        if "empty" in e and not 0 <= e["empty"] <= n: bad.append(f"t={e['t']} empty {e['empty']} out of range")
        if "full" in e and not 0 <= e["full"] <= n: bad.append(f"t={e['t']} full {e['full']} out of range")
    end = ev[-1]
    if end["produced"] - end["consumed"] != end["in_buffer"] or end["in_buffer"] != len(fifo) or not end["invariant_ok"]:
        bad.append(f"invariant: produced {end['produced']} - consumed {end['consumed']} != in_buffer {end['in_buffer']}")
    if not end.get("items_ok") or end.get("lost") or end.get("dup"):
        bad.append(f"item check: lost {end.get('lost')} dup {end.get('dup')}")
    return bad


def count(ev, name): return sum(1 for e in ev if e["ev"] == name)

results = []
def record(tid, desc, expected, actual, ok):
    results.append((tid, desc, expected, actual, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {tid:4} {desc:48} | {actual}")


def functional(tid, desc, args, expect, extra=None):
    rc, ev, err = run(args)
    bad = check_log(ev) if rc == 0 else [f"exit {rc}: {err.strip()}"]
    ok = not bad
    actual = f"produced={ev[-1]['produced']} consumed={ev[-1]['consumed']} left={ev[-1]['in_buffer']}" if ev else "no output"
    if ok and extra:
        msg = extra(ev)
        if msg: ok, actual = False, msg
        else: actual += f" waits(empty/full)={count(ev,'wait_empty')}/{count(ev,'wait_full')}"
    if bad: actual = "; ".join(bad[:2])
    record(tid, desc, expect, actual, ok)


def reject(tid, desc, args, expect_text):
    rc, ev, err = run(args)
    ok = rc != 0 and expect_text in err and not ev
    record(tid, desc, f"exit≠0 + '{expect_text}'", f"exit={rc} stderr='{err.splitlines()[0] if err else ''}'", ok)


print("== Үндсэн тест ==")
functional("T1", "1P+1C, 3s, buffer=5", [3, 1, 1, "--sleep-max", 200, "--seed", 1], "invariant, FIFO, slot order OK")
functional("T2", "3P+1C: буфер дүүрч producer хүлээх", [3, 3, 1, "--sleep-max", 100, "--seed", 2], "wait_empty > 0",
           lambda ev: None if count(ev, "wait_empty") > 0 else "wait_empty байхгүй")
functional("T3", "1P+4C: буфер хоосорч consumer хүлээх", [3, 1, 4, "--sleep-max", 100, "--seed", 3], "wait_full > 0",
           lambda ev: None if count(ev, "wait_full") > 0 else "wait_full байхгүй")
functional("T4", "Invariant produced-consumed=in_buffer, 5s", [5, 4, 3, "--sleep-max", 50, "--seed", 4], "produced−consumed = left")

print("== Нэмэлт / boundary ==")
functional("B1", "buffer=1 (хамгийн хатуу)", [3, 2, 2, "--buffer", 1, "--sleep-max", 50, "--seed", 5], "slot үргэлж 0, invariant OK")
functional("B2", "sleep=0 (хамгийн их contention)", [1, 4, 4, "--sleep-max", 0, "--seed", 6], "invariant, FIFO OK")
functional("B3", "100P+100C (хэт олон thread)", [3, 100, 100, "--sleep-max", 20, "--seed", 7], "invariant OK")
functional("B4", "buffer=64 (дээд хязгаар)", [3, 3, 1, "--buffer", 64, "--sleep-max", 20, "--seed", 8], "invariant OK")
functional("B5", "0 consumer: буфер дүүрээд producer гацна", [2, 2, 0, "--sleep-max", 20], "left=buffer, wait_empty>0",
           lambda ev: None if ev[-1]["in_buffer"] == 5 and count(ev, "wait_empty") > 0 else "буфер дүүрээгүй")
functional("B6", "0 producer: consumer хүлээнэ", [2, 0, 2, "--sleep-max", 20], "produced=0, wait_full>0",
           lambda ev: None if ev[-1]["produced"] == 0 and count(ev, "wait_full") > 0 else "буруу")

print("== Алдааны тест ==")
reject("E1", "аргумент дутуу", [3, 1], "3 үндсэн аргумент")
reject("E2", "сөрөг хугацаа", [-3, 1, 1], "хооронд байх ёстой")
reject("E3", "тоо биш producer", [3, "abc", 1], "бүхэл тоо")
reject("E4", "buffer=0", [3, 1, 1, "--buffer", 0], "buffer")
reject("E5", "producer=201", [3, 201, 1], "хооронд байх ёстой")
reject("E6", "үл мэдэгдэх сонголт", [3, 1, 1, "--foo", 1], "үл мэдэгдэх")
reject("E7", "--buffer утгагүй", [3, 1, 1, "--buffer"], "утга дутуу")

if sys.platform.startswith("linux"):  # RLIMIT_AS is not enforced on macOS
    def small_memory(): resource.setrlimit(resource.RLIMIT_AS, (300 << 20, 300 << 20))
    rc, ev, err = run([1, 200, 200, "--sleep-max", 10], limit=small_memory)
    ok = rc != 0 and "thread үүсгэж чадсангүй" in err and not any(e["ev"] == "end" for e in ev)
    record("E8", "pthread_create алдаа (300 MB санах ой, 400 thread)", "exit≠0 + тайлбар, үүссэнийг join",
           f"exit={rc} stderr='{err.strip()[:70]}'", ok)

print("== Stop (SIGTERM) ==")
t = time.time()
p = subprocess.Popen([PC, "60", "2", "2"], stdout=subprocess.PIPE, text=True)
time.sleep(1.0); p.send_signal(signal.SIGTERM)
out = p.stdout.read(); rc = p.wait(timeout=5); dt = time.time() - t
ev = [json.loads(l) for l in out.splitlines()]
ok = rc == 0 and dt < 4 and ev and ev[-1]["ev"] == "end" and not check_log(ev)
record("S1", "SIGTERM: 60s ажиллагааг 1с-д зогсоох", "хурдан зогсож end event гаргана", f"exit={rc} {dt:.1f}s end={'yes' if ev and ev[-1]['ev']=='end' else 'no'}", ok)

print("== Race илрүүлэлт (--no-mutex) ==")
runs, inv, items = 8, 0, 0
for i in range(runs):
    rc, ev, _ = run([1, 8, 8, "--sleep-max", 1, "--no-mutex", "--seed", 10 + i])
    end = ev[-1] if ev else {}
    inv += not end.get("invariant_ok", True)
    items += not end.get("items_ok", True)
# Race is probabilistic: the item check (each produced item numbered) must catch it in at least one run.
record("R1", f"mutex-гүй 8P+8C, {runs} ажиллалт: item шалгалт", "≥1 ажиллалтад lost/dup > 0",
       f"item шалгалт {items}/{runs}, invariant {inv}/{runs} ажиллалтад зөрчил илрүүлсэн", items > 0)
races = items

fails = [r for r in results if not r[4]]
with open(os.path.join(ROOT, "tests", "results.md"), "w", encoding="utf-8") as f:
    f.write("| ID | Тест | Хүлээгдсэн | Бодит | Үр дүн |\n|---|---|---|---|---|\n")
    for tid, d, e, a, ok in results:
        f.write(f"| {tid} | {d} | {e} | {a} | {'PASS' if ok else 'FAIL'} |\n")
    f.write(f"\nno-mutex race: {runs} ажиллалтаас item шалгалт {items}-д, invariant {inv}-д зөрчил илрүүлсэн.\n")
print(f"\n{len(results) - len(fails)}/{len(results)} PASS  → tests/results.md")
sys.exit(1 if fails else 0)
