"use client"

import { useState, type ReactNode } from "react"
import { ArrowLeftIcon, ArrowRightIcon, ChefHatIcon, CircleHelpIcon, PlayIcon, SkipForwardIcon, UserRoundIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Narration } from "@/components/narration"
import { cn } from "@/lib/utils"

const Loaf = ({ n }: { n: number }) => (
  <span className="flex h-7 w-10 items-center justify-center rounded-t-full rounded-b-md bg-bread text-xs font-bold text-[#5a3a12] shadow-[inset_0_-3px_0_var(--bread-crust)]">{n}</span>
)

const Actor = ({ icon: Icon, label, tone }: { icon: typeof ChefHatIcon; label: string; tone: string }) => (
  <span className="flex flex-col items-center gap-1.5">
    <span className={cn("tactile flex size-14 items-center justify-center rounded-2xl text-white", tone)}><Icon className="size-7" /></span>
    <b className="text-sm">{label}</b>
  </span>
)

const Arrow = () => <ArrowRightIcon className="size-5 shrink-0 text-muted-foreground" />

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="tactile flex size-9 shrink-0 items-center justify-center rounded-xl border-edge bg-background text-sm font-bold">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

// Shown while the lesson's real run is recorded: what this is, what you will learn, how to use the page.
// id = narration clip public/audio/learn/<id>.m4a (video_src/learn_tts.py).
const SLIDES: { id: string; title: string; art?: ReactNode; body: ReactNode }[] = [
  {
    id: "welcome",
    title: "Тавтай морил!",
    art: (
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <Actor icon={ChefHatIcon} label="Талхчин" tone="border-produce-edge bg-produce" />
        <Arrow />
        <span className="flex gap-1.5 rounded-2xl border-[3px] border-shelf bg-[#fbf4ea] p-2"><Loaf n={7} /><Loaf n={42} /></span>
        <Arrow />
        <Actor icon={UserRoundIcon} label="Авагч" tone="border-consume-edge bg-consume" />
      </div>
    ),
    body: <>Энэ хичээлээр үйлдлийн системийн хамгийн алдартай синхрончлолын бодлого болох <b>Producer–Consumer</b>-ийг 12 алхмаар үзнэ. Талхны дэлгүүрийн энгийн жишээнээс эхлээд semaphore, mutex хүртэл. Ойролцоогоор 5 минут.</>,
  },
  {
    id: "goals",
    title: "Юу сурах вэ?",
    body: (
      <ol className="flex flex-col gap-3">
        <Row icon="1">Буфер яагаад хэрэгтэй вэ</Row>
        <Row icon="2">Гурван асуудал: буфер дүүрэх, хоосрох, хоёр thread зэрэг хүрэх (race condition)</Row>
        <Row icon="3">Тэдгээрийг шийддэг <b>empty</b>, <b>full</b> semaphore ба <b>mutex</b></Row>
        <Row icon="4">Бодит C программын ажиллагааг алхам алхмаар</Row>
      </ol>
    ),
  },
  {
    id: "howto",
    title: "Хэрхэн ашиглах вэ?",
    body: (
      <ul className="flex flex-col gap-3">
        <Row icon={<PlayIcon className="size-4" />}>Алхам бүрийг уншиж өгнө. Тоглуулагчаар зогсоож, дахин сонсож болно.</Row>
        <Row icon={<ArrowRightIcon className="size-4" />}><b>Үргэлжлүүлэх</b>: дараагийн алхам. Хооронд нь бодит event-үүд тоглогдоно.</Row>
        <Row icon={<SkipForwardIcon className="size-4" />}><b>Алгасах</b>: тоглож буй хэсгийг алгасна.</Row>
        <Row icon={<CircleHelpIcon className="size-4" />}>Зарим алхамд асуулт бий, зөв хариулсны дараа үргэлжилнэ.</Row>
      </ul>
    ),
  },
]

export function TutorialIntro({ ready, progress, error, onDone }: { ready: boolean; progress: number; error?: string; onDone: () => void }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1
  return (
    <section className="flex flex-1 items-start justify-center py-8 sm:items-center">
      <div className="tactile flex w-full max-w-2xl flex-col gap-5 rounded-3xl border-edge bg-background p-6 sm:p-8">
        <div className="flex gap-1.5" aria-label={`Оршил ${i + 1} / ${SLIDES.length}`}>
          {SLIDES.map((_, k) => <i key={k} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", k <= i && "bg-produce")} />)}
        </div>
        <span className="text-xs font-bold text-muted-foreground">Оршил · {i + 1} / {SLIDES.length}</span>
        <Narration src={`/audio/learn/${s.id}.m4a`} />
        {s.art && <div className="rounded-2xl bg-band py-6">{s.art}</div>}
        <h2 className="text-3xl leading-tight font-bold tracking-tight">{s.title}</h2>
        <div className="text-base leading-relaxed text-[#3b3f47]">{s.body}</div>
        <div className="mt-2 flex gap-2">
          <Button size="icon-lg" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Өмнөх">
            <ArrowLeftIcon />
          </Button>
          {!last ? (
            <Button size="lg" className="flex-1" onClick={() => setI(i + 1)}>
              Үргэлжлүүлэх<ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button size="lg" className="relative flex-1 overflow-hidden" disabled={!ready} onClick={onDone}>
              {/* The lesson's real run is still being recorded: the button fills up as it goes. */}
              {!ready && <span className="absolute inset-y-0 left-0 bg-white/20 transition-[width]" style={{ width: `${progress}%` }} />}
              {ready ? "Хичээл эхлүүлэх" : "C программ ажиллаж байна…"}
              {ready && <ArrowRightIcon data-icon="inline-end" />}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-race">{error}</p>}
      </div>
    </section>
  )
}
