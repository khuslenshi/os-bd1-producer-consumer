"use client"

import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface Props {
  count: number
  index: number
  t: number
  progress: number
  running: boolean
  playing: boolean
  speed: number
  onSpeed: (s: number) => void
  onTogglePlay: () => void
  onReplay: () => void
  onSeek: (i: number) => void
}

// Lesson-style bottom bar: always on screen, the big black button is the next step.
export function Transport({ count, index, t, progress, running, playing, speed, onSpeed, onTogglePlay, onReplay, onSeek }: Props) {
  const empty = count === 0

  return (
    <div className="sticky bottom-0 z-40 border-t-2 bg-background">
      <div className="h-1.5 bg-muted">
        <div className="h-full rounded-r-full bg-now transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:px-8">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {empty ? "0 / 0" : `${(t / 1000).toFixed(3)} с · ${index + 1} / ${count}`}
        </span>
        <ToggleGroup type="single" size="sm" variant="outline" value={String(speed)} onValueChange={(v) => v && onSpeed(Number(v))} aria-label="Тоглуулах хурд (1× = бодит хугацаа)">
          {[0.1, 0.25, 0.5, 1].map((s) => (
            <ToggleGroupItem key={s} value={String(s)} className="px-2 font-mono text-xs">{s}×</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button size="sm" variant="ghost" disabled={running || empty} onClick={onReplay} aria-label="Replay">
          <RotateCcwIcon data-icon="inline-start" />
          <span className="max-sm:sr-only">Replay</span>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="lg" variant="outline" disabled={empty || index === 0} onClick={() => onSeek(index - 1)} aria-label="Өмнөх алхам (←)" className="px-4">
            <ArrowLeftIcon />
            <span className="max-sm:sr-only">Өмнөх</span>
          </Button>
          <Button size="lg" variant="outline" disabled={empty} onClick={onTogglePlay} aria-label={playing ? "Түр зогсоох (Space)" : "Тоглуулах (Space)"} className="px-4">
            {playing ? <PauseIcon /> : <PlayIcon />}
            <span className="max-sm:sr-only">{playing ? "Түр зогсоох" : "Тоглуулах"}</span>
          </Button>
          <Button size="lg" disabled={empty || index >= count - 1} onClick={() => onSeek(index + 1)} aria-label="Дараагийн алхам (→)">
            Дараагийн алхам
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  )
}
