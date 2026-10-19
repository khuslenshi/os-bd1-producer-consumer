"use client"

import { useEffect, useRef } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { describe, type CoreEvent, type Model } from "@/lib/model"
import { cn } from "@/lib/utils"

// ponytail: only the last 300 played events are rendered; the full run is in the JSONL download
const SHOWN = 300

function download(events: CoreEvent[]) {
  const blob = new Blob([events.map((e) => JSON.stringify(e)).join("\n") + "\n"], { type: "application/x-ndjson" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `producer-consumer-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.jsonl`
  a.click()
  URL.revokeObjectURL(a.href)
}

interface Props {
  events: CoreEvent[]
  index: number
  model: Model
  onSeek: (i: number) => void
  className?: string
}

export function EventLog({ events, index, model, onSeek, className }: Props) {
  const list = useRef<HTMLOListElement>(null)
  const from = Math.max(0, index - SHOWN + 1)
  const rows = events.length ? events.slice(from, index + 1) : []

  // The newest played line sits at the bottom; keep it in view as playback moves.
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [index, rows.length])

  return (
    <section className={cn("flex h-80 flex-col overflow-hidden rounded-2xl border-2 bg-background lg:h-auto lg:min-h-80", className)}>
      <div className="flex items-center gap-3 border-b-2 px-4 py-2">
        <h2 className="text-[15px] font-bold">Event log</h2>
        {events.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{index + 1} / {events.length}</span>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!events.length} onClick={() => download(events)}>
          <DownloadIcon data-icon="inline-start" />
          JSONL
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {events.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Run эхлэхэд thread бүрийн үйлдэл энд мөр мөрөөр бичигдэнэ.</p>
        ) : (
          <ol ref={list} className="absolute inset-0 overflow-y-auto px-1 py-1 font-mono text-xs">
            {from > 0 && <li className="px-4 py-1 text-muted-foreground">… өмнөх {from} event (бүгдийг JSONL-ээр татна)</li>}
            {rows.map((e, k) => {
              const i = from + k
              const race = model.races.get(i)
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSeek(i)}
                    className={cn(
                      "flex w-full gap-2 rounded-lg px-3 py-1 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      i === index && "bg-produce-soft font-semibold text-produce-edge",
                      (e.ev === "wait_empty" || e.ev === "wait_full") && "text-wait-foreground",
                      (e.ev === "start" || e.ev === "end" || e.ev === "closed") && "font-semibold",
                      race && "text-race",
                    )}
                  >
                    <span className="w-11 shrink-0 text-muted-foreground tabular-nums">{(e.t / 1000).toFixed(3)}</span>
                    <span className={cn("w-3 shrink-0", e.ev === "produce" && "text-produce", e.ev === "consume" && "text-consume")}>
                      {e.ev === "produce" ? "↓" : e.ev === "consume" ? "↑" : ""}
                    </span>
                    <span>{describe(e)}{race && ` · ${race}`}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
