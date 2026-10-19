import type { Metadata } from "next"
import { LevelsList } from "@/components/levels-list"

export const metadata: Metadata = { title: "Түвшингүүд · Producer–Consumer" }

export default function Page() {
  return <LevelsList />
}
