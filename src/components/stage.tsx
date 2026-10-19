"use client"

import { useEffect, useRef, useState } from "react"
import { ChefHatIcon, LockIcon, UserRoundIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrayView, BakeryView, QueueView, type Snap } from "@/components/buffer-views"
import { bufferAt, describe, threadStates, who, type CoreEvent, type Model, type ThreadState } from "@/lib/model"
import { cn } from "@/lib/utils"

type View = "array" | "queue" | "bakery"
const VIEWS: [View, string][] = [["array", "Массив"], ["queue", "Хоолой"], ["bakery", "Талх"]]

const bakeryName = (key: string) => (key.startsWith("P") ? "Талхчин " : "Авагч ") + key.slice(1)

// Plain-words version of a thread state for the bakery picture.
function bakeryText(s: ThreadState) {
  const e = s.e
  if (!e) return "ирээгүй"
  if (e.ev === "sleep") return `амарч ${e.ms} мс`
  if (e.ev === "wait_empty") return "тавиур дүүрэн, хүлээж"
  if (e.ev === "wait_full") return "талх алга, хүлээж"
  if (e.ev === "produce") return `${e.item}-г тавьж`
  if (e.ev === "consume") return `${e.item}-г авч`
  return s.text
}

function bakeryCaption(e: CoreEvent) {
  if (!e.role) return describe(e)
  const name = bakeryName(who(e))
  if (e.ev === "sleep") return `${name} ${e.ms} мс амарна`
  if (e.ev === "wait_empty") return `${name} хүлээж байна: тавиур дүүрэн (сул зайны тасалбар дууссан)`
  if (e.ev === "wait_full") return `${name} хүлээж байна: тавиур хоосон (талхны тасалбар дууссан)`
  if (e.ev === "produce") return `${name} ${e.item} дугаартай талхыг ${(e.slot ?? 0) + 1}-р тавиурт тавив`
  if (e.ev === "consume") return `${name} ${e.item} дугаартай талхыг ${(e.slot ?? 0) + 1}-р тавиураас авав`
  return describe(e)
}

const CHIP: Record<ThreadState["kind"], string> = {
  idle: "bg-card text-muted-foreground",
  sleep: "border-transparent bg-sleep text-muted-foreground",
  wait: "border-wait-border bg-wait text-wait-foreground",
  work: "",
}

function Threads({ title, keys, states, owner, refs, consumer, bakery }: {
  title: string
  keys: string[]
  states: Map<string, ThreadState>
  owner?: string
  refs: Map<string, HTMLElement>
  consumer?: boolean
  bakery: boolean
}) {
  const dense = keys.length > 6
  const work = consumer ? "border-consume/30 bg-consume/10 text-consume" : "border-produce/30 bg-produce-soft text-produce"
  const Icon = consumer ? UserRoundIcon : ChefHatIcon
  return (
    <div className={cn("flex flex-col gap-2", consumer ? "md:items-start" : "md:items-end")}>
      <span className="text-xs text-muted-foreground">{title}</span>
      {keys.length === 0 && <span className="text-xs text-muted-foreground">байхгүй</span>}
      <div className={cn("flex flex-wrap gap-1.5", dense ? "md:grid md:grid-cols-2" : "md:flex-col")}>
        {keys.map((k) => {
          const s = states.get(k) ?? { kind: "idle" as const, text: "" }
          const text = bakery ? bakeryText(s) : s.text
          return (
            <div
              key={k}
              ref={(el) => { if (el) refs.set(k, el); else refs.delete(k) }}
              title={`${bakery ? bakeryName(k) : k}: ${text}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors duration-150 motion-reduce:transition-none",
                s.kind === "work" ? work : CHIP[s.kind],
                owner === k && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                !dense && (bakery ? "md:w-48" : "md:w-40"),
              )}
            >
              {bakery && <Icon className="size-3.5 shrink-0" />}
              <span className="shrink-0 font-mono text-xs font-bold whitespace-nowrap">{bakery && !dense ? bakeryName(k) : k}</span>
              {!dense && <span className="truncate text-[11px]">{text}</span>}
              {owner === k && <LockIcon className="ml-auto size-3 shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  events: CoreEvent[]
  index: number
  model: Model
  speed: number
  onSeek: (i: number) => void
}

export function Stage({ events, index, model, speed, onSeek }: Props) {
  const [view, setView] = useState<View>("array")
  const n = model.start?.buffer ?? 5
  const keys = model.lanes.map((l) => l.key)
  const current = events[index]
  let snap: CoreEvent | undefined
  for (let i = Math.min(index, events.length - 1); i >= 0 && !snap; i--) if (events[i].empty !== undefined) snap = events[i]
  const { slots, produced, consumed } = bufferAt(events, index, n)
  const states = threadStates(events, index, keys)
  const race = model.races.get(index)
  const racesSoFar = [...model.races.keys()].filter((i) => i <= index)
  const firstRace = model.races.keys().next().value
  const owner = current?.ev === "end" || current?.ev === "closed" ? undefined : snap?.mtx || undefined
  const bakery = view === "bakery"
  const s: Snap = {
    slots,
    n,
    inIdx: snap?.in ?? 0,
    outIdx: snap?.out ?? 0,
    empty: snap?.empty ?? n,
    full: snap?.full ?? 0,
    owner,
    ownerName: owner && bakery ? bakeryName(owner) : owner,
    noMutex: model.start?.mutex === false,
    hit: current && (current.ev === "produce" || current.ev === "consume") ? current.slot : undefined,
    race: Boolean(race),
  }

  const stage = useRef<HTMLElement>(null)
  const chips = useRef(new Map<string, HTMLElement>())
  const prev = useRef(index)

  // Fly each produce/consume passed since the last render between the thread chip and its cell.
  useEffect(() => {
    const from = prev.current
    prev.current = index
    if (index <= from || index - from > 8 || events.length > 600) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const root = stage.current
    const box = root?.getBoundingClientRect()
    if (!root || !box) return
    for (let i = from + 1; i <= index; i++) {
      const e = events[i]
      if (!e || (e.ev !== "produce" && e.ev !== "consume") || e.slot === undefined || e.slot < 0) continue
      const chip = chips.current.get(who(e))
      const cell = root.querySelector(`[data-slot="${e.slot}"]`) ?? root.querySelector("[data-exit]")
      if (!chip || !cell) continue
      const center = (r: DOMRect) => ({ x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 })
      const thread = center(chip.getBoundingClientRect())
      const slot = center(cell.getBoundingClientRect())
      const [a, b] = e.ev === "produce" ? [thread, slot] : [slot, thread]
      const el = document.createElement("span")
      el.textContent = String(e.item)
      el.className = cn(
        "pointer-events-none absolute top-0 left-0 z-30 flex size-8 items-center justify-center rounded-full font-mono text-xs font-bold text-white shadow-sm",
        bakery ? "bg-bread text-[#5a3a12]" : e.ev === "produce" ? "bg-produce" : "bg-consume",
      )
      root.appendChild(el)
      el.animate(
        [
          { transform: `translate(${a.x - 16}px, ${a.y - 16}px) scale(0.7)`, opacity: 0.6 },
          { transform: `translate(${b.x - 16}px, ${b.y - 16}px) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${b.x - 16}px, ${b.y - 16}px) scale(0.9)`, opacity: 0 },
        ],
        { duration: Math.min(1400, Math.max(350, 450 / speed)), easing: "cubic-bezier(.2,.7,.3,1)" },
      ).finished.finally(() => el.remove())
    }
  }, [index, events, speed, bakery])

  const header = (
    <div className="flex items-center gap-3 border-b px-4 py-2">
      <h2 className="text-sm font-semibold">Буфер</h2>
      <ToggleGroup type="single" size="sm" variant="outline" className="ml-auto" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Буферийн дүрслэл">
        {VIEWS.map(([v, label]) => (
          <ToggleGroupItem key={v} value={v} className="px-2.5 text-xs">{label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )

  if (!events.length)
    return (
      <section className="rounded-lg border bg-card">
        {header}
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="font-semibold">Одоогоор ажиллуулаагүй байна</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Тохиргоогоо сонгоод Start дар, эсвэл бэлэн туршилтын аль нэгийг сонго. Producer буферт тавьж, consumer авахыг энд харна.
          </p>
        </div>
      </section>
    )

  return (
    <section ref={stage} className="relative overflow-hidden rounded-lg border bg-card">
      {header}
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)] md:items-center">
        <Threads title={bakery ? "Талхчин · тавина" : "Producer · тавина"} keys={keys.filter((k) => k.startsWith("P"))} states={states} owner={owner} refs={chips.current} bakery={bakery} />
        {view === "array" ? <ArrayView s={s} /> : view === "queue" ? <QueueView s={s} /> : <BakeryView s={s} />}
        <Threads title={bakery ? "Авагч · авна" : "Consumer · авна"} keys={keys.filter((k) => k.startsWith("C"))} states={states} owner={owner} refs={chips.current} consumer bakery={bakery} />
      </div>

      <div className="flex flex-col gap-1 border-t px-4 py-3">
        <p className={cn("text-[15px] leading-snug font-semibold", race && "text-race")}>
          <span className="mr-2 font-mono text-xs font-normal text-muted-foreground tabular-nums">{((current?.t ?? 0) / 1000).toFixed(3)} с</span>
          {current && (bakery ? bakeryCaption(current) : describe(current))}
        </p>
        {race && <p className="text-sm text-race">Race: {race}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-2.5 text-sm">
        <span><span className="text-muted-foreground">Тавьсан</span> <b className="font-mono tabular-nums">{produced}</b></span>
        <span><span className="text-muted-foreground">Авсан</span> <b className="font-mono tabular-nums">{consumed}</b></span>
        <span><span className="text-muted-foreground">Буферт</span> <b className="font-mono tabular-nums">{produced - consumed}</b></span>
        {model.end && (
          <span className={cn("font-semibold", model.end.invariant_ok ? "text-produce" : "text-race")}>
            Invariant {model.end.invariant_ok ? "OK" : "БУРУУ"}: {model.end.produced} − {model.end.consumed} {model.end.invariant_ok ? "=" : "≠"} {model.end.in_buffer}
          </span>
        )}
        {firstRace !== undefined && (
          <span className="flex items-center gap-2 text-race">
            Race {racesSoFar.length}/{model.races.size}
            <Button size="xs" variant="outline" onClick={() => onSeek(firstRace)}>Эхнийх рүү</Button>
          </span>
        )}
      </div>
    </section>
  )
}
