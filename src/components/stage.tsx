"use client"

import { useEffect, useRef } from "react"
import { KeyRoundIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { bufferAt, describe, threadStates, who, type CoreEvent, type Model, type ThreadState } from "@/lib/model"
import { cn } from "@/lib/utils"

// Ring geometry in SVG units (viewBox 0 0 280 280).
const S = 280
const C = 140
const R_OUT = 118
const R_IN = 80
const R_MID = (R_OUT + R_IN) / 2
const R_IDX = 131

const polar = (deg: number, r: number) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)]
const mid = (i: number, n: number) => -90 + (i + 0.5) * (360 / n)

function sector(i: number, n: number) {
  const a = 360 / n
  const gap = Math.min(2.5, a * 0.1)
  const a0 = -90 + i * a + gap / 2
  const a1 = -90 + (i + 1) * a - gap / 2
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(a0, R_OUT)
  const [x1, y1] = polar(a1, R_OUT)
  const [x2, y2] = polar(a1, R_IN)
  const [x3, y3] = polar(a0, R_IN)
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}Z`
}

// Cumulative rotation so a pointer moving n-1 -> 0 turns one step forward, not a full lap back.
function useTurn(slot: number | undefined, n: number) {
  const st = useRef({ slot: 0, deg: 0, n })
  if (st.current.n !== n) st.current = { slot: 0, deg: 0, n }
  if (slot !== undefined && slot >= 0 && slot !== st.current.slot) {
    const step = (((slot - st.current.slot) % n) + n) % n
    st.current.deg += (step <= n / 2 ? step : step - n) * (360 / n)
    st.current.slot = slot
  }
  return st.current.deg
}

const CHIP: Record<ThreadState["kind"], string> = {
  idle: "bg-card text-muted-foreground",
  sleep: "border-transparent bg-sleep text-muted-foreground",
  wait: "border-wait-border bg-wait text-wait-foreground",
  work: "",
}

function Threads({ title, keys, states, owner, refs, consumer }: {
  title: string
  keys: string[]
  states: Map<string, ThreadState>
  owner?: string
  refs: Map<string, HTMLElement>
  consumer?: boolean
}) {
  const dense = keys.length > 6
  const work = consumer ? "border-consume/30 bg-consume/10 text-consume" : "border-produce/30 bg-produce-soft text-produce"
  return (
    <div className={cn("flex flex-col gap-2", consumer ? "md:items-start" : "md:items-end")}>
      <span className="text-xs text-muted-foreground">{title}</span>
      {keys.length === 0 && <span className="text-xs text-muted-foreground">байхгүй</span>}
      <div className={cn("flex flex-wrap gap-1.5", dense ? "md:grid md:grid-cols-2" : "md:flex-col")}>
        {keys.map((k) => {
          const s = states.get(k) ?? { kind: "idle", text: "" }
          return (
            <div
              key={k}
              ref={(el) => { if (el) refs.set(k, el); else refs.delete(k) }}
              title={`${k}: ${s.text}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors duration-150 motion-reduce:transition-none",
                s.kind === "work" ? work : CHIP[s.kind],
                owner === k && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                !dense && "md:w-36",
              )}
            >
              <span className="font-mono text-xs font-bold">{k}</span>
              {!dense && <span className="truncate text-[11px]">{s.text}</span>}
              {owner === k && <KeyRoundIcon className="ml-auto size-3 shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Jar({ label, value, n, full }: { label: string; value: number; n: number; full?: boolean }) {
  const shown = Math.max(0, Math.min(n, value))
  return (
    <div className="flex flex-col items-center gap-1" title={`${label} semaphore: ${value} токен. sem_wait нэгийг авна, 0 бол хүлээнэ.`}>
      <div className="flex min-h-24 w-12 flex-wrap-reverse content-start justify-center gap-1 rounded-b-xl border border-t-0 border-input px-1 pt-2 pb-1.5">
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border transition-colors duration-200 motion-reduce:transition-none",
              i < shown ? (full ? "border-produce bg-produce" : "border-foreground bg-foreground") : "border-dashed border-input",
            )}
          />
        ))}
      </div>
      <span className={cn("font-mono text-sm font-bold tabular-nums", (value < 0 || value > n) && "text-race")}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

interface Props {
  events: CoreEvent[]
  index: number
  model: Model
  onSeek: (i: number) => void
}

export function Stage({ events, index, model, onSeek }: Props) {
  const n = model.start?.buffer ?? 5
  const keys = model.lanes.map((l) => l.key)
  const producers = keys.filter((k) => k.startsWith("P"))
  const consumers = keys.filter((k) => k.startsWith("C"))
  const current = events[index]
  let snap: CoreEvent | undefined
  for (let i = Math.min(index, events.length - 1); i >= 0 && !snap; i--) if (events[i].empty !== undefined) snap = events[i]
  const { slots, produced, consumed } = bufferAt(events, index, n)
  const states = threadStates(events, index, keys)
  const race = model.races.get(index)
  const owner = current?.ev === "end" || current?.ev === "closed" ? undefined : snap?.mtx || undefined
  const racesSoFar = [...model.races.keys()].filter((i) => i <= index)
  const firstRace = model.races.keys().next().value
  const noMutex = model.start?.mutex === false
  const inDeg = useTurn(snap?.in, n)
  const outDeg = useTurn(snap?.out, n)

  const stage = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const chips = useRef(new Map<string, HTMLElement>())
  const prev = useRef(index)

  // Fly each produce/consume passed since the last render from the thread chip to its slot (or back).
  useEffect(() => {
    const from = prev.current
    prev.current = index
    if (index <= from || index - from > 8 || events.length > 600) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const box = stage.current?.getBoundingClientRect()
    const rr = ring.current?.getBoundingClientRect()
    if (!box || !rr) return
    for (let i = from + 1; i <= index; i++) {
      const e = events[i]
      const chip = e && chips.current.get(who(e))
      if (!chip || (e.ev !== "produce" && e.ev !== "consume") || e.slot === undefined || e.slot < 0) continue
      const cr = chip.getBoundingClientRect()
      const [sx, sy] = polar(mid(e.slot, n), R_MID)
      const slot = { x: rr.left - box.left + (sx * rr.width) / S, y: rr.top - box.top + (sy * rr.height) / S }
      const thread = { x: cr.left - box.left + cr.width / 2, y: cr.top - box.top + cr.height / 2 }
      const [a, b] = e.ev === "produce" ? [thread, slot] : [slot, thread]
      const el = document.createElement("span")
      el.textContent = String(e.item)
      el.className = cn(
        "pointer-events-none absolute top-0 left-0 z-30 flex size-8 items-center justify-center rounded-full font-mono text-xs font-bold text-white shadow-sm",
        e.ev === "produce" ? "bg-produce" : "bg-consume",
      )
      stage.current?.appendChild(el)
      el.animate(
        [
          { transform: `translate(${a.x - 16}px, ${a.y - 16}px) scale(0.7)`, opacity: 0.6 },
          { transform: `translate(${b.x - 16}px, ${b.y - 16}px) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${b.x - 16}px, ${b.y - 16}px) scale(0.9)`, opacity: 0 },
        ],
        { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" },
      ).finished.finally(() => el.remove())
    }
  }, [index, events, n])

  if (!events.length)
    return (
      <section className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-8 text-center">
        <p className="font-semibold">Одоогоор ажиллуулаагүй байна</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Тохиргоогоо сонгоод Start дар, эсвэл бэлэн туршилтын аль нэгийг сонго. Producer item-ийг тойрог буферт тавьж, consumer авахыг энд харна.
        </p>
      </section>
    )

  return (
    <section ref={stage} className="relative overflow-hidden rounded-lg border bg-card">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <Threads title="Producer · тавина" keys={producers} states={states} owner={owner} refs={chips.current} />

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end justify-center gap-3 sm:gap-5">
            <Jar label="empty" value={snap?.empty ?? n} n={n} />
            <div ref={ring} className="relative size-60 shrink-0 sm:size-64">
              <svg viewBox={`0 0 ${S} ${S}`} className="size-full" role="img" aria-label={`Тойрог буфер: ${slots.filter((v) => v !== null).length}/${n} дүүрэн`}>
                {slots.map((v, i) => {
                  const [tx, ty] = polar(mid(i, n), R_MID)
                  const [ix, iy] = polar(mid(i, n), R_IDX)
                  const hit = current?.slot === i && (current.ev === "produce" || current.ev === "consume")
                  return (
                    <g key={i}>
                      {n === 1 ? (
                        <circle cx={C} cy={C} r={R_MID} fill="none" strokeWidth={R_OUT - R_IN}
                          className={cn("transition-colors duration-200", v === null ? "stroke-muted" : "stroke-produce-soft")} />
                      ) : (
                        <path
                          d={sector(i, n)}
                          className={cn(
                            "stroke-[1.5] transition-colors duration-200 motion-reduce:transition-none",
                            v === null ? "fill-muted stroke-transparent" : "fill-produce-soft stroke-produce/40",
                            hit && (race ? "fill-race-soft stroke-race" : "stroke-foreground"),
                          )}
                        />
                      )}
                      {v !== null && (
                        <text key={`${i}-${v}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                          className="animate-in zoom-in-50 fade-in fill-produce font-mono text-[15px] font-bold duration-300 [transform-box:fill-box] [transform-origin:center]">
                          {v}
                        </text>
                      )}
                      <text x={ix} y={iy} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">{i}</text>
                    </g>
                  )
                })}
                {[{ deg: outDeg, cls: "stroke-consume" }, { deg: inDeg, cls: "stroke-produce" }].map(({ deg, cls }, k) => {
                  const [hx, hy] = polar(mid(0, n), R_IN - 6)
                  return (
                    <g key={k} style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px` }} className="transition-transform duration-300 ease-out motion-reduce:transition-none">
                      <line x1={C} y1={C} x2={hx} y2={hy} strokeWidth={3} strokeLinecap="round" className={cls} />
                      <circle cx={hx} cy={hy} r={4} className={cn(cls, "fill-card")} strokeWidth={2.5} />
                    </g>
                  )
                })}
                <circle cx={C} cy={C} r={5} className="fill-foreground" />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-14">
                {noMutex ? (
                  <span className="rounded-sm bg-race-soft px-1.5 text-[11px] font-semibold text-race">mutex байхгүй</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    <KeyRoundIcon className="size-3.5" />
                    {owner ?? <span className="font-medium text-muted-foreground">чөлөөтэй</span>}
                  </span>
                )}
              </div>
            </div>
            <Jar label="full" value={snap?.full ?? 0} n={n} full />
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-produce" />in [{snap?.in ?? 0}] дараагийн тавих</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-consume" />out [{snap?.out ?? 0}] дараагийн авах</span>
          </div>
        </div>

        <Threads title="Consumer · авна" keys={consumers} states={states} owner={owner} refs={chips.current} consumer />
      </div>

      <div className="flex flex-col gap-1 border-t px-4 py-3">
        <p className={cn("text-[15px] leading-snug font-semibold", race && "text-race")}>
          <span className="mr-2 font-mono text-xs font-normal text-muted-foreground tabular-nums">{((current?.t ?? 0) / 1000).toFixed(3)} с</span>
          {current && describe(current)}
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
