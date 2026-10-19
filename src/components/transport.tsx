"use client"

import { PauseIcon, PlayIcon, RotateCcwIcon, StepBackIcon, StepForwardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  count: number
  index: number
  running: boolean
  playing: boolean
  speed: number
  onSpeed: (s: number) => void
  onTogglePlay: () => void
  onReplay: () => void
  onSeek: (i: number) => void
}

export function Transport({ count, index, running, playing, speed, onSpeed, onTogglePlay, onReplay, onSeek }: Props) {
  const empty = count === 0

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <Button size="icon-sm" variant="ghost" disabled={empty} onClick={() => onSeek(index - 1)} aria-label="Өмнөх event (←)">
        <StepBackIcon />
      </Button>
      <Button size="icon-sm" variant="outline" disabled={empty} onClick={onTogglePlay} aria-label={playing ? "Түр зогсоох (Space)" : "Тоглуулах (Space)"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button size="icon-sm" variant="ghost" disabled={empty} onClick={() => onSeek(index + 1)} aria-label="Дараагийн event (→)">
        <StepForwardIcon />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroup type="single" size="sm" variant="outline" value={String(speed)} onValueChange={(v) => v && onSpeed(Number(v))}>
            {[0.1, 0.25, 0.5, 1].map((s) => (
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
        {empty ? "0 / 0" : `${index + 1} / ${count}`}
      </span>
    </div>
  )
}
