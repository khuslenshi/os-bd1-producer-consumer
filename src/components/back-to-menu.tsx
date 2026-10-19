"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

// "← Цэс" link plus Esc to go back to the title menu, like a game.
export function BackToMenu({ href = "/", label = "Цэс" }: { href?: string; label?: string }) {
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return
      router.push(href)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, href])

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <ArrowLeftIcon className="size-4" />
      {label}
      <span className="ml-1 rounded-md border-2 px-1.5 text-[11px] leading-4 max-sm:hidden">Esc</span>
    </Link>
  )
}
