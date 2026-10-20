"use client"

import type { CSSProperties } from "react"
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface Props {
  count: number
  index: number
  t: number
  total: number
  running: boolean
  playing: boolean
  speed: number
  speedLocked?: boolean // a run too dense to follow plays at the slowest speed only
  onSpeed: (s: number) => void
  onTogglePlay: () => void
  onReplay: () => void
  onSeek: (i: number) => void
  onEnd?: () => void // at the last event "Дараагийн алхам" calls this instead of being disabled
}

const sec = (ms: number) => `${(ms / 1000).toFixed(2)} с`

// Lesson-style bottom bar: always on screen, a player scrubber on top, the big black button is the next step.
export function Transport({ count, index, t, total, running, playing, speed, speedLocked, onSpeed, onTogglePlay, onReplay, onSeek, onEnd }: Props) {
  const empty = count === 0
  const atEnd = !empty && index >= count - 1
  const progress = count > 1 ? (index / (count - 1)) * 100 : 0

  return (
    <div className="sticky bottom-0 z-40 border-t-2 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pt-3 pb-3 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{sec(t)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, count - 1)}
            step={1}
            value={empty ? 0 : index}
            disabled={empty}
            onChange={(e) => onSeek(e.target.valueAsNumber)}
            aria-label="Тоглуулах байрлал"
            aria-valuetext={`${sec(t)}, ${index + 1} / ${count} event`}
            style={{ "--p": `${progress}%` } as CSSProperties}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--now)_var(--p),var(--muted)_var(--p))] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-default [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-b-4 [&::-moz-range-thumb]:border-now-edge [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-b-4 [&::-webkit-slider-thumb]:border-now-edge [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&:disabled::-webkit-slider-thumb]:opacity-0"
          />
          <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{sec(total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToggleGroup type="single" size="sm" variant="outline" disabled={speedLocked} value={String(speed)} onValueChange={(v) => v && onSpeed(Number(v))} aria-label="Тоглуулах хурд (1× = бодит хугацаа)" title={speedLocked ? "Энэ run хэт хурдан тул хамгийн удаан хурдаар түгжигдсэн" : undefined}>
            {[0.1, 0.25, 0.5, 1].map((s) => (
              <ToggleGroupItem key={s} value={String(s)} className="px-2 font-mono text-xs">{s}×</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button size="sm" variant="ghost" disabled={running || empty} onClick={onReplay} aria-label="Replay">
            <RotateCcwIcon data-icon="inline-start" />
            <span className="max-sm:sr-only">Replay</span>
          </Button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums max-sm:hidden">{empty ? "" : `${index + 1} / ${count}`}</span>
          <div className="ml-auto flex gap-2">
            <Button size="lg" variant="outline" disabled={empty || index === 0} onClick={() => onSeek(index - 1)} aria-label="Өмнөх алхам (←)" className="px-4">
              <ArrowLeftIcon />
              <span className="max-sm:sr-only">Өмнөх</span>
            </Button>
            <Button size="lg" variant="outline" disabled={empty} onClick={onTogglePlay} aria-label={playing ? "Түр зогсоох (Space)" : "Тоглуулах (Space)"} className="px-4">
              {playing ? <PauseIcon /> : <PlayIcon />}
              <span className="max-sm:sr-only">{playing ? "Түр зогсоох" : "Тоглуулах"}</span>
            </Button>
            <Button size="lg" disabled={empty || (atEnd && !onEnd)} onClick={() => (atEnd ? onEnd?.() : onSeek(index + 1))} aria-label="Дараагийн алхам (→)">
              Дараагийн алхам
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
