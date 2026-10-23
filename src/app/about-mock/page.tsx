import type { Metadata } from "next"
import { BackToMenu } from "@/components/back-to-menu"

export const metadata: Metadata = { title: "Тухай (mock) · Producer–Consumer" }

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
    </main>
  )
}
