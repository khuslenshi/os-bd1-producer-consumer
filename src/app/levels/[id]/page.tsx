import { notFound } from "next/navigation"
import { Simulator } from "@/components/simulator"
import { LEVELS } from "@/lib/levels"

export function generateStaticParams() {
  return LEVELS.map((l) => ({ id: String(l.id) }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const level = LEVELS.find((l) => String(l.id) === id)
  return { title: level ? `Түвшин ${level.id}: ${level.title} · Producer–Consumer` : "Producer–Consumer" }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const level = LEVELS.find((l) => String(l.id) === id)
  if (!level) notFound()
  return <Simulator key={level.id} level={level} />
}
