"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

// The step's voice-over with its own little player: play/pause and a seek slider.
export function Narration({ src }: { src: string | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const a = ref.current
    if (!a || !src) return
    a.src = src
    setT(0)
    a.play().catch(() => {}) // autoplay blocked: the play button is right here
    return () => a.pause()
  }, [src])

  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => { setT(ref.current?.currentTime ?? 0); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={ref}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
      />
      <Button size="icon-sm" variant="outline" disabled={!src} onClick={() => { const a = ref.current; if (a?.paused) a.play().catch(() => {}); else a?.pause() }} aria-label={playing ? "Уншлагыг зогсоох" : "Уншлагыг тоглуулах"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={0.01}
        value={t}
        disabled={!src || !dur}
        onChange={(e) => { if (ref.current) ref.current.currentTime = e.target.valueAsNumber; setT(e.target.valueAsNumber) }}
        aria-label="Уншлагын байрлал"
        style={{ "--p": `${dur ? (t / dur) * 100 : 0}%` } as CSSProperties}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--now)_var(--p),var(--muted)_var(--p))] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-default [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-b-4 [&::-moz-range-thumb]:border-now-edge [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-b-4 [&::-webkit-slider-thumb]:border-now-edge [&::-webkit-slider-thumb]:bg-white"
      />
      <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{clock(t)} / {clock(dur)}</span>
    </div>
  )
}
