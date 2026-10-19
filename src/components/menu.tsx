"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GraduationCapIcon, InfoIcon, StarIcon, type LucideIcon } from "lucide-react"
import { snapAt } from "@/components/buffer-views"
import type { RunConfig } from "@/lib/config"
import { buildModel } from "@/lib/model"
import { lastAt, useRun } from "@/lib/use-run"
import { cn } from "@/lib/utils"

const ITEMS: { href: string; title: string; sub: string; icon: LucideIcon; tone: string; wide?: boolean }[] = [
  { href: "/learn", title: "Хичээл ба заавар", sub: "Алхам алхмаар заана, асуулттай", icon: GraduationCapIcon, tone: "border-now-edge bg-now" },
  { href: "/levels", title: "Түвшингүүд", sub: "3 даалгавар, төгсгөлд нь асуулт", icon: StarIcon, tone: "border-produce-edge bg-produce" },
  // Second row, full width: a smaller side entry.
  { href: "/about", title: "Тухай", sub: "Төсөл, баг, программ хэрхэн ажилладаг", icon: InfoIcon, tone: "border-black bg-foreground", wide: true },
]

// More producers than consumers so the strip is rarely empty.
const DEMO: RunConfig = { duration: 20, producers: 3, consumers: 2, buffer: 5, sleepMax: 900, seed: null, mutex: true }

// Title-screen "logo": the buffer of a real core run, playing on a loop.
function DemoStrip() {
  const { events, status, start } = useRun()
  const [cursor, setCursor] = useState(0)
  const clock = useRef(0)
  const live = useRef({ events, status })
  live.current = { events, status }
  const model = useMemo(() => buildModel(events), [events])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let restarting = false
    const tick = (now: number) => {
      const { events: ev, status: st } = live.current
      clock.current = Math.min(clock.current + (now - last) * 0.6, ev.at(-1)?.t ?? 0)
      last = now
      if (st === "done" && clock.current >= (ev.at(-1)?.t ?? 0) && !restarting) {
        restarting = true
        clock.current = 0
        start(DEMO).finally(() => { restarting = false })
      }
      setCursor(Math.max(0, lastAt(ev, clock.current)))
      raf = requestAnimationFrame(tick)
    }
    start(DEMO)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // mount once: the loop restarts the run itself
  }, [])

  const s = events.length ? snapAt(events, Math.min(cursor, events.length - 1), model) : null
  return (
    <div className="flex gap-2" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const v = s?.slots[i] ?? null
        return (
          <span
            key={i}
            className={cn(
              "tactile flex size-11 items-center justify-center rounded-xl text-sm font-bold transition-[background-color,border-color,transform] duration-200 sm:size-12",
              s?.hit === i ? "-translate-y-1 border-now-edge bg-now text-white" : v !== null ? "border-produce-edge bg-produce text-white" : "border-edge bg-muted",
            )}
          >
            {v}
          </span>
        )
      })}
    </div>
  )
}

export function Menu() {
  const router = useRouter()
  // null = nothing picked yet: a tile lights up only under the mouse or after an arrow key
  const [sel, setSel] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s === null ? 0 : (s + 1) % ITEMS.length)) }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setSel((s) => ((s ?? 0) + ITEMS.length - 1) % ITEMS.length) }
      else if (e.key === "Enter" && sel !== null && !(e.target as HTMLElement).closest("a, button")) router.push(ITEMS[sel].href)
      else if (/^[1-3]$/.test(e.key)) router.push(ITEMS[Number(e.key) - 1].href)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, sel])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-5 py-12 text-center">
      <div className="flex flex-col items-center gap-5">
        <DemoStrip />
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">F.CSM302 · Бүлэг 7 · II-4-12</span>
        <h1 className="text-5xl leading-[0.95] font-bold tracking-tight sm:text-7xl">
          Producer <span className="text-produce">Consumer</span>
        </h1>
        <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
          Талхчид тавиурт талх тавина, худалдан авагчид авна. Хэн хэзээ хүлээх ёстойг semaphore, mutex шийднэ.
        </p>
      </div>

      <nav className="grid w-full max-w-2xl gap-4 sm:grid-cols-2" aria-label="Үндсэн цэс">
        {ITEMS.map((it, i) => {
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              onMouseEnter={() => setSel(i)}
              onMouseLeave={() => setSel(null)}
              onFocus={() => setSel(i)}
              onBlur={() => setSel(null)}
              className={cn(
                "tactile flex items-center gap-4 rounded-3xl border-edge bg-background p-5 text-left transition-[transform,border-color] duration-100 hover:-translate-y-1 hover:border-foreground focus-visible:outline-none active:translate-y-0.5 active:border-b-2",
                it.wide ? "sm:col-span-2 sm:justify-center sm:py-4" : "sm:flex-col sm:items-center sm:gap-3 sm:p-7 sm:text-center",
                sel === i && "-translate-y-1 border-foreground",
              )}
            >
              <span className={cn("tactile flex size-12 shrink-0 items-center justify-center rounded-2xl text-white", !it.wide && "sm:size-14", it.tone)}>
                <Icon className="size-6" />
              </span>
              <span className="flex flex-col gap-1">
                <b className={cn("text-lg leading-tight", !it.wide && "sm:text-xl")}>{it.title}</b>
                <span className="text-[13px] text-muted-foreground">{it.sub}</span>
              </span>
            </Link>
          )
        })}
      </nav>
    </main>
  )
}
