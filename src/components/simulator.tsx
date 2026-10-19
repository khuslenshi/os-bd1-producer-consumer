"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ConfigBar } from "@/components/config-bar"
import { Stage } from "@/components/stage"
import { Legend, Timeline } from "@/components/timeline"
import { Transport } from "@/components/transport"
import { DEFAULT_CONFIG, toQuery, validate, type RunConfig } from "@/lib/config"
import { buildModel, type CoreEvent } from "@/lib/model"
import { cn } from "@/lib/utils"

export type Status = "idle" | "running" | "stopped" | "done" | "error"

const STATUS_TEXT: Record<Status, string> = {
  idle: "Бэлэн", running: "Ажиллаж байна", stopped: "Зогсоосон", done: "Дууссан", error: "Алдаа",
}

export function Simulator() {
  const [config, setConfig] = useState<RunConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<Status>("idle")
  const [errors, setErrors] = useState<string[]>([])
  const [events, setEvents] = useState<CoreEvent[]>([])
  const [cursor, setCursor] = useState<number | null>(null) // null = follow the newest event
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const run = useRef<AbortController | null>(null)

  const model = useMemo(() => buildModel(events), [events])
  const index = Math.max(0, cursor ?? events.length - 1)
  const running = status === "running"

  async function start(c: RunConfig) {
    const problems = validate(c)
    setErrors(problems)
    if (problems.length) return
    run.current?.abort()
    const ac = new AbortController()
    run.current = ac
    setEvents([])
    setCursor(null)
    setPlaying(false)
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
        return
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
      } else setStatus("done")
    } catch (err) {
      if (run.current !== ac) return
      cancelAnimationFrame(frame)
      flush()
      if ((err as Error).name === "AbortError") setStatus("stopped")
      else {
        setErrors([`Сервертэй холболт тасарлаа: ${(err as Error).message}`])
        setStatus("error")
      }
    }
  }

  function reset() {
    run.current?.abort()
    run.current = null
    setEvents([])
    setCursor(null)
    setPlaying(false)
    setErrors([])
    setStatus("idle")
  }

  function seek(i: number) {
    setPlaying(false)
    setCursor(Math.min(Math.max(i, 0), events.length - 1))
  }

  function togglePlay() {
    if (running) return setCursor(cursor === null ? index : null)
    if (playing) return setPlaying(false)
    if (index >= events.length - 1) setCursor(0)
    setPlaying(true)
  }

  // Replay: a virtual clock walks the cursor through the recorded event times.
  useEffect(() => {
    if (!playing || !events.length) return
    let i = cursor ?? 0
    let vt = events[i].t
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      vt += (now - last) * speed
      last = now
      while (i < events.length - 1 && events[i + 1].t <= vt) i++
      setCursor(i)
      if (i >= events.length - 1) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // cursor is read once as the start point, not a dependency
  }, [playing, speed, events])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, [role=dialog]") || !events.length) return
      if (e.key === "ArrowRight") seek(index + (e.shiftKey ? 10 : 1))
      else if (e.key === "ArrowLeft") seek(index - (e.shiftKey ? 10 : 1))
      else if (e.key === " " && !el.closest("button")) { e.preventDefault(); togglePlay() }
      else return
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const seconds = ((events.at(-1)?.t ?? 0) / 1000).toFixed(1)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-8">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight">Producer–Consumer</h1>
        <p className="text-sm text-muted-foreground">Bounded buffer · pthreads + semaphore · thread бүрийн timeline</p>
        <Badge variant="outline" className="ml-auto gap-1.5 font-mono tabular-nums">
          <span className={cn("size-1.5 rounded-full bg-muted-foreground", running && "animate-pulse bg-produce", status === "error" && "bg-race")} />
          {STATUS_TEXT[status]}{events.length > 0 && ` · ${seconds} с`}
        </Badge>
      </header>

      <ConfigBar
        config={config}
        onChange={setConfig}
        running={running}
        errors={errors}
        onStart={start}
        onStop={() => run.current?.abort()}
        onReset={reset}
      />

      <Stage events={events} index={index} model={model} onSeek={seek} />

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
          <h2 className="text-sm font-semibold">Thread timeline</h2>
          <Legend />
          <span className="ml-auto text-[11px] text-muted-foreground">Дарж, чирж агшин сонгоно · ← → алхам · Space зогсоох</span>
        </div>
        <Timeline model={model} events={events} index={index} onSeek={seek} />
        <Transport
          events={events}
          index={index}
          model={model}
          running={running}
          live={cursor === null}
          playing={playing}
          speed={speed}
          onSpeed={setSpeed}
          onTogglePlay={togglePlay}
          onLive={() => setCursor(null)}
          onReplay={() => { setCursor(0); setPlaying(true) }}
          onSeek={seek}
        />
      </section>
    </main>
  )
}
