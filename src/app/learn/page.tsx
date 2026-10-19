import type { Metadata } from "next"
import { Tutorial } from "@/components/tutorial"

export const metadata: Metadata = { title: "Хичээл · Producer–Consumer" }

export default function Page() {
  return <Tutorial />
}
