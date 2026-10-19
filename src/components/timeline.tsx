"use client"

import { memo, useRef, type ReactNode, type Ref } from "react"
import type { CoreEvent, Lane, Model } from "@/lib/model"
import { cn } from "@/lib/utils"

const LABEL_W = "3.5rem"
const pct = (t: number, total: number) => `${(t / total) * 100}%`
// ponytail: past this many events labels are dropped and marks become 2px bars
const DENSE = 600

function Row({ label, children, className, trackRef }: {
  label: ReactNode
  children: ReactNode
  className?: string
  trackRef?: Ref<HTMLDivElement>
}) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b last:border-b-0">
      <div className="flex items-center pl-4 text-xs font-semibold">{label}</div>
      <div ref={trackRef} className={cn("relative h-8", className)}>{children}</div>
    </div>
  )
}

function Axis({ total }: { total: number }) {
  const step = [100, 250, 500, 1000, 2000, 5000, 10000].find((s) => total / s <= 10) ?? 20000
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step)
  return ticks.map((t) => (
    <span key={t} className="absolute top-0 flex h-full items-end pb-1 text-[10px] text-muted-foreground tabular-nums" style={{ left: pct(t, total) }}>
      <span className="absolute inset-y-0 left-0 border-l border-dashed" />
      <span className="pl-1">{step >= 1000 ? t / 1000 : (t / 1000).toFixed(2)}с</span>
    </span>
  ))
}

const CountWave = memo(function CountWave({ events, total, size }: { events: CoreEvent[]; total: number; size: number }) {
  let d = `M0 ${size}`
  for (const e of events) if (e.count !== undefined) d += ` H${e.t} V${size - Math.min(Math.max(e.count, 0), size)}`
  const lastT = events.at(-1)?.t ?? 0
  d += ` H${lastT}`
  return (
    <svg viewBox={`0 0 ${total} ${size}`} preserveAspectRatio="none" className="absolute inset-x-0 inset-y-1 h-[calc(100%-0.5rem)] w-full overflow-visible">
      <path d={`${d} V${size} H0 Z`} className="fill-produce-soft" />
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} className="stroke-produce" />
    </svg>
  )
})

const MARK = { produce: "bg-produce", consume: "bg-consume", error: "bg-race" } as const

const ThreadLane = memo(function ThreadLane({ lane, races, total, dense }: {
  lane: Lane
  races: Map<number, string>
  total: number
  dense: boolean
}) {
  return (
    <Row label={lane.key}>
      {lane.segments.map((s, i) => (
        <span
          key={i}
          title={s.label}
          className={cn(
            "absolute inset-y-1.5 overflow-hidden rounded-sm",
            s.kind === "sleep" ? "bg-sleep text-muted-foreground" : "border border-wait-border bg-wait text-wait-foreground",
          )}
          style={{ left: pct(s.t0, total), width: pct(s.t1 - s.t0, total) }}
        >
          {!dense && <span className="block truncate px-1.5 text-[10px] leading-[18px]">{s.label}</span>}
        </span>
      ))}
      {lane.marks.map((m) => {
        const race = races.get(m.index)
        const arrow = m.kind === "produce" ? "↓" : "↑"
        return (
          <span
            key={m.index}
            title={`${arrow} ${m.item} [${m.slot}]${race ? ` · RACE: ${race}` : ""}`}
            className={cn(
              "absolute rounded-sm text-white",
              dense ? "inset-y-1 w-0.5" : "inset-y-1.5 -translate-x-1/2 px-1 text-[10px] leading-[18px] font-semibold tabular-nums",
              race ? "z-10 bg-race" : MARK[m.kind],
            )}
            style={{ left: pct(m.t, total) }}
          >
            {!dense && `${arrow}${m.item}`}
          </span>
        )
      })}
    </Row>
  )
})

const MutexLane = memo(function MutexLane({ events, model, total, dense }: {
  events: CoreEvent[]
  model: Model
  total: number
  dense: boolean
}) {
  if (model.start?.mutex === false)
    return (
      <Row label="mutex" className="bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--race-soft)_6px_12px)]">
        <span className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-sm bg-card px-1.5 text-[11px] font-semibold text-race">mutex унтраалттай: хамгаалалт байхгүй</span>
        {[...model.races.keys()].map((i) => (
          <span key={i} title={model.races.get(i)} className="absolute inset-y-1 w-0.5 bg-race" style={{ left: pct(events[i].t, total) }} />
        ))}
      </Row>
    )
  return (
    <Row label="mutex">
      {events.map((e, i) =>
        e.mtx && (e.ev === "produce" || e.ev === "consume") ? (
          <span
            key={i}
            title={`mutex: ${e.mtx}`}
            className={cn("absolute rounded-sm bg-primary text-primary-foreground", dense ? "inset-y-1 w-0.5" : "inset-y-1.5 -translate-x-1/2 px-1 text-[10px] leading-[18px] font-semibold")}
            style={{ left: pct(e.t, total) }}
          >
            {!dense && e.mtx}
          </span>
        ) : null,
      )}
    </Row>
  )
})

interface Props {
  model: Model
  events: CoreEvent[]
  index: number
  onSeek: (i: number) => void
}

export function Timeline({ model, events, index, onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null)

  if (!events.length)
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-semibold">Одоогоор ажиллуулаагүй байна</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Тохиргоогоо сонгоод Start дар, эсвэл бэлэн туршилтын аль нэгийг сонго. Thread бүр энд нэг мөр болж харагдана.
        </p>
      </div>
    )

  const total = Math.max((model.start?.duration ?? 0) * 1000, model.lastT, 1)
  const dense = events.length > DENSE
  const size = model.start?.buffer ?? 1
  const frac = Math.min((events[index]?.t ?? 0) / total, 1)

  function seekAt(clientX: number) {
    const r = track.current?.getBoundingClientRect()
    if (!r) return
    const t = ((clientX - r.left) / r.width) * total
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
      <Row label="" trackRef={track} className="h-6"><Axis total={total} /></Row>
      <Row label={<span className="text-muted-foreground">count</span>} className="h-10">
        <CountWave events={events} total={total} size={size} />
      </Row>
      {model.lanes.map((lane) => (
        <ThreadLane key={lane.key} lane={lane} races={model.races} total={total} dense={dense} />
      ))}
      <MutexLane events={events} model={model} total={total} dense={dense} />
      <div
        className="pointer-events-none absolute inset-y-0 z-20 border-l-[1.5px] border-foreground"
        style={{ left: `calc(${LABEL_W} + (100% - ${LABEL_W}) * ${frac})` }}
      >
        <span className="absolute top-0.5 -translate-x-1/2 rounded-sm bg-foreground px-1 font-mono text-[10px] text-background tabular-nums">
          {((events[index]?.t ?? 0) / 1000).toFixed(2)}
        </span>
      </div>
    </div>
  )
}
