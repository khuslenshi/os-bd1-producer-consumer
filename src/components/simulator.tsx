"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, PlayIcon, RotateCcwIcon, SquareIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BackToMenu } from "@/components/back-to-menu"
import { EventLog } from "@/components/event-log"
import { Quiz } from "@/components/quiz"
import { SettingsDialog } from "@/components/settings-dialog"
import { Stage, type View } from "@/components/stage"
import { Legend, Timeline } from "@/components/timeline"
import { Transport } from "@/components/transport"
import { DEFAULT_CONFIG, validate, type RunConfig } from "@/lib/config"
import { LEVELS, markDone, type Level } from "@/lib/levels"
import { buildModel } from "@/lib/model"
import { lastAt, STATUS_TEXT, useRun } from "@/lib/use-run"
import { cn } from "@/lib/utils"

const WINDOWS = [["2000", "2 с"], ["5000", "5 с"], ["0", "Бүгд"]] as const

export function Simulator({ level }: { level?: Level }) {
  const [config, setConfig] = useState<RunConfig>(level?.config ?? DEFAULT_CONFIG)
  const { events, status, errors, start: startRun, stop, reset: resetRun } = useRun()
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.25)
  const [windowMs, setWindowMs] = useState(2000)
  const [solved, setSolved] = useState(false)
  const [view, setView] = useState<View>("array")
  // Playback clock in core milliseconds. The core runs in real time; the screen follows at `speed`.
  const clock = useRef(0)
  const live = useRef({ events, running: false })

  const model = useMemo(() => buildModel(events), [events])
  const index = Math.max(0, Math.min(cursor, events.length - 1))
  const running = status === "running"
  live.current = { events, running }
  const next = level && (LEVELS.find((l) => l.id === level.id + 1)?.id ?? null)

  async function start(c: RunConfig) {
    if (validate(c).length) return void startRun(c) // only shows the errors
    setCursor(0)
    clock.current = 0
    setPlaying(true)
    if (!(await startRun(c)) && live.current.events.length === 0) setPlaying(false)
  }

  function reset() {
    resetRun()
    setCursor(0)
    clock.current = 0
    setPlaying(false)
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
  const finished = status === "done" && !playing && index === events.length - 1

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 lg:px-8">
        <BackToMenu href={level ? "/levels" : "/"} label={level ? "Түвшингүүд" : "Цэс"} />
        <header className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex flex-col gap-2">
            {level && <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Түвшин {level.id}</span>}
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{level ? level.title : "Чөлөөт горим"}</h1>
            <p className="max-w-2xl text-[15px] text-muted-foreground">
              {level ? level.goal : "Bounded buffer: pthreads + semaphore + mutex. Бүх тохиргоог өөрөө сонгоод ажиллуул."}
            </p>
          </div>
          <span className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className={cn("size-2 rounded-full bg-sleep", running && "animate-pulse bg-now", status === "error" && "bg-race")} />
            {STATUS_TEXT[status]}{events.length > 0 && <span className="font-mono font-normal">· core {coreSeconds} с</span>}
          </span>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <SettingsDialog config={config} onChange={setConfig} view={view} onView={setView} running={running} locked={Boolean(level)} onStart={start} />
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="lg" onClick={reset}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
            {running ? (
              <Button variant="outline" size="lg" onClick={stop}>
                <SquareIcon data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button size="lg" onClick={() => start(config)}>
                <PlayIcon data-icon="inline-start" />
                Start
              </Button>
            )}
          </div>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive" className="tactile mt-4 rounded-xl border-race bg-race-soft">
            <AlertTitle>Ажиллуулж чадсангүй</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 border-t-2">
          <Stage events={events} index={index} model={model} speed={speed} onSeek={seek} view={view} />
        </div>

        {level && finished && (
          <section className="tactile mb-8 flex flex-col gap-4 rounded-2xl border-edge p-5 sm:p-6">
            <h2 className="text-xl font-bold tracking-tight">Run дууслаа. Юу ажигласан бэ?</h2>
            <Quiz quiz={level.quiz} onCorrect={() => { markDone(level.id); setSolved(true) }} />
            {solved && (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link href={next ? `/levels/${next}` : "/play"}>
                    {next ? `Түвшин ${next}` : "Чөлөөт горим"}
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/levels">Түвшингүүд</Link>
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="flex-1 border-t-2 bg-band">
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:px-8">
          <section className="overflow-hidden rounded-2xl border-2 bg-background">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 px-4 py-3">
              <h2 className="text-[15px] font-bold">Thread бүрийн timeline</h2>
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
          </section>
          <EventLog events={events} index={index} model={model} onSeek={seek} />
        </div>
      </div>

      <Transport
        count={events.length}
        index={index}
        t={events[index]?.t ?? 0}
        total={Math.max((model.start?.duration ?? 0) * 1000, events.at(-1)?.t ?? 0)}
        running={running}
        playing={playing}
        speed={speed}
        onSpeed={setSpeed}
        onTogglePlay={togglePlay}
        onReplay={() => { clock.current = 0; setCursor(0); setPlaying(true) }}
        onSeek={seek}
      />
    </main>
  )
}
