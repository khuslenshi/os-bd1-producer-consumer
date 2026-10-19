"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GraduationCapIcon, InfoIcon, PlayIcon, SlidersHorizontalIcon, StarIcon, type LucideIcon } from "lucide-react"
import { ArrayView, snapAt } from "@/components/buffer-views"
import type { RunConfig } from "@/lib/config"
import { buildModel, threadStates } from "@/lib/model"
import { lastAt, useRun } from "@/lib/use-run"
import { cn } from "@/lib/utils"

const ITEMS: { href: string; title: string; sub: string; icon: LucideIcon; tone: string }[] = [
  { href: "/learn", title: "Хичээл", sub: "Алхам алхмаар заана, асуулттай", icon: GraduationCapIcon, tone: "border-now-edge bg-now" },
  { href: "/levels", title: "Түвшингүүд", sub: "3 даалгавар, төгсгөлд нь асуулт", icon: StarIcon, tone: "border-produce-edge bg-produce" },
  { href: "/play", title: "Чөлөөт горим", sub: "Бүх тохиргоог өөрөө сонгоно", icon: SlidersHorizontalIcon, tone: "border-consume-edge bg-consume" },
  { href: "/about", title: "Тухай", sub: "Баг, C core хэрхэн ажилладаг", icon: InfoIcon, tone: "border-[#7d838c] bg-[#9aa0a8]" },
]

const DEMO: RunConfig = { duration: 20, producers: 2, consumers: 2, buffer: 5, sleepMax: 900, seed: null, mutex: true }

// Attract mode: a real core run plays behind the menu and restarts when it ends.
function Demo() {
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
      clock.current += (now - last) * 0.6
      last = now
      const end = ev.at(-1)?.t ?? 0
      if (clock.current > end) clock.current = end
      if (st === "done" && clock.current >= end && !restarting) {
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

  if (!events.length) return <p className="text-sm text-muted-foreground">Demo ачаалж байна…</p>
  const index = Math.min(cursor, events.length - 1)
  const s = snapAt(events, index, model)
  const states = threadStates(events, index, model.lanes.map((l) => l.key))
  const chip = (k: string) => {
    const st = states.get(k)
    return (
      <span
        key={k}
        className={cn(
          "tactile rounded-xl px-3 py-1.5 text-[13px] transition-colors duration-150",
          st?.kind === "work" ? (k.startsWith("P") ? "border-now-edge bg-now text-white" : "border-consume-edge bg-consume text-white")
          : st?.kind === "wait" ? "border-wait-border bg-wait text-wait-foreground"
          : "border-edge bg-background text-muted-foreground",
        )}
      >
        <b>{k}</b> {st?.text}
      </span>
    )
  }
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5" aria-hidden>
      <div className="flex flex-wrap justify-center gap-2">{model.lanes.filter((l) => l.key.startsWith("P")).map((l) => chip(l.key))}</div>
      <ArrayView s={s} />
      <div className="flex flex-wrap justify-center gap-2">{model.lanes.filter((l) => l.key.startsWith("C")).map((l) => chip(l.key))}</div>
    </div>
  )
}

export function Menu() {
  const router = useRouter()
  const [sel, setSel] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % ITEMS.length) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s + ITEMS.length - 1) % ITEMS.length) }
      else if (e.key === "Enter" && !(e.target as HTMLElement).closest("a, button")) router.push(ITEMS[sel].href)
      else if (/^[1-4]$/.test(e.key)) router.push(ITEMS[Number(e.key) - 1].href)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, sel])

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-7 px-6 py-10 sm:px-12 lg:py-14">
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">F.CSM302 · Бүлэг 7 · II-4-12</span>
        <h1 className="text-5xl leading-[0.95] font-bold tracking-tight sm:text-6xl">
          Producer
          <br />
          <span className="text-produce">Consumer</span>
        </h1>
        <p className="max-w-md text-base text-muted-foreground">
          Талхчид тавиурт талх тавина, худалдан авагчид авна. Хэн хэзээ хүлээх ёстойг semaphore, mutex шийднэ.
        </p>

        <nav className="flex max-w-md flex-col gap-3" aria-label="Үндсэн цэс">
          {ITEMS.map((it, i) => {
            const Icon = it.icon
            return (
              <Link
                key={it.href}
                href={it.href}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                className={cn(
                  "tactile flex items-center gap-4 rounded-2xl border-edge bg-background px-4 py-3.5 transition-[transform,border-color] duration-100 focus-visible:outline-none active:translate-y-0.5 active:border-b-2",
                  sel === i && "-translate-y-0.5 border-foreground",
                )}
              >
                <span className={cn("tactile flex size-10 shrink-0 items-center justify-center rounded-xl text-white", it.tone)}>
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <b className="text-lg leading-tight">{it.title}</b>
                  <span className="text-[13px] text-muted-foreground">{it.sub}</span>
                </span>
                <span className={cn("ml-auto rounded-md border-2 px-1.5 text-[11px] text-muted-foreground max-sm:hidden", sel === i && "border-foreground bg-foreground text-background")}>
                  {sel === i ? "Enter" : i + 1}
                </span>
              </Link>
            )
          })}
        </nav>
        <p className="mt-auto flex gap-4 text-xs text-muted-foreground max-sm:hidden">
          <span>↑ ↓ сонгох</span><span>Enter нээх</span><span>Esc цэс рүү буцах</span>
        </p>
      </div>

      <div className="relative flex min-h-80 flex-col items-center justify-center gap-4 border-t-2 bg-band px-6 py-12 lg:border-t-0 lg:border-l-2">
        <span className="absolute top-5 right-6 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          <PlayIcon className="size-3 fill-current" /> demo · бодит C core
        </span>
        <Demo />
      </div>
    </main>
  )
}
