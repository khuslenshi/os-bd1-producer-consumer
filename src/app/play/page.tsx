import type { Metadata } from "next"
import { Simulator } from "@/components/simulator"

export const metadata: Metadata = { title: "Чөлөөт горим · Producer–Consumer" }

export default function Page() {
  return <Simulator />
}
