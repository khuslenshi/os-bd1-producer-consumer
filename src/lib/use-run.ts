"use client"

import { useEffect, useRef, useState } from "react"
import { toQuery, validate, type RunConfig } from "@/lib/config"
import type { CoreEvent } from "@/lib/model"

export type Status = "idle" | "running" | "stopped" | "done" | "error"

export const STATUS_TEXT: Record<Status, string> = {
  idle: "Бэлэн", running: "Ажиллаж байна", stopped: "Зогсоосон", done: "Дууссан", error: "Алдаа",
}

// Index of the last event logged at or before time t (-1 if none).
export function lastAt(events: CoreEvent[], t: number) {
  let lo = 0
  let hi = events.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].t <= t) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

// One streamed run of the C core through /api/run. Leaving the page aborts it, which kills the process.
export function useRun() {
  const [events, setEvents] = useState<CoreEvent[]>([])
  const [status, setStatus] = useState<Status>("idle")
  const [errors, setErrors] = useState<string[]>([])
  const run = useRef<AbortController | null>(null)

  useEffect(() => () => run.current?.abort(), [])

  // Resolves with every event once the run ends, or null when the config is invalid or the run failed.
  async function start(c: RunConfig): Promise<CoreEvent[] | null> {
    const problems = validate(c)
    setErrors(problems)
    if (problems.length) return null
    run.current?.abort()
    const ac = new AbortController()
    run.current = ac
    setEvents([])
    setStatus("running")

    const buf: CoreEvent[] = []
    let frame = 0
    const flush = () => {
      frame = 0
      if (run.current === ac) setEvents(buf.slice())
    }
    try {
      const res = await fetch(`/api/run?${toQuery(c)}`, { signal: ac.signal, cache: "no-store" })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        setErrors(body.errors ?? [`Сервер алдаа: HTTP ${res.status}`])
        setStatus("error")
        return null
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ""
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split("\n")
        rest = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const e: CoreEvent = JSON.parse(line)
          e.t ??= buf.at(-1)?.t ?? 0
          buf.push(e)
        }
        frame ||= requestAnimationFrame(flush)
      }
      cancelAnimationFrame(frame)
      flush()
      const closed = buf.at(-1)
      if (closed?.ev === "closed" && closed.code) {
        setErrors([closed.message ?? `Core алдаатай дууслаа (код ${closed.code})`])
        setStatus("error")
        return null
      }
      setStatus("done")
      return buf
    } catch (err) {
      if (run.current !== ac) return null
      cancelAnimationFrame(frame)
      flush()
      if ((err as Error).name === "AbortError") setStatus("stopped")
      else {
        setErrors([`Сервертэй холболт тасарлаа: ${(err as Error).message}`])
        setStatus("error")
      }
      return null
    }
  }

  function stop() {
    run.current?.abort()
  }

  function reset() {
    run.current?.abort()
    run.current = null
    setEvents([])
    setErrors([])
    setStatus("idle")
  }

  return { events, status, errors, start, stop, reset }
}
