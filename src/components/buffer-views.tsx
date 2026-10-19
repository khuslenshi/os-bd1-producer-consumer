"use client"

import type { CSSProperties } from "react"
import { DoorClosedIcon, DoorOpenIcon, RepeatIcon } from "lucide-react"
import { bufferAt, type CoreEvent, type Model } from "@/lib/model"
import { cn } from "@/lib/utils"

// Everything the three pictures need at the playhead.
export interface Snap {
  slots: (number | null)[]
  n: number
  inIdx: number
  outIdx: number
  empty: number
  full: number
  owner?: string
  ownerName?: string
  noMutex: boolean
  hit?: number // slot touched by the current event
  race: boolean
}

// Buffer, semaphores and mutex owner as of event `index` (the last event that carried a snapshot).
export function snapAt(events: CoreEvent[], index: number, model: Model): Snap & { produced: number; consumed: number } {
  const n = model.start?.buffer ?? 5
  const current = events[index]
  let snap: CoreEvent | undefined
  for (let i = Math.min(index, events.length - 1); i >= 0 && !snap; i--) if (events[i].empty !== undefined) snap = events[i]
  const { slots, produced, consumed } = bufferAt(events, index, n)
  const owner = current?.ev === "end" || current?.ev === "closed" ? undefined : snap?.mtx || undefined
  return {
    slots,
    n,
    inIdx: snap?.in ?? 0,
    outIdx: snap?.out ?? 0,
    empty: snap?.empty ?? n,
    full: snap?.full ?? 0,
    owner,
    ownerName: owner,
    noMutex: model.start?.mutex === false,
    hit: current && (current.ev === "produce" || current.ev === "consume") ? current.slot : undefined,
    race: model.races.has(index),
    produced,
    consumed,
  }
}

const cols = (n: number, max: string): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, ${max}))` })
const clamp = (v: number, n: number) => Math.max(0, Math.min(n, v))

// Filled cells are blue, the cell the current event touched is green (red on a race) and lifted.
function cellTone(s: Snap, i: number, filled: boolean) {
  if (s.hit === i) return s.race ? "border-race-edge bg-race text-white -translate-y-1.5" : "border-now-edge bg-now text-white -translate-y-1.5"
  return filled ? "border-produce-edge bg-produce text-white" : "border-edge bg-muted text-muted-foreground"
}

// Markers under the cells; `left` transitions so in/out visibly slide to the next cell.
function Pointers({ s, put, take }: { s: Snap; put: string; take: string }) {
  const at = (i: number) => `${((i + 0.5) / s.n) * 100}%`
  const same = s.inIdx === s.outIdx
  const tag = "absolute top-1 rounded-full px-2 py-0.5 whitespace-nowrap transition-[left,translate] duration-300 motion-reduce:transition-none"
  return (
    <div className="relative col-span-full h-8 text-xs font-bold">
      <span className={cn(tag, "bg-consume-soft text-consume-edge", same ? "-translate-x-[calc(100%+2px)]" : "-translate-x-1/2")} style={{ left: at(s.outIdx) }}>
        ▲ {take}
      </span>
      <span className={cn(tag, "bg-now-soft text-now-edge", same ? "translate-x-[2px]" : "-translate-x-1/2")} style={{ left: at(s.inIdx) }}>
        ▲ {put}
      </span>
    </div>
  )
}

export function ArrayView({ s }: { s: Snap }) {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="grid w-full justify-center gap-x-2 gap-y-1.5 sm:gap-x-2.5" style={cols(s.n, "4.75rem")}>
        {s.slots.map((_, i) => (
          <span key={i} className="text-center text-xs text-muted-foreground">[{i}]</span>
        ))}
        {s.slots.map((v, i) => (
          <span
            key={i}
            data-slot={i}
            className={cn(
              "tactile flex aspect-square items-center justify-center rounded-2xl text-lg font-bold tabular-nums transition-[background-color,border-color,transform] duration-200 sm:text-2xl motion-reduce:transition-none",
              cellTone(s, i, v !== null),
            )}
          >
            {v !== null && <span key={v} className="animate-in zoom-in-50 fade-in duration-300">{v}</span>}
          </span>
        ))}
        <Pointers s={s} put="in" take="out" />
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RepeatIcon className="size-3" />[{s.n - 1}]-ийн дараа [0] руу эргэж ирнэ
      </span>
    </div>
  )
}

export function QueueView({ s }: { s: Snap }) {
  // Oldest first, walking from `out` once around the ring.
  const items: { slot: number; v: number }[] = []
  for (let k = 0; k < s.n; k++) {
    const i = (s.outIdx + k) % s.n
    const v = s.slots[i]
    if (v !== null) items.push({ slot: i, v })
  }
  const free = Math.max(0, s.n - items.length)
  return (
    <div className="mx-auto flex w-full flex-col items-center gap-2" style={{ maxWidth: `max(18rem, calc(${s.n} * 4.4rem + 2.5rem))` }}>
      <div className="flex w-full justify-between px-3 text-xs font-semibold text-muted-foreground">
        <span>орох →</span>
        <span>→ гарах</span>
      </div>
      <div className="tactile relative w-full rounded-full border-edge bg-muted px-3 py-3">
        <div className="grid justify-end gap-2 sm:gap-3" style={cols(s.n, "3.6rem")}>
          {Array.from({ length: free }, (_, k) => (
            <span key={`free-${k}`} className="aspect-square rounded-full border-2 border-dashed border-input bg-background" />
          ))}
          {[...items].reverse().map((t) => (
            <span
              key={`${t.slot}-${t.v}`}
              data-slot={t.slot}
              className={cn("tactile flex aspect-square flex-col items-center justify-center rounded-full text-sm leading-none font-bold sm:text-base", cellTone(s, t.slot, true))}
            >
              {t.v}
              <small className="mt-0.5 text-[9px] font-semibold opacity-80">[{t.slot}]</small>
            </span>
          ))}
        </div>
        <span data-exit className="absolute top-1/2 right-1 size-1" />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Тасархай тойрог = сул зай · цэнхэр = item · баруун талынх хамгийн эрт орсон тул эхэлж гарна
      </p>
    </div>
  )
}

// A counter sign above the shelf: the bakery word, the OS name, one mark per slot and the number.
function Tickets({ label, term, value, n, filled }: { label: string; term: string; value: number; n: number; filled: string }) {
  return (
    <div className="tactile flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-edge px-2 py-2 text-center" title={`${label} (${term}): ${value}`}>
      <span className="text-xs font-semibold">{label} <span className="font-mono text-[11px] font-normal text-muted-foreground">{term}</span></span>
      <span className="flex flex-wrap justify-center gap-0.5">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={cn("h-3.5 w-2.5 rounded-[3px] transition-colors duration-200 motion-reduce:transition-none", i < clamp(value, n) ? filled : "bg-muted")} />
        ))}
      </span>
      <b className={cn("font-mono text-base leading-none", (value < 0 || value > n) && "text-race")}>{value}</b>
    </div>
  )
}

// The bakery: a wooden display case with one cubby per slot, a loaf where there is an item.
export function BakeryView({ s }: { s: Snap }) {
  const Door = s.owner ? DoorClosedIcon : DoorOpenIcon
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="grid w-full max-w-md grid-cols-3 gap-2">
        <Tickets label="Сул зай" term="empty" value={s.empty} n={s.n} filled="bg-shelf-light" />
        <div className="tactile flex min-w-0 flex-col items-center gap-1 rounded-xl border-edge px-2 py-2 text-center" title="Хаалга (mutex)">
          <span className="text-xs font-semibold">Хаалга <span className="font-mono text-[11px] font-normal text-muted-foreground">mutex</span></span>
          <Door className={cn("size-5", s.noMutex ? "text-race" : s.owner ? "text-foreground" : "text-now-edge")} />
          <b className={cn("truncate text-xs", s.noMutex && "text-race")}>
            {s.noMutex ? "хаалга алга" : s.ownerName ? `дотор: ${s.ownerName}` : "чөлөөтэй"}
          </b>
        </div>
        <Tickets label="Талх" term="full" value={s.full} n={s.n} filled="bg-bread" />
      </div>

      <div className="flex w-fit max-w-full flex-col">
        <div className="rounded-2xl border-[3px] border-shelf bg-[#fbf4ea] p-2 shadow-[inset_0_-6px_0_var(--shelf-light)]">
          <div className="grid gap-2" style={cols(s.n, "5.5rem")}>
            {s.slots.map((v, i) => (
              <span
                key={i}
                data-slot={i}
                className={cn(
                  "relative flex aspect-square items-end justify-center rounded-xl border-2 pb-1.5 transition-[background-color,border-color,translate] duration-200 motion-reduce:transition-none",
                  v === null ? "border-dashed border-shelf-light bg-white/50" : "border-shelf-light bg-white",
                  s.hit === i && (s.race ? "-translate-y-1 border-solid border-race bg-race-soft" : "-translate-y-1 border-solid border-now-edge bg-now-soft"),
                )}
              >
                <small className="absolute top-1 left-1.5 text-[10px] font-bold text-shelf">{i + 1}</small>
                {v === null ? (
                  <span className="self-center text-[10px] text-shelf/70">сул</span>
                ) : (
                  <span
                    key={v}
                    className="flex h-3/5 w-4/5 animate-in items-center justify-center rounded-t-full rounded-b-md bg-bread text-xs font-bold text-[#5a3a12] shadow-[inset_0_-4px_0_var(--bread-crust)] duration-300 zoom-in-50 fade-in sm:text-sm"
                  >
                    {v}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
        {/* Same width as the cubby grid: 3px border + 8px padding on each side. */}
        <div className="mx-[11px] grid">
          <Pointers s={s} put="тавих" take="авах" />
        </div>
      </div>
    </div>
  )
}
