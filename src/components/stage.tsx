"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
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
  if (e.ev === "wait_empty") return `${name} хүлээж байна: тавиур дүүрэн`
  if (e.ev === "wait_full") return `${name} хүлээж байна: тавиур хоосон`
  if (e.ev === "produce") return `${name} ${e.item} дугаартай талхыг ${(e.slot ?? 0) + 1}-р тавиурт тавив`
  if (e.ev === "consume") return `${name} ${e.item} дугаартай талхыг ${(e.slot ?? 0) + 1}-р тавиураас авав`
  return describe(e)
}

// One line under the caption that says why this step happened, like a lesson hint.
function hint(e: CoreEvent | undefined, noMutex: boolean) {
  if (!e) return ""
  const guard = noMutex
    ? "Mutex байхгүй тул өөр thread яг энэ үед буферт хандаж магадгүй."
    : `Mutex-ийг ${e.mtx || who(e)} барьж байгаа тул өөр хэн ч буферт хүрч чадахгүй.`
  switch (e.ev) {
    case "produce": return `${guard} Дараа нь full-д 1 нэмнэ (sem_post).`
    case "consume": return `${guard} Дараа нь empty-д 1 нэмнэ (sem_post).`
    case "wait_empty": return "Сул зай алга (empty = 0) тул sem_wait(empty) дээр блоклогдлоо."
    case "wait_full": return "Буферт юу ч алга (full = 0) тул sem_wait(full) дээр блоклогдлоо."
    case "sleep": return "Critical section-ээс гадуур, буферт хүрэхгүй."
    case "start": return "Thread-үүд үүсч, бүгд эхлээд хэсэг унтана."
    default: return ""
  }
}

const CHIP: Record<ThreadState["kind"], string> = {
  idle: "border-edge bg-background text-muted-foreground",
  sleep: "border-edge bg-muted text-muted-foreground",
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
  const work = consumer ? "border-consume-edge bg-consume text-white" : "border-now-edge bg-now text-white"
  const Icon = consumer ? UserRoundIcon : ChefHatIcon
  return (
    <div className={cn("flex flex-col gap-2", consumer ? "md:items-start" : "md:items-end")}>
      <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      {keys.length === 0 && <span className="text-xs text-muted-foreground">байхгүй</span>}
      <div className={cn("flex flex-wrap gap-2", dense ? "md:grid md:grid-cols-2" : "md:flex-col")}>
        {keys.map((k) => {
          const s = states.get(k) ?? { kind: "idle" as const, text: "" }
          const text = bakery ? bakeryText(s) : s.text
          return (
            <div
              key={k}
              ref={(el) => { if (el) refs.set(k, el); else refs.delete(k) }}
              title={`${bakery ? bakeryName(k) : k}: ${text}`}
              className={cn(
                "tactile flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                s.kind === "work" ? work : CHIP[s.kind],
                owner === k && "outline-2 outline-offset-2 outline-foreground",
                !dense && (bakery ? "md:w-52" : "md:w-48"),
              )}
            >
              {bakery && <Icon className="size-4 shrink-0" />}
              <b className="shrink-0 whitespace-nowrap">{bakery && !dense ? bakeryName(k) : k}</b>
              {!dense && <span className="truncate">{text}</span>}
              {owner === k && <LockIcon className="ml-auto size-3.5 shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Pill({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <span className={cn("flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-[13px]", tone)}>
      {label} <b className="font-mono text-[15px] tabular-nums">{value}</b>
    </span>
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
  const noMutex = model.start?.mutex === false
  const s: Snap = {
    slots,
    n,
    inIdx: snap?.in ?? 0,
    outIdx: snap?.out ?? 0,
    empty: snap?.empty ?? n,
    full: snap?.full ?? 0,
    owner,
    ownerName: owner && bakery ? bakeryName(owner) : owner,
    noMutex,
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
        "pointer-events-none absolute top-0 left-0 z-30 flex size-9 items-center justify-center rounded-full border-b-4 text-sm font-bold text-white",
        bakery ? "border-bread-crust bg-bread text-[#5a3a12]" : e.ev === "produce" ? "border-produce-edge bg-produce" : "border-consume-edge bg-consume",
      )
      root.appendChild(el)
      el.animate(
        [
          { transform: `translate(${a.x - 18}px, ${a.y - 18}px) scale(0.7)`, opacity: 0.6 },
          { transform: `translate(${b.x - 18}px, ${b.y - 18}px) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${b.x - 18}px, ${b.y - 18}px) scale(0.9)`, opacity: 0 },
        ],
        { duration: Math.min(1400, Math.max(350, 450 / speed)), easing: "cubic-bezier(.2,.7,.3,1)" },
      ).finished.finally(() => el.remove())
    }
  }, [index, events, speed, bakery])

  const viewSwitch = (
    <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Буферийн дүрслэл">
      {VIEWS.map(([v, label]) => (
        <ToggleGroupItem key={v} value={v}>{label}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  if (!events.length)
    return (
      <section className="flex flex-col items-center gap-4 py-14 text-center">
        <p className="text-2xl font-bold tracking-tight">Эхлээд Start дарна уу</p>
        <p className="max-w-md text-[15px] text-muted-foreground">
          Эсвэл дээрх бэлэн туршилтын аль нэгийг сонго. Producer буферт тавьж, consumer авахыг энд алхам алхмаар харна.
        </p>
        {viewSwitch}
      </section>
    )

  return (
    <section ref={stage} className="relative flex flex-col gap-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">Буфер · {n} үүр</span>
        {viewSwitch}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,1fr)] md:items-center">
        <Threads title={bakery ? "Талхчин · тавина" : "Producer · тавина"} keys={keys.filter((k) => k.startsWith("P"))} states={states} owner={owner} refs={chips.current} bakery={bakery} />
        {view === "array" ? <ArrayView s={s} /> : view === "queue" ? <QueueView s={s} /> : <BakeryView s={s} />}
        <Threads title={bakery ? "Авагч · авна" : "Consumer · авна"} keys={keys.filter((k) => k.startsWith("C"))} states={states} owner={owner} refs={chips.current} consumer bakery={bakery} />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className={cn("text-xl leading-snug font-bold tracking-tight text-balance sm:text-2xl", race && "text-race")}>
          {current && (bakery ? bakeryCaption(current) : describe(current))}
        </p>
        <p className={cn("max-w-xl text-[15px] text-muted-foreground text-balance", race && "text-race")}>
          {race ? `Race: ${race}` : hint(current, noMutex)}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Pill label="empty" value={s.empty} />
        <Pill label="full" value={s.full} />
        <Pill label="mutex" value={noMutex ? "байхгүй" : owner ?? "чөлөөтэй"} tone={noMutex ? "bg-race-soft text-race" : undefined} />
        <Pill label="тавьсан" value={produced} />
        <Pill label="авсан" value={consumed} />
        {model.end && (
          <Pill
            label={`Invariant ${model.end.invariant_ok ? "OK" : "БУРУУ"}`}
            value={`${model.end.produced} − ${model.end.consumed} ${model.end.invariant_ok ? "=" : "≠"} ${model.end.in_buffer}`}
            tone={model.end.invariant_ok ? "bg-now-soft text-now-edge" : "bg-race-soft text-race"}
          />
        )}
        {firstRace !== undefined && (
          <span className="flex items-center gap-2 rounded-full bg-race-soft py-1 pr-1 pl-3.5 text-[13px] text-race">
            Race <b className="font-mono">{racesSoFar.length}/{model.races.size}</b>
            <Button size="xs" variant="outline" onClick={() => onSeek(firstRace)}>Эхнийх рүү</Button>
          </span>
        )}
      </div>
    </section>
  )
}
