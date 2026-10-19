import type { Metadata } from "next"
import localFont from "next/font/local"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const gilroy = localFont({
  src: [
    { path: "./fonts/GIP-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GIP-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/GIP-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Producer–Consumer",
  description: "Bounded buffer: pthreads + semaphore-ийн бодит ажиллагааг thread бүрийн timeline-аар харуулна",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn">
      <body className={gilroy.variable}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  )
}
