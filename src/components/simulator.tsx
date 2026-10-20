"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, CircleHelpIcon, PlayIcon, RotateCcwIcon, SquareIcon, ZapIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { buildModel, type CoreEvent } from "@/lib/model"
import { eventSound, setSound, sfx } from "@/lib/sfx"
import { lastAt, STATUS_TEXT, useRun } from "@/lib/use-run"
import { cn } from "@/lib/utils"

const WINDOWS = [["2000", "2 с"], ["5000", "5 с"], ["0", "Бүгд"]] as const
// Screen time (ms at 0.25×) a put/take or a wait stays before the next event may show.
const dwell = (e: CoreEvent | undefined) => (e?.ev === "produce" || e?.ev === "consume" ? 600 : e?.ev === "wait_empty" || e?.ev === "wait_full" ? 400 : 0)
// ponytail: above this the run is a blur anyway (level 3); play it by time and let the race jump do the work
const MAX_BEAT_EVENTS = 600

export function Simulator({ level }: { level?: Level }) {
  const [config, setConfig] = useState<RunConfig>(level?.config ?? DEFAULT_CONFIG)
  const { events, status, errors, start: startRun, stop, reset: resetRun } = useRun()
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.25)
  const [windowMs, setWindowMs] = useState(2000)
  const [solved, setSolved] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [view, setView] = useState<View>("array")
  // Playback clock in core milliseconds. The core runs in real time; the screen follows at `speed`.
  const clock = useRef(0)
  const live = useRef({ events, running: false })

  const model = useMemo(() => buildModel(events), [events])
  const index = Math.max(0, Math.min(cursor, events.length - 1))
  const running = status === "running"
  // Too many events to follow by eye (level 3: ~10k in 1 s): play at the slowest speed and say why.
  const huge = events.length > MAX_BEAT_EVENTS
  const playSpeed = huge ? 0.1 : speed
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
  // A put/take/wait is held on screen for a beat (the clock pauses) and is never skipped, so events
  // the core logged in the same millisecond still show one after another. Huge runs play by time only.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let shown = { i: index, at: last }
    const tick = (now: number) => {
      const { events: ev, running: busy } = live.current
      const dt = now - last
      last = now
      const beats = ev.length <= MAX_BEAT_EVENTS
      if (!beats || now - shown.at >= dwell(ev[shown.i]) * (0.25 / playSpeed)) {
        clock.current += dt * playSpeed
        const end = ev.at(-1)?.t ?? 0
        if (clock.current >= end) {
          clock.current = end
          if (!busy && ev.length) {
            setCursor(ev.length - 1)
            setPlaying(false)
            return
          }
        }
        let next = Math.max(0, lastAt(ev, clock.current))
        if (beats)
          for (let i = shown.i + 1; i < next; i++)
            if (dwell(ev[i])) { next = i; clock.current = ev[i].t; break }
        if (next !== shown.i) {
          shown = { i: next, at: now }
          setCursor(next)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // index is read once when playback starts; afterwards the clock drives it
  }, [playing, playSpeed])

  // One short sound per playhead move (a race wins, else the last put/take/wait passed);
  // silent on backward or big seeks so fast runs do not turn into noise.
  const heard = useRef(0)
  useEffect(() => {
    const from = heard.current
    heard.current = index
    if (index <= from || index - from > 8) return
    const passed = events.slice(from + 1, index + 1)
    const race = passed.some((_, k) => model.races.has(from + 1 + k))
    eventSound(race ? undefined : passed.findLast((e) => e.ev !== "sleep")?.ev, race)
  }, [index, events, model])
  useEffect(() => {
    setSound(true)
    return () => setSound(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, [role=dialog]") || !events.length) return
      if (e.key === "ArrowRight" && level && finished) setQuizOpen(true)
      else if (e.key === "ArrowRight") seek(index + (e.shiftKey ? 10 : 1))
      else if (e.key === "ArrowLeft") seek(index - (e.shiftKey ? 10 : 1))
      else if (e.key === " " && !el.closest("button")) { e.preventDefault(); togglePlay() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const coreSeconds = ((events.at(-1)?.t ?? 0) / 1000).toFixed(1)
  const finished = status === "done" && !playing && index === events.length - 1
  // Level: the question pops up when the run has played to its end; closing it is fine, "Дараагийн алхам" brings it back.
  useEffect(() => { if (level && finished) setQuizOpen(true) }, [level, finished])

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
          {huge && (
            <div className="tactile mt-4 flex items-start gap-3 rounded-2xl border-wait-border bg-wait px-4 py-3 text-sm text-wait-foreground">
              <ZapIcon className="mt-0.5 size-5 shrink-0" />
              <p>
                <b>Хэт хурдан run: {coreSeconds} секундэд {events.length} event.</b>{" "}
                {(model.start?.producers ?? 0) + (model.start?.consumers ?? 0)} thread {model.start?.sleep_max} мс-ээс бага унтаад буферт бараг зэрэг ордог.
                Нүдээр хөөх боломжгүй тул тоглуулах хурдыг хамгийн удаанаар (0.1×) түгжив.{" "}
                {model.races.size > 0
                  ? <>Ийм үед л race condition гардаг: доорх улаан <b>Race</b> хэсгийн <b>Эхнийх</b>, <b>Дараагийнх</b> товчоор алдаануудыг нэг нэгээр нь үзээрэй.</>
                  : <>Event-үүдийг <b>Дараагийн алхам</b> товчоор нэг нэгээр нь гүйлгэж үзээрэй.</>}
              </p>
            </div>
          )}
          <Stage events={events} index={index} model={model} speed={playSpeed} onSeek={seek} view={view} />
        </div>

        {level && finished && (
          <section className="tactile mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-produce-edge bg-produce-soft p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold tracking-tight">{solved ? "Зөв хариуллаа!" : "Run дууслаа. Юу ажигласан бэ?"}</h2>
              <p className="text-[15px] text-muted-foreground">{solved ? "Дараагийн түвшин рүү орж болно." : "Асуултад хариулж түвшнээ дуусгана."}</p>
            </div>
            <Button size="lg" onClick={() => setQuizOpen(true)}>
              <CircleHelpIcon data-icon="inline-start" />
              {solved ? "Асуулт, дараагийн түвшин" : "Асуултад хариулах"}
            </Button>
          </section>
        )}
        {level && (
          <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
            <DialogContent className="gap-5 sm:max-w-xl sm:p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">Run дууслаа. Юу ажигласан бэ?</DialogTitle>
                <DialogDescription>Түвшин {level.id}: {level.title}</DialogDescription>
              </DialogHeader>
              <Quiz quiz={level.quiz} done={solved} onWrong={sfx.wrong} onCorrect={() => { sfx.right(); markDone(level.id); setSolved(true) }} />
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
            </DialogContent>
          </Dialog>
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
        speed={playSpeed}
        speedLocked={huge}
        onSpeed={setSpeed}
        onTogglePlay={togglePlay}
        onReplay={() => { clock.current = 0; setCursor(0); setPlaying(true) }}
        onSeek={seek}
        onEnd={level && finished ? () => setQuizOpen(true) : undefined}
      />
    </main>
  )
}
