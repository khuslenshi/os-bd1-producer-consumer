"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeftIcon, ArrowRightIcon, SkipForwardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackToMenu } from "@/components/back-to-menu"
import { Narration } from "@/components/narration"
import { Quiz } from "@/components/quiz"
import { Stage, type Focus, type View } from "@/components/stage"
import type { RunConfig } from "@/lib/config"
import type { Quiz as QuizData } from "@/lib/levels"
import { buildModel, type CoreEvent } from "@/lib/model"
import { setSound, sfx } from "@/lib/sfx"
import { useRun } from "@/lib/use-run"
import { cn } from "@/lib/utils"

// Small, seeded run: 2 producers outpace 1 consumer on a 2-slot buffer, so every situation shows up early.
const CONFIG: RunConfig = { duration: 5, producers: 2, consumers: 1, buffer: 2, sleepMax: 700, seed: 3, mutex: true }

type Find = (ev: CoreEvent[], from: number) => number
const first = (pred: (e: CoreEvent) => boolean): Find => (ev, from) => {
  for (let i = from; i < ev.length; i++) if (pred(ev[i])) return i
  return -1
}

const C = ({ children }: { children: ReactNode }) => <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">{children}</code>

interface Step { id: string; find: Find; title: string; body: ReactNode; view: View; focus?: Focus; quiz?: QuizData }

const atStart = first((e) => e.ev === "start")

// First the idea with the bakery picture, then the same buffer as a computer sees it, then the real run step by step.
// id = narration clip public/audio/learn/<id>.m4a (made by video_src/learn_tts.py).
const STEPS: Step[] = [
  {
    id: "shop",
    find: atStart,
    title: "Талхны дэлгүүр",
    view: "bakery",
    focus: "buffer",
    body: <>Талхны дэлгүүр төсөөлье. Хоёр зайтай ганц <b>тавиур</b> байна, үүнийг <b>буфер</b> гэнэ. <b>Талхчид</b> (producer) талх хийж тавиурт тавина, <b>худалдан авагчид</b> (consumer) тавиураас авна.</>,
  },
  {
    id: "why",
    find: atStart,
    title: "Яагаад тавиур хэрэгтэй вэ?",
    view: "bakery",
    body: <>Талхчин, худалдан авагч хоёр өөр хурдтай ажилладаг. Тавиургүй бол талхчин худалдан авагч ирэхийг, худалдан авагч талх болохыг тухай бүр зогсоод хүлээнэ. Тавиур тэднийг салгаж, хоёулаа өөрийн хурдаар зэрэг ажиллах боломж олгоно.</>,
  },
  {
    id: "problems",
    find: atStart,
    title: "Гурван асуудал",
    view: "bakery",
    focus: "buffer",
    body: (
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li><b>Тавиур дүүрэн:</b> талхчин хоосон зай гартал хүлээх ёстой.</li>
        <li><b>Тавиур хоосон:</b> худалдан авагч шинэ талх иртэл хүлээх ёстой.</li>
        <li><b>Зэрэг хүрэх:</b> хоёр хүн нэг нүд рүү зэрэг тавибал нэг талх алга болно. Үүнийг <b>race condition</b> гэнэ.</li>
      </ol>
    ),
    quiz: { q: "Тавиур хоосон үед хэн хүлээх вэ?", options: ["Талхчин", "Худалдан авагч", "Хэн ч биш"], answer: 1, explain: "Авах талх алга тул худалдан авагч (consumer) шинэ талх иртэл хүлээнэ." },
  },
  {
    id: "computer",
    find: atStart,
    title: "Компьютер дээр",
    view: "queue",
    focus: "producers",
    body: <>Талхчин, худалдан авагч бүр нэг <C>pthread</C>: зүүн талд P1, P2, баруун талд C1. Талх нь тоо, тавиур нь 2 нүдтэй массив. Ийм буфер хаа сайгүй бий: гарын товчлуурын буфер, принтерийн дараалал, видео урьдчилан ачаалах буфер, <C>ls | grep</C> pipe. Энд харагдаж буй бүхэн бодит C программын хэвлэсэн event-ээс зурагдаж байгаа.</>,
  },
  {
    id: "tools",
    find: atStart,
    title: "Гурван багаж",
    view: "array",
    focus: "pills",
    body: <><b>empty</b> = хоосон нүдний тоо (анх 2). <b>full</b> = дүүрсэн нүдний тоо (анх 0). <b>mutex</b> = тавиурын түлхүүр, нэг удаад нэг thread. <C>sem_wait</C> тоог 1-ээр хасна, 0 байвал thread унтаж хүлээнэ. <C>sem_post</C> 1-ээр нэмж, хүлээж буй нэгийг сэрээнэ.</>,
    quiz: { q: "Тавиур бүтэн дүүрсэн үед empty хэд байх вэ?", options: ["0", "1", "2"], answer: 0, explain: "empty бол хоосон нүдний тоо. Дүүрэн тавиурт хоосон нүд алга тул 0, producer sem_wait(empty) дээр хүлээнэ." },
  },
  {
    id: "sleep",
    find: first((e) => e.ev === "sleep"),
    title: "Эхлээд унтана",
    view: "array",
    focus: "producers",
    body: <>Thread бүр 0–700 мс санамсаргүй унтаж, бодит ажлыг дуурайлгана. Унтаж байх үед буферт хүрэхгүй (critical section-ээс гадуур).</>,
  },
  {
    id: "wait_full",
    view: "array",
    find: first((e) => e.ev === "wait_full"),
    title: "Consumer хүлээх ёстой боллоо",
    focus: "consumers",
    body: <>Буфер хоосон тул <C>full = 0</C>. C1 <C>sem_wait(full)</C> дуудахад тоолуур 0 байгаа тул thread блоклогдож унтана. Producer нэг юм тавьж <C>sem_post(full)</C> хийх хүртэл сэрэхгүй.</>,
    quiz: { q: "C1-ийг хэн сэрээх вэ?", options: ["Өөр consumer", "Producer, sem_post(full)-аар", "Mutex"], answer: 1, explain: "full-ийг зөвхөн producer нэмдэг тул C1 producer тавих хүртэл хүлээнэ." },
  },
  {
    id: "produce",
    view: "array",
    find: first((e) => e.ev === "produce"),
    title: "Producer тавилаа",
    focus: "buffer",
    body: <><C>sem_wait(empty)</C> → mutex lock → <C>buffer[in] = item</C> → <C>in = (in + 1) % 2</C> → unlock → <C>sem_post(full)</C>. Ногоон нүд одоо хандсан тавиур, <b>▲in</b> дараагийн нүд рүү шилжсэнийг хар.</>,
    quiz: { q: "Тавьсны дараа full хэдээр нэмэгдэх вэ?", options: ["0", "1", "2"], answer: 1, explain: "Нэг item тавьсан тул sem_post(full) нэг удаа хийгдэж full 1-ээр нэмэгдэнэ." },
  },
  {
    id: "consume",
    view: "array",
    find: first((e) => e.ev === "consume"),
    title: "Consumer авлаа",
    focus: "buffer",
    body: <><C>sem_wait(full)</C> → lock → <C>item = buffer[out]</C> → <C>out = (out + 1) % 2</C> → unlock → <C>sem_post(empty)</C>. Хамгийн эрт тавьсныг эхэлж авна (FIFO), <b>▲out</b> урагшилна.</>,
  },
  {
    id: "wait_empty",
    view: "array",
    find: first((e) => e.ev === "wait_empty"),
    title: "Буфер дүүрлээ",
    focus: "producers",
    body: <>2 тавиур хоёулаа дүүрэн тул <C>empty = 0</C>. Producer <C>sem_wait(empty)</C> дээр блоклогдож, шар болж хүлээнэ.</>,
    quiz: { q: "Энэ producer хэзээ үргэлжлэх вэ?", options: ["Хэдэн мс унтсаны дараа өөрөө", "Consumer нэгийг авч sem_post(empty) хийхэд", "Хэзээ ч үгүй"], answer: 1, explain: "empty-г зөвхөн consumer нэмдэг. Тавиур суларсан даруйд хүлээж байсан producer сэрнэ." },
  },
  {
    id: "mutex",
    view: "array",
    find: first((e) => e.ev === "produce" && Boolean(e.mtx)),
    title: "Mutex: нэг удаад нэг",
    focus: "pills",
    body: <>Буферийг өөрчлөх хэсгийг (critical section) mutex хамгаална. Цоож барьсан thread л <C>in</C>, <C>out</C>, <C>count</C>-ийг өөрчилнө. Mutex-гүй бол юу болохыг Түвшин 3-т өөрөө үзнэ.</>,
  },
  {
    id: "end",
    view: "array",
    find: first((e) => e.ev === "end"),
    title: "Дууслаа!",
    focus: "pills",
    body: <>Тавьсан − авсан = буферт үлдсэн (invariant). Энэ тэнцэл биелж байгаа нь буфер зөв ажилласныг харуулна. Одоо түвшингүүдийг туршаад үз.</>,
  },
]

export function Tutorial() {
  const { events, status, errors, start } = useRun()
  const [step, setStep] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [moving, setMoving] = useState(false)
  const [solved, setSolved] = useState<Set<number>>(new Set())
  const timer = useRef(0)

  useEffect(() => {
    start(CONFIG)
    return () => clearTimeout(timer.current)
    // mount once: one recorded run drives the whole lesson
  }, [])

  useEffect(() => { setSound(true); return () => setSound(false) }, [])

  const ready = status === "done"
  const model = useMemo(() => buildModel(events), [events])
  const steps = useMemo(() => {
    if (!ready) return []
    const out: (Step & { index: number; clip: string })[] = []
    let from = 0
    for (const s of STEPS) {
      const i = s.find(events, from)
      if (i < 0) continue
      out.push({ ...s, index: i, clip: `/audio/learn/${s.id}.m4a` })
      from = i
    }
    return out
  }, [events, ready])

  const cur = steps[step]
  const last = step === steps.length - 1
  const blocked = Boolean(cur?.quiz) && !solved.has(step)

  useEffect(() => { if (cur) setCursor(cur.index) }, [cur])

  // Play the real events between this step and the next one by one, a beat each (puts and takes get the longest),
  // then land on the next step. Wall-clock time is ignored: 4 s of run with 18 puts/takes would be a blur.
  function advance() {
    const target = steps[step + 1]
    if (!target) return
    if (target.index === cursor) { setStep(step + 1); return } // concept steps share one moment of the run
    setMoving(true)
    let i = cursor
    const tick = () => {
      i++
      const ev = events[i].ev
      if (ev === "produce") sfx.produce()
      else if (ev === "consume") sfx.consume()
      else if (ev === "wait_empty" || ev === "wait_full") sfx.block()
      setCursor(i)
      if (i >= target.index) { setMoving(false); setStep(step + 1); return }
      timer.current = window.setTimeout(tick, ev === "produce" || ev === "consume" ? 700 : ev.startsWith("wait") ? 500 : 200)
    }
    timer.current = window.setTimeout(tick, 200)
  }

  function skip() {
    clearTimeout(timer.current)
    setCursor(steps[step + 1].index)
    setMoving(false)
    setStep(step + 1)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-6 lg:px-8">
      <BackToMenu />
      <header className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Хичээл ба заавар</span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Producer–Consumer алхам алхмаар</h1>
      </header>

      {!ready ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
          {errors.length ? (
            <p className="text-race">{errors.join(" ")}</p>
          ) : (
            <>
              <p className="text-xl font-bold">Жинхэнэ C программ ажиллаж байна…</p>
              <p className="text-muted-foreground">{events.length} event бичигдлээ. Дуусмагц хичээл эхэлнэ.</p>
              <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-now transition-[width]" style={{ width: `${Math.min(100, ((events.at(-1)?.t ?? 0) / (CONFIG.duration * 1000)) * 100)}%` }} />
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="grid flex-1 gap-6 pb-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <Stage events={events} index={cursor} model={model} speed={1} onSeek={() => {}} view={cur?.view} focus={moving ? undefined : cur?.focus} />

          <aside className="sticky bottom-0 z-30 -mx-4 flex max-h-[60dvh] flex-col gap-4 overflow-y-auto border-t-2 bg-background px-4 py-4 lg:top-6 lg:mx-0 lg:max-h-none lg:rounded-2xl lg:border-2 lg:p-6">
            <div className="flex gap-1.5" aria-label={`${step + 1} / ${steps.length} алхам`}>
              {steps.map((_, i) => (
                <i key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", i <= step && "bg-now")} />
              ))}
            </div>
            <span className="text-xs font-bold text-muted-foreground">{step + 1} / {steps.length}</span>
            <Narration src={moving ? null : (cur?.clip ?? null)} />
            <h2 className="text-2xl leading-tight font-bold tracking-tight">{cur?.title}</h2>
            <div className="text-[15px] leading-relaxed text-[#3b3f47]">{cur?.body}</div>
            {cur?.quiz && <Quiz key={step} quiz={cur.quiz} onWrong={sfx.wrong} onCorrect={() => { sfx.right(); setSolved((s) => new Set(s).add(step)) }} />}
            <div className="mt-2 flex gap-2">
              <Button size="icon-lg" variant="outline" disabled={step === 0 || moving} onClick={() => setStep(step - 1)} aria-label="Өмнөх алхам">
                <ArrowLeftIcon />
              </Button>
              {last ? (
                <Button asChild size="lg" className="flex-1">
                  <Link href="/levels">Түвшингүүд рүү<ArrowRightIcon data-icon="inline-end" /></Link>
                </Button>
              ) : (
                <Button size="lg" className="flex-1" disabled={blocked && !moving} onClick={moving ? skip : advance}>
                  {moving ? "Алгасах" : blocked ? "Эхлээд хариул" : "Үргэлжлүүлэх"}
                  {moving ? <SkipForwardIcon data-icon="inline-end" /> : <ArrowRightIcon data-icon="inline-end" />}
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
