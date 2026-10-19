"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckIcon, InfinityIcon } from "lucide-react"
import { BackToMenu } from "@/components/back-to-menu"
import { LEVELS, readDone } from "@/lib/levels"
import { cn } from "@/lib/utils"

const TONE = ["border-produce-edge bg-produce", "border-produce-edge bg-produce", "border-race-edge bg-race"]

export function LevelsList() {
  const [done, setDone] = useState<number[]>([])
  useEffect(() => setDone(readDone()), [])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-6 pb-12 lg:px-8">
      <BackToMenu />
      <header className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Түвшингүүд</span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Даалгавраа сонго</h1>
        <p className="text-[15px] text-muted-foreground">Түвшин бүр бэлэн тохиргоотой. Run-ийг ажиллуулж ажиглаад, төгсгөлд нь асуултад хариулна.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((l, i) => (
          <Link
            key={l.id}
            href={`/levels/${l.id}`}
            className="tactile group flex flex-col gap-3 rounded-2xl border-edge bg-background p-5 transition-[transform,border-color] duration-100 hover:-translate-y-0.5 hover:border-foreground focus-visible:border-foreground focus-visible:outline-none active:translate-y-0.5 active:border-b-2"
          >
            <span className={cn("tactile flex size-10 items-center justify-center rounded-xl text-lg font-bold text-white", TONE[i])}>{l.id}</span>
            <b className="text-lg leading-tight">{l.title}</b>
            <span className="text-sm text-muted-foreground">{l.goal}</span>
            <span className={cn("mt-auto flex items-center gap-1.5 pt-2 text-sm font-semibold", done.includes(l.id) ? "text-now-edge" : "text-muted-foreground")}>
              {done.includes(l.id) ? <><CheckIcon className="size-4" /> Дууссан</> : "Эхлэх →"}
            </span>
          </Link>
        ))}
        <Link
          href="/play"
          className="tactile flex flex-col gap-3 rounded-2xl border-edge bg-background p-5 transition-[transform,border-color] duration-100 hover:-translate-y-0.5 hover:border-foreground focus-visible:border-foreground focus-visible:outline-none active:translate-y-0.5 active:border-b-2"
        >
          <span className="tactile flex size-10 items-center justify-center rounded-xl border-consume-edge bg-consume text-white"><InfinityIcon className="size-5" /></span>
          <b className="text-lg leading-tight">Өөрийн туршилт</b>
          <span className="text-sm text-muted-foreground">Чөлөөт горимд producer, consumer, буфер, хурд, mutex-ийг өөрөө сонгоно.</span>
          <span className="mt-auto pt-2 text-sm font-semibold text-muted-foreground">Нээх →</span>
        </Link>
      </div>
    </main>
  )
}
