"use client"

import { DownloadIcon, PauseIcon, PlayIcon, RotateCcwIcon, ScrollTextIcon, StepBackIcon, StepForwardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { describe, type CoreEvent, type Model } from "@/lib/model"
import { cn } from "@/lib/utils"

interface Props {
  events: CoreEvent[]
  index: number
  model: Model
  running: boolean
  playing: boolean
  speed: number
  onSpeed: (s: number) => void
  onTogglePlay: () => void
  onReplay: () => void
  onSeek: (i: number) => void
}

function download(events: CoreEvent[]) {
  const blob = new Blob([events.map((e) => JSON.stringify(e)).join("\n") + "\n"], { type: "application/x-ndjson" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `producer-consumer-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.jsonl`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function Transport({ events, index, model, running, playing, speed, onSpeed, onTogglePlay, onReplay, onSeek }: Props) {
  const empty = events.length === 0
  const moving = playing
  const from = Math.max(0, index - 100)

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <Button size="icon-sm" variant="ghost" disabled={empty} onClick={() => onSeek(index - 1)} aria-label="Өмнөх event (←)">
        <StepBackIcon />
      </Button>
      <Button size="icon-sm" variant="outline" disabled={empty} onClick={onTogglePlay} aria-label={moving ? "Түр зогсоох (Space)" : "Тоглуулах (Space)"}>
        {moving ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button size="icon-sm" variant="ghost" disabled={empty} onClick={() => onSeek(index + 1)} aria-label="Дараагийн event (→)">
        <StepForwardIcon />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroup type="single" size="sm" variant="outline" value={String(speed)} onValueChange={(v) => v && onSpeed(Number(v))}>
            {[0.25, 0.5, 1, 2].map((s) => (
              <ToggleGroupItem key={s} value={String(s)} className="px-2 font-mono text-xs">{s}×</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </TooltipTrigger>
        <TooltipContent>Тоглуулах хурд: 1× = бодит хугацаа</TooltipContent>
      </Tooltip>
      <Button size="sm" variant="ghost" disabled={running || empty} onClick={onReplay}>
        <RotateCcwIcon data-icon="inline-start" />
        Replay
      </Button>

      <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
        {empty ? "0 / 0" : `${index + 1} / ${events.length}`}
      </span>

      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="ghost" disabled={empty}>
            <ScrollTextIcon data-icon="inline-start" />
            Log
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-full sm:max-w-md"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const row = document.getElementById("log-current")
            row?.scrollIntoView({ block: "center" })
            row?.querySelector("button")?.focus({ preventScroll: true })
          }}
        >
          <SheetHeader>
            <SheetTitle>Event log</SheetTitle>
            <SheetDescription>Playhead-ийн орчмын event-үүд. Дарж тэр агшин руу очно.</SheetDescription>
          </SheetHeader>
          <ol className="flex flex-col overflow-y-auto px-2 pb-4 font-mono text-xs">
            {events.slice(from, index + 101).map((e, k) => {
              const i = from + k
              const race = model.races.get(i)
              return (
                <li key={i} id={i === index ? "log-current" : undefined}>
                  <button
                    type="button"
                    onClick={() => onSeek(i)}
                    className={cn(
                      "flex w-full gap-3 rounded-sm px-2 py-1 text-left hover:bg-muted",
                      i === index && "bg-muted font-semibold",
                      (e.ev === "wait_empty" || e.ev === "wait_full") && "text-wait-foreground",
                      race && "text-race",
                    )}
                  >
                    <span className="w-14 shrink-0 text-muted-foreground tabular-nums">{(e.t / 1000).toFixed(3)}</span>
                    <span>{describe(e)}{race && ` · ${race}`}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </SheetContent>
      </Sheet>
      <Button size="sm" variant="ghost" disabled={empty} onClick={() => download(events)}>
        <DownloadIcon data-icon="inline-start" />
        JSONL
      </Button>
    </div>
  )
}
