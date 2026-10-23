import type { Metadata } from "next"
import Image from "next/image"
import { BackToMenu } from "@/components/back-to-menu"

export const metadata: Metadata = { title: "Тухай (mock) · Producer–Consumer" }

const FLOW = [
  ["C core", "src/core/pc.c", "pthreads + semaphore (empty, full) + mutex. Thread бүрийн үйлдэл бүрийг нэг JSON мөр болгон хэвлэнэ."],
  ["Next.js route", "src/app/api/run", "Start дарахад core-ийг шинэ процесс болгон ажиллуулж, мөрүүдийг browser руу шууд дамжуулна. Stop эсвэл хуудсаа хаавал процесс зогсоно."],
  ["Browser", "src/components", "Event бүрийг буфер, thread chip, timeline, log болгон зурна. Зөвхөн харуулна, синхрончлол бүхэлдээ C дотор явагдана."],
] as const

// Team II-4-12; photos in public/team/<student code>.jpg
const TEAM = [
  ["А.Эрхэмтөр", "B241940029"],
  ["Б.Хүслэн", "B242270107"],
  ["Н.Батмөрөөдөл", "B231910039"],
  ["Г.Оюунгэрэл", "B232270802"],
  ["С.Итгэл", "B242270031"],
] as const

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 pt-6 pb-16">
      <BackToMenu />
      <header className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Тухай</span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Producer–Consumer</h1>
        <p className="text-[15px] text-muted-foreground">
          F.CSM302 Үйлдлийн систем · Бие даалт 1 · Баг II-4-12 · Сэдэв 12. Сурах бичиг: <i>Operating System Concepts</i>, 7-р бүлэг (Synchronization Examples), Programming Project &quot;The Producer-Consumer Problem&quot;.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Баг II-4-12</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TEAM.map(([name, code]) => (
            <li key={code} className="tactile flex flex-col overflow-hidden rounded-2xl border-edge">
              <Image src={`/team/${code}.jpg`} alt={name} width={240} height={300} unoptimized className="aspect-[4/5] w-full bg-muted object-cover object-top" />
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <b className="text-sm leading-tight">{name}</b>
                <span className="font-mono text-xs text-muted-foreground">{code}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Хэрхэн ажилладаг вэ</h2>
        <ol className="flex flex-col gap-3">
          {FLOW.map(([title, path, text], i) => (
            <li key={title} className="tactile flex gap-4 rounded-2xl border-edge p-4">
              <div className="flex flex-col gap-1">
                <b>{title}</b>
                <p className="text-[15px] text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
