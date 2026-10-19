import type { Metadata } from "next"
import { Tutorial } from "@/components/tutorial"

export const metadata: Metadata = { title: "Хичээл ба заавар · Producer–Consumer" }

export default function Page() {
  return <Tutorial />
}
