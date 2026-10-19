"use client"

import type { CSSProperties } from "react"
import { DoorClosedIcon, LockIcon, LockOpenIcon, RepeatIcon } from "lucide-react"
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

const cols = (n: number, max = "3.5rem"): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, ${max}))` })
const clamp = (v: number, n: number) => Math.max(0, Math.min(n, v))

function Meter({ label, value, n, filled }: { label: string; value: number; n: number; filled: string }) {
  return (
    <div className="flex flex-col gap-1" title={`${label}: ${value}. sem_wait нэгийг авна, 0 бол хүлээнэ.`}>
      <span className="text-[11px] text-muted-foreground">
        {label} = <b className={cn("font-mono text-foreground", (value < 0 || value > n) && "text-race")}>{value}</b>
      </span>
      <span className="flex gap-0.5">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={cn("h-2 w-3 rounded-[2px] transition-colors duration-200 motion-reduce:transition-none", i < clamp(value, n) ? filled : "bg-muted")} />
        ))}
      </span>
    </div>
  )
}

function Mutex({ s, label = "mutex" }: { s: Snap; label?: string }) {
  if (s.noMutex) return <span className="rounded-md bg-race-soft px-2 py-1 text-[11px] font-semibold text-race">mutex байхгүй</span>
  const Icon = s.owner ? LockIcon : LockOpenIcon
  return (
    <span className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]">
      <Icon className="size-3.5" />
      {label}: <b className="font-mono">{s.ownerName ?? s.owner ?? "чөлөөтэй"}</b>
    </span>
  )
}

// Markers under the cells; `left` transitions so in/out visibly slide to the next cell.
function Pointers({ s, put, take }: { s: Snap; put: string; take: string }) {
  const at = (i: number) => `${((i + 0.5) / s.n) * 100}%`
  return (
    <div className="relative col-span-full h-5 text-[10.5px] font-semibold">
      <span className="absolute top-0 -translate-x-1/2 text-consume transition-[left] duration-300 motion-reduce:transition-none" style={{ left: at(s.outIdx) }}>
        ▲{take}
      </span>
      <span
        className={cn("absolute -translate-x-1/2 text-produce transition-[left] duration-300 motion-reduce:transition-none", s.inIdx === s.outIdx ? "top-2.5" : "top-0")}
        style={{ left: at(s.inIdx) }}
      >
        ▲{put}
      </span>
    </div>
  )
}

export function ArrayView({ s }: { s: Snap }) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-2">
        <Meter label="empty" value={s.empty} n={s.n} filled="bg-foreground" />
        <Meter label="full" value={s.full} n={s.n} filled="bg-produce" />
        <Mutex s={s} />
      </div>
      <div className="grid w-full justify-center gap-x-1.5 gap-y-1" style={cols(s.n)}>
        {s.slots.map((_, i) => (
          <span key={i} className="text-center text-[10.5px] text-muted-foreground">[{i}]</span>
        ))}
        {s.slots.map((v, i) => (
          <span
            key={i}
            data-slot={i}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border-[1.5px] font-mono text-sm font-bold transition-colors duration-200 sm:text-base motion-reduce:transition-none",
              v === null ? "border-border bg-muted" : "border-produce/30 bg-produce-soft text-produce",
              s.hit === i && (s.race ? "border-race bg-race-soft text-race" : "ring-2 ring-foreground ring-offset-2 ring-offset-card"),
            )}
          >
            {v !== null && <span key={v} className="animate-in zoom-in-50 fade-in duration-300">{v}</span>}
          </span>
        ))}
        <Pointers s={s} put=" in" take=" out" />
      </div>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <RepeatIcon className="size-3" />[{s.n - 1}]-ийн дараа [0] руу эргэж ирнэ (circular array)
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
    <div className="mx-auto flex w-full flex-col items-center gap-2" style={{ maxWidth: `max(18rem, calc(${s.n} * 3.6rem + 2rem))` }}>
      <div className="flex w-full items-center justify-between px-2 text-[11px] text-muted-foreground">
        <span>орох →</span>
        <Mutex s={s} />
        <span>→ гарах</span>
      </div>
      <div className="relative w-full rounded-full border bg-muted px-3 py-2.5">
        <div className="grid justify-end gap-1.5 sm:gap-2.5" style={cols(s.n, "3rem")}>
          {Array.from({ length: free }, (_, k) => (
            <span key={`free-${k}`} className="aspect-square rounded-full border-[1.5px] border-dashed border-input" />
          ))}
          {[...items].reverse().map((t) => (
            <span
              key={`${t.slot}-${t.v}`}
              data-slot={t.slot}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-full font-mono text-xs leading-none font-bold sm:text-sm",
                s.hit === t.slot && s.race ? "bg-race text-white" : s.hit === t.slot ? "bg-produce text-white" : "border-[1.5px] border-produce/30 bg-produce-soft text-produce",
              )}
            >
              {t.v}
              <small className="mt-0.5 text-[9px] font-medium opacity-80">[{t.slot}]</small>
            </span>
          ))}
        </div>
        <span data-exit className="absolute top-1/2 right-1 size-1" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>тасархай = сул зай (empty <b className="font-mono text-foreground">{s.empty}</b>)</span>
        <span>ногоон = item (full <b className="font-mono text-produce">{s.full}</b>)</span>
        <span>баруун талынх хамгийн эрт орсон тул эхэлж гарна</span>
      </div>
    </div>
  )
}

function Tickets({ label, value, n, filled }: { label: string; value: number; n: number; filled: string }) {
  return (
    <div className="flex min-w-28 flex-col items-center gap-1 rounded-lg border px-3 py-2" title={`${label}: ${value}`}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex flex-wrap justify-center gap-0.5">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={cn("h-3.5 w-2.5 rounded-[2px] transition-colors duration-200 motion-reduce:transition-none", i < clamp(value, n) ? filled : "bg-muted")} />
        ))}
      </span>
      <b className={cn("font-mono text-xs", (value < 0 || value > n) && "text-race")}>{value}</b>
    </div>
  )
}

export function BakeryView({ s }: { s: Snap }) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        <Tickets label="сул зайны тасалбар" value={s.empty} n={s.n} filled="bg-foreground" />
        <div className="flex min-w-28 flex-col items-center gap-1 rounded-lg border px-3 py-2">
          <span className="text-[11px] text-muted-foreground">хаалга · нэг удаад нэг</span>
          <DoorClosedIcon className="size-5" />
          <b className={cn("text-xs", s.noMutex && "text-race")}>
            {s.noMutex ? "хаалга байхгүй" : s.ownerName ? `дотор: ${s.ownerName}` : "хоосон"}
          </b>
        </div>
        <Tickets label="талхны тасалбар" value={s.full} n={s.n} filled="bg-produce" />
      </div>
      <div className="grid w-full justify-center gap-y-1" style={cols(s.n, "4rem")}>
        {s.slots.map((v, i) => (
          <span
            key={i}
            data-slot={i}
            className={cn(
              "flex aspect-square items-end justify-center border-x-[3px] border-shelf-light pb-1 transition-colors duration-200 motion-reduce:transition-none",
              s.hit === i && (s.race ? "bg-race-soft" : "bg-produce-soft"),
            )}
          >
            {v !== null && (
              <span
                key={v}
                className="flex h-3/5 w-4/5 animate-in items-center justify-center rounded-t-full rounded-b-md bg-bread font-mono text-[11px] font-bold text-[#5a3a12] shadow-[inset_0_-4px_0_var(--bread-crust)] duration-300 zoom-in-50 fade-in sm:text-xs"
              >
                {v}
              </span>
            )}
          </span>
        ))}
        <span className="col-span-full h-1.5 rounded-full bg-shelf" />
        {s.slots.map((_, i) => (
          <span key={i} className="text-center text-[10.5px] text-muted-foreground">{i + 1}-р</span>
        ))}
        <Pointers s={s} put="тавих" take="авах" />
      </div>
    </div>
  )
}
