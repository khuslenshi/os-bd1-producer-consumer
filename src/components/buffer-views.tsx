"use client"

import type { CSSProperties } from "react"
import { DoorClosedIcon, RepeatIcon } from "lucide-react"
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
  return (
    <div className="relative col-span-full h-9 text-xs font-bold">
      <span className="absolute top-1 -translate-x-1/2 text-consume-edge transition-[left] duration-300 motion-reduce:transition-none" style={{ left: at(s.outIdx) }}>
        ▲ {take}
      </span>
      <span
        className={cn("absolute -translate-x-1/2 text-now-edge transition-[left] duration-300 motion-reduce:transition-none", s.inIdx === s.outIdx ? "top-5" : "top-1")}
        style={{ left: at(s.inIdx) }}
      >
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

function Tickets({ label, value, n, filled }: { label: string; value: number; n: number; filled: string }) {
  return (
    <div className="tactile flex min-w-0 flex-col items-center gap-1.5 rounded-xl border-edge px-2 py-2 text-center" title={`${label}: ${value}`}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex flex-wrap justify-center gap-0.5">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={cn("h-3.5 w-2.5 rounded-[3px] transition-colors duration-200 motion-reduce:transition-none", i < clamp(value, n) ? filled : "bg-muted")} />
        ))}
      </span>
      <b className={cn("font-mono text-sm", (value < 0 || value > n) && "text-race")}>{value}</b>
    </div>
  )
}

export function BakeryView({ s }: { s: Snap }) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="grid w-full max-w-md grid-cols-3 gap-2">
        <Tickets label="сул зайны тасалбар" value={s.empty} n={s.n} filled="bg-foreground" />
        <div className="tactile flex min-w-0 flex-col items-center gap-1 rounded-xl border-edge px-2 py-2 text-center">
          <span className="text-[11px] text-muted-foreground">хаалга · нэг удаад нэг</span>
          <DoorClosedIcon className="size-5" />
          <b className={cn("text-xs", s.noMutex && "text-race")}>
            {s.noMutex ? "хаалга байхгүй" : s.ownerName ? `дотор: ${s.ownerName}` : "хоосон"}
          </b>
        </div>
        <Tickets label="талхны тасалбар" value={s.full} n={s.n} filled="bg-produce" />
      </div>
      <div className="grid w-full justify-center gap-y-1" style={cols(s.n, "4.5rem")}>
        {s.slots.map((v, i) => (
          <span
            key={i}
            data-slot={i}
            className={cn(
              "flex aspect-square items-end justify-center border-x-[3px] border-shelf-light pb-1 transition-colors duration-200 motion-reduce:transition-none",
              s.hit === i && (s.race ? "bg-race-soft" : "bg-now-soft"),
            )}
          >
            {v !== null && (
              <span
                key={v}
                className="flex h-3/5 w-4/5 animate-in items-center justify-center rounded-t-full rounded-b-md bg-bread text-xs font-bold text-[#5a3a12] shadow-[inset_0_-4px_0_var(--bread-crust)] duration-300 zoom-in-50 fade-in sm:text-sm"
              >
                {v}
              </span>
            )}
          </span>
        ))}
        <span className="col-span-full h-2 rounded-full bg-shelf" />
        {s.slots.map((_, i) => (
          <span key={i} className="text-center text-xs text-muted-foreground">{i + 1}-р</span>
        ))}
        <Pointers s={s} put="тавих" take="авах" />
      </div>
    </div>
  )
}
