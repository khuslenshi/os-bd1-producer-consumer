"use client"

import { memo, useEffect, useMemo, useState, type ReactNode, type Ref } from "react"
import type { CoreEvent, Lane, Model } from "@/lib/model"
import { cn } from "@/lib/utils"

const LABEL_W = "3.5rem"
// A mark gets its text chip only with this much free space (px) on both sides; otherwise a thin bar.
const GAP = 32
// ponytail: past this many events every mark is a bar, whatever the zoom
const DENSE = 600

interface View { t0: number; span: number; px: number }
const at = (t: number, v: View) => `${((t - v.t0) / v.span) * 100}%`

function Row({ label, children, className, trackRef }: {
  label: ReactNode
  children: ReactNode
  className?: string
  trackRef?: Ref<HTMLDivElement>
}) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b last:border-b-0">
      <div className="flex items-center pl-4 text-xs font-semibold">{label}</div>
      <div ref={trackRef} className={cn("relative h-8 overflow-hidden", className)}>{children}</div>
    </div>
  )
}

function Axis({ view }: { view: View }) {
  const step = [100, 250, 500, 1000, 2000, 5000, 10000].find((s) => view.span / s <= 8) ?? 20000
  const ticks: number[] = []
  for (let t = Math.ceil(view.t0 / step) * step; t <= view.t0 + view.span; t += step) ticks.push(t)
  return ticks.map((t) => (
    <span key={t} className="absolute top-0 flex h-full items-end pb-1 text-[10px] text-muted-foreground tabular-nums" style={{ left: at(t, view) }}>
      <span className="absolute inset-y-0 left-0 border-l border-dashed" />
      <span className="pl-1">{step >= 1000 ? t / 1000 : (t / 1000).toFixed(2)}с</span>
    </span>
  ))
}

function CountWave({ events, size, view }: { events: CoreEvent[]; size: number; view: View }) {
  const d = useMemo(() => {
    let p = `M0 ${size}`
    for (const e of events) if (e.count !== undefined) p += ` H${e.t} V${size - Math.min(Math.max(e.count, 0), size)}`
    return p + ` H${events.at(-1)?.t ?? 0}`
  }, [events, size])
  return (
    <svg viewBox={`${view.t0} 0 ${view.span} ${size}`} preserveAspectRatio="none" className="absolute inset-x-0 inset-y-1 h-[calc(100%-0.5rem)] w-full">
      <path d={`${d} V${size} H0 Z`} className="fill-produce-soft" />
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} className="stroke-produce" />
    </svg>
  )
}

interface Item { t: number; key: number; text: string; title: string; cls: string }

function Marks({ items, view, dense }: { items: Item[]; view: View; dense: boolean }) {
  return items.map((m, i) => {
    const x = (m.t - view.t0) * view.px
    const prev = i > 0 ? (items[i - 1].t - view.t0) * view.px : -Infinity
    const next = i < items.length - 1 ? (items[i + 1].t - view.t0) * view.px : Infinity
    const roomy = !dense && x - prev >= GAP && next - x >= GAP
    return (
      <span
        key={m.key}
        title={m.title}
        className={cn(
          "absolute -translate-x-1/2 rounded-sm",
          roomy ? "inset-y-1.5 px-1 text-[10px] leading-[18px] font-semibold tabular-nums" : "inset-y-2 w-1",
          m.cls,
        )}
        style={{ left: at(m.t, view) }}
      >
        {roomy && m.text}
      </span>
    )
  })
}

const visible = (t: number, v: View, margin: number) => t >= v.t0 - margin && t <= v.t0 + v.span + margin

const ThreadLane = memo(function ThreadLane({ lane, races, t0, span, px, dense }: {
  lane: Lane
  races: Map<number, string>
  t0: number
  span: number
  px: number
  dense: boolean
}) {
  const view = { t0, span, px }
  const margin = px > 0 ? GAP / px : 0
  const items: Item[] = lane.marks
    .filter((m) => visible(m.t, view, margin))
    .map((m) => {
      const race = races.get(m.index)
      const arrow = m.kind === "produce" ? "↓" : "↑"
      return {
        t: m.t,
        key: m.index,
        text: `${arrow}${m.item}`,
        title: `${lane.key} ${arrow} ${m.item} [${m.slot}]${race ? ` · RACE: ${race}` : ""}`,
        cls: cn("text-white", race ? "z-10 bg-race" : m.kind === "produce" ? "bg-produce" : m.kind === "consume" ? "bg-consume" : "bg-race"),
      }
    })
  return (
    <Row label={lane.key}>
      {lane.segments
        .filter((s) => s.t1 >= t0 && s.t0 <= t0 + span)
        .map((s, i) => {
          const wide = (s.t1 - s.t0) * px >= 84
          return (
            <span
              key={i}
              title={`${lane.key}: ${s.label}`}
              className={cn(
                "absolute inset-y-2 overflow-hidden rounded-sm",
                s.kind === "sleep" ? "bg-sleep" : "border border-wait-border bg-wait text-wait-foreground",
              )}
              style={{ left: at(s.t0, view), width: `${((s.t1 - s.t0) / span) * 100}%` }}
            >
              {s.kind === "wait" && wide && !dense && <span className="block truncate px-1.5 text-[10px] leading-[14px]">{s.label}</span>}
            </span>
          )
        })}
      <Marks items={items} view={view} dense={dense} />
    </Row>
  )
})

function MutexLane({ events, model, view, dense }: { events: CoreEvent[]; model: Model; view: View; dense: boolean }) {
  const margin = view.px > 0 ? GAP / view.px : 0
  if (model.start?.mutex === false)
    return (
      <Row label="mutex" className="bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--race-soft)_6px_12px)]">
        <span className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-sm bg-card px-1.5 text-[11px] font-semibold text-race">mutex унтраалттай: хамгаалалт байхгүй</span>
        {[...model.races.keys()].filter((i) => visible(events[i].t, view, margin)).map((i) => (
          <span key={i} title={model.races.get(i)} className="absolute inset-y-1 w-0.5 bg-race" style={{ left: at(events[i].t, view) }} />
        ))}
      </Row>
    )
  const items: Item[] = []
  events.forEach((e, i) => {
    if (e.mtx && (e.ev === "produce" || e.ev === "consume") && visible(e.t, view, margin))
      items.push({ t: e.t, key: i, text: e.mtx, title: `mutex: ${e.mtx}`, cls: "bg-primary text-primary-foreground" })
  })
  return (
    <Row label="mutex">
      <Marks items={items} view={view} dense={dense} />
    </Row>
  )
}

const LEGEND = [
  ["bg-sleep", "унтаж"],
  ["border border-wait-border bg-wait", "semaphore хүлээж"],
  ["bg-produce", "↓ produce"],
  ["bg-consume", "↑ consume"],
  ["bg-primary", "mutex эзэмшигч"],
  ["bg-race", "race"],
] as const

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {LEGEND.map(([cls, text]) => (
        <li key={text} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-4 rounded-sm", cls)} />
          {text}
        </li>
      ))}
    </ul>
  )
}

interface Props {
  model: Model
  events: CoreEvent[]
  index: number
  windowMs: number
  onSeek: (i: number) => void
}

export function Timeline({ model, events, index, windowMs, onSeek }: Props) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!track) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(track)
    return () => ro.disconnect()
  }, [track])

  if (!events.length)
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Run эхлэхэд thread бүр энд нэг мөр болно.</p>

  const total = Math.max((model.start?.duration ?? 0) * 1000, model.lastT, 1)
  const span = windowMs > 0 && windowMs < total ? windowMs : total
  const playT = events[index]?.t ?? 0
  // The window trails the playhead so upcoming events come in from the right.
  const t0 = span === total ? 0 : Math.min(Math.max(playT - span * 0.7, 0), total - span)
  const view: View = { t0, span, px: width / span }
  const dense = events.length > DENSE
  const size = model.start?.buffer ?? 1

  function seekAt(clientX: number) {
    const r = track?.getBoundingClientRect()
    if (!r) return
    const t = t0 + ((clientX - r.left) / r.width) * span
    let lo = 0
    let hi = events.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (events[mid].t < t) lo = mid + 1
      else hi = mid
    }
    if (lo > 0 && t - events[lo - 1].t <= events[lo].t - t) lo--
    onSeek(lo)
  }

  return (
    <div
      className="relative cursor-col-resize touch-none select-none"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekAt(e.clientX) }}
      onPointerMove={(e) => { if (e.buttons & 1) seekAt(e.clientX) }}
    >
      <Row label="" trackRef={setTrack} className="h-6"><Axis view={view} /></Row>
      <Row label={<span className="text-muted-foreground">count</span>} className="h-10">
        <CountWave events={events} size={size} view={view} />
      </Row>
      {model.lanes.map((lane) => (
        <ThreadLane key={lane.key} lane={lane} races={model.races} t0={t0} span={span} px={view.px} dense={dense} />
      ))}
      <MutexLane events={events} model={model} view={view} dense={dense} />
      {/* Events the core already sent but the playback has not reached yet. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 bg-card/60"
        style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${Math.max(0, (playT - t0) / span)})` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 z-20 border-l-[1.5px] border-foreground"
        style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${(playT - t0) / span})` }}
      >
        <span className="absolute top-0.5 -translate-x-1/2 rounded-sm bg-foreground px-1 font-mono text-[10px] text-background tabular-nums">
          {(playT / 1000).toFixed(2)}
        </span>
      </div>
    </div>
  )
}
