import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { coreArgs, fromQuery, validate } from "@/lib/config"

export const dynamic = "force-dynamic"

const CORE = path.join(process.cwd(), "src", "core", "pc")
// ponytail: soft cap so a 0 ms sleep run cannot flood the browser; core stops on SIGTERM and still prints "end"
const MAX_EVENTS = 20000
// next dev listens on the LAN too: bound how many cores can run at once
const MAX_RUNS = 4
let active = 0

export async function GET(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ errors: ["Өөр сайтаас ажиллуулахыг хориглосон"] }, { status: 403 })
  const config = fromQuery(new URL(req.url).searchParams)
  const errors = validate(config)
  if (errors.length) return Response.json({ errors }, { status: 400 })
  if (!existsSync(CORE))
    return Response.json({ errors: ["C core build хийгдээгүй байна: make -C src/core"] }, { status: 500 })
  if (active >= MAX_RUNS)
    return Response.json({ errors: [`Зэрэг ${MAX_RUNS}-өөс олон run ажиллуулах боломжгүй. Түр хүлээгээд дахин оролдоно уу.`] }, { status: 429 })

  active++
  const child = spawn(CORE, coreArgs(config))
  child.on("close", () => { active-- })
  const enc = new TextEncoder()
  let open = true
  const stop = () => { if (child.exitCode === null) child.kill("SIGTERM") }
  req.signal.addEventListener("abort", stop)

  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (line: string) => { if (open) ctrl.enqueue(enc.encode(line + "\n")) }
      let rest = ""
      let lines = 0
      let truncated = false
      child.stdout.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => {
        const parts = (rest + chunk).split("\n")
        rest = parts.pop() ?? ""
        for (const line of parts) if (line) send(line)
        lines += parts.length
        if (lines >= MAX_EVENTS && !truncated) { truncated = true; stop() }
      })
      let stderr = ""
      child.stderr.on("data", (c: Buffer) => { stderr += c })
      child.on("error", (err) => { stderr += err.message })
      child.on("close", (code) => {
        if (!open) return // client aborted: cancel() already closed the stream
        if (rest) send(rest)
        send(JSON.stringify({ ev: "closed", code, truncated, message: stderr.trim() || undefined }))
        open = false
        ctrl.close()
      })
    },
    cancel() { open = false; stop() },
  })

  return new Response(body, {
    // X-Accel-Buffering: nginx (and proxies that honour it) must pass each line on at once, not hold the run until it ends
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  })
}
