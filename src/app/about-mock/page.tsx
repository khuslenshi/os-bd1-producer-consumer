import type { Metadata } from "next"
import { BackToMenu } from "@/components/back-to-menu"

export const metadata: Metadata = { title: "Тухай (mock) · Producer–Consumer" }

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 pt-6 pb-16">
      <BackToMenu />
      <header className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Тухай</span>
      </header>
    </main>
  )
}
