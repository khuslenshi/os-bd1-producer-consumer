"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ConfigBar } from "@/components/config-bar"
import { EventLog } from "@/components/event-log"
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

const WINDOWS = [["2000", "2 с"], ["5000", "5 с"], ["0", "Бүгд"]] as const

// Index of the last event logged at or before time t (-1 if none).
function lastAt(events: CoreEvent[], t: number) {
  let lo = 0
  let hi = events.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].t <= t) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

export function Simulator() {
  const [config, setConfig] = useState<RunConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<Status>("idle")
  const [errors, setErrors] = useState<string[]>([])
  const [events, setEvents] = useState<CoreEvent[]>([])
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.5)
  const [windowMs, setWindowMs] = useState(5000)
  const run = useRef<AbortController | null>(null)
  // Playback clock in core milliseconds. The core runs in real time; the screen follows at `speed`.
  const clock = useRef(0)
  const live = useRef({ events, running: false })

  const model = useMemo(() => buildModel(events), [events])
  const index = Math.max(0, Math.min(cursor, events.length - 1))
  const running = status === "running"
  live.current = { events, running }

  async function start(c: RunConfig) {
    const problems = validate(c)
    setErrors(problems)
    if (problems.length) return
    run.current?.abort()
    const ac = new AbortController()
    run.current = ac
    setEvents([])
    setCursor(0)
    clock.current = 0
    setPlaying(true)
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
        setPlaying(false)
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
    setCursor(0)
    clock.current = 0
    setPlaying(false)
    setErrors([])
    setStatus("idle")
  }

  function seek(i: number) {
    const j = Math.min(Math.max(i, 0), events.length - 1)
    setPlaying(false)
    setCursor(j)
    clock.current = events[j]?.t ?? 0
  }

  function togglePlay() {
    if (playing) return setPlaying(false)
    if (index >= events.length - 1 && !running) {
      setCursor(0)
      clock.current = 0
    } else clock.current = events[index]?.t ?? 0
    setPlaying(true)
  }

  // One clock for live runs and replays: advance by elapsed time × speed, wait for the core
  // when the screen catches up with it, stop at the last event once the run is over.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const { events: ev, running: busy } = live.current
      clock.current += (now - last) * speed
      last = now
      const end = ev.at(-1)?.t ?? 0
      if (clock.current >= end) {
        clock.current = end
        if (!busy && ev.length) {
          setCursor(ev.length - 1)
          setPlaying(false)
          return
        }
      }
      setCursor(Math.max(0, lastAt(ev, clock.current)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, [role=dialog]") || !events.length) return
      if (e.key === "ArrowRight") seek(index + (e.shiftKey ? 10 : 1))
      else if (e.key === "ArrowLeft") seek(index - (e.shiftKey ? 10 : 1))
      else if (e.key === " " && !el.closest("button")) { e.preventDefault(); togglePlay() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const coreSeconds = ((events.at(-1)?.t ?? 0) / 1000).toFixed(1)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-8">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight">Producer–Consumer</h1>
        <p className="text-sm text-muted-foreground">Bounded buffer · pthreads + semaphore · thread бүрийн timeline</p>
        <Badge variant="outline" className="ml-auto gap-1.5 font-mono tabular-nums">
          <span className={cn("size-1.5 rounded-full bg-muted-foreground", running && "animate-pulse bg-produce", status === "error" && "bg-race")} />
          {STATUS_TEXT[status]}{events.length > 0 && ` · core ${coreSeconds} с`}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Stage events={events} index={index} model={model} speed={speed} onSeek={seek} />

        <section className="overflow-hidden rounded-lg border bg-card xl:col-start-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
            <h2 className="text-sm font-semibold">Thread timeline</h2>
            <Legend />
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              className="ml-auto"
              value={String(windowMs)}
              onValueChange={(v) => v && setWindowMs(Number(v))}
              aria-label="Timeline-ий цонх"
            >
              {WINDOWS.map(([v, label]) => (
                <ToggleGroupItem key={v} value={v} className="px-2.5 text-xs">{label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Timeline model={model} events={events} index={index} windowMs={windowMs} onSeek={seek} />
          <Transport
            count={events.length}
            index={index}
            running={running}
            playing={playing}
            speed={speed}
            onSpeed={setSpeed}
            onTogglePlay={togglePlay}
            onReplay={() => { clock.current = 0; setCursor(0); setPlaying(true) }}
            onSeek={seek}
          />
        </section>

        <EventLog events={events} index={index} model={model} onSeek={seek} className="xl:col-start-2 xl:row-span-2 xl:row-start-1" />
      </div>
    </main>
  )
}
