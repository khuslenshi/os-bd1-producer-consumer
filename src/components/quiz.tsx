"use client"

import { useState } from "react"
import { CheckIcon, XIcon } from "lucide-react"
import type { Quiz as QuizData } from "@/lib/levels"
import { cn } from "@/lib/utils"

// Pick an answer; a wrong pick is marked and can be retried, the right one shows the explanation.
export function Quiz({ quiz, onCorrect }: { quiz: QuizData; onCorrect?: () => void }) {
  const [picked, setPicked] = useState<number[]>([])
  const solved = picked.includes(quiz.answer)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-muted-foreground">Асуулт: {quiz.q}</p>
      {quiz.options.map((o, i) => {
        const tried = picked.includes(i)
        const right = i === quiz.answer
        return (
          <button
            key={o}
            type="button"
            disabled={solved || tried}
            onClick={() => {
              setPicked((p) => [...p, i])
              if (right) onCorrect?.()
            }}
            className={cn(
              "tactile flex items-center gap-2 rounded-xl border-edge bg-background px-4 py-2.5 text-left text-sm font-semibold transition-[transform,background-color] duration-100 enabled:hover:bg-muted enabled:active:translate-y-0.5 enabled:active:border-b-2 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              tried && right && "border-now-edge bg-now-soft text-now-edge",
              tried && !right && "border-race bg-race-soft text-race",
            )}
          >
            {tried && (right ? <CheckIcon className="size-4 shrink-0" /> : <XIcon className="size-4 shrink-0" />)}
            {o}
          </button>
        )
      })}
      {solved && <p className="rounded-xl bg-now-soft px-4 py-3 text-sm text-now-edge">Зөв! {quiz.explain}</p>}
      {!solved && picked.length > 0 && <p className="text-sm text-race">Буруу байна, дахин оролдоорой.</p>}
    </div>
  )
}
