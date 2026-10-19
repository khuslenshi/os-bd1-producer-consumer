"use client"

import { useState } from "react"
import { LockIcon, MinusIcon, PlayIcon, PlusIcon, Settings2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VIEWS, type View } from "@/components/stage"
import { LIMITS, SCENARIOS, type RunConfig } from "@/lib/config"
import { cn } from "@/lib/utils"

const FIELDS: { key: keyof typeof LIMITS; label: string; step: number; width: string }[] = [
  { key: "producers", label: "Producer", step: 1, width: "w-10" },
  { key: "consumers", label: "Consumer", step: 1, width: "w-10" },
  { key: "buffer", label: "Буфер", step: 1, width: "w-10" },
  { key: "sleepMax", label: "Унтах ≤ (мс)", step: 100, width: "w-16" },
  { key: "duration", label: "Хугацаа (с)", step: 1, width: "w-10" },
]

function Stepper({ id, label, value, min, max, step, width, disabled, onChange }: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  width: string
  disabled: boolean
  onChange: (v: number) => void
}) {
  const bad = !Number.isInteger(value) || value < min || value > max
  const clampTo = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="icon-xs" variant="outline" disabled={disabled || value <= min} onClick={() => onChange(clampTo((Number.isNaN(value) ? min : value) - step))} aria-label={`${label} багасгах`}>
          <MinusIcon />
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(value) ? "" : value}
          aria-invalid={bad || undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className={cn(
            "h-8 rounded-md bg-transparent text-center font-mono text-lg font-bold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            width,
            bad && "text-race ring-2 ring-race",
          )}
        />
        <Button type="button" size="icon-xs" variant="outline" disabled={disabled || value >= max} onClick={() => onChange(clampTo((Number.isNaN(value) ? min : value) + step))} aria-label={`${label} нэмэх`}>
          <PlusIcon />
        </Button>
      </div>
    </div>
  )
}

interface Props {
  config: RunConfig
  onChange: (c: RunConfig) => void
  view: View
  onView: (v: View) => void
  running: boolean
  locked?: boolean // level mode: the level fixes the run config, only the picture can change
  onStart: (c: RunConfig) => void
}

// One button that opens a settings window, like a game's options screen.
export function SettingsDialog({ config, onChange, view, onView, running, locked, onStart }: Props) {
  const [open, setOpen] = useState(false)
  const frozen = running || Boolean(locked)
  const set = (patch: Partial<RunConfig>) => onChange({ ...config, ...patch })
  const viewLabel = VIEWS.find(([v]) => v === view)?.[1]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="rounded-2xl px-4">
          <Settings2Icon data-icon="inline-start" />
          Тохиргоо
          <span className="font-mono text-xs font-normal text-muted-foreground max-sm:hidden">
            P{config.producers} · C{config.consumers} · {config.buffer} үүр · {config.mutex ? "mutex" : "mutex-гүй"} · {viewLabel}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-6 overflow-y-auto sm:max-w-2xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">Тохиргоо</DialogTitle>
          <DialogDescription>
            {locked ? "Энэ түвшний run-ийн тохиргоо түгжээтэй. Дүрслэлийг сольж болно." : "Run-ийн тохиргоо, буферийн дүрслэл, бэлэн туршилт."}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            Run {locked && <LockIcon className="size-3.5 text-muted-foreground" />}
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {FIELDS.map(({ key, label, step, width }) => (
              <Stepper
                key={key}
                id={key}
                label={label}
                value={config[key]}
                min={LIMITS[key].min}
                max={LIMITS[key].max}
                step={step}
                width={width}
                disabled={frozen}
                onChange={(v) => set({ [key]: v })}
              />
            ))}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seed" className="text-xs text-muted-foreground">Seed</label>
              <input
                id="seed"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="санамсаргүй"
                value={config.seed ?? ""}
                disabled={frozen}
                onChange={(e) => set({ seed: e.target.value === "" ? null : e.target.valueAsNumber })}
                className="tactile h-9 w-full max-w-36 rounded-xl border-edge bg-background px-3 font-mono text-sm tabular-nums outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-produce disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Mutex</span>
              <Toggle variant="outline" size="sm" className="w-fit" pressed={config.mutex} disabled={frozen} onPressedChange={(mutex) => set({ mutex })} aria-label="mutex ашиглах">
                {config.mutex ? "Асаалттай" : "Унтраалттай"}
              </Toggle>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">Буферийн дүрслэл</h3>
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && onView(v as View)} aria-label="Буферийн дүрслэл">
            {VIEWS.map(([v, label]) => (
              <ToggleGroupItem key={v} value={v} className="px-4">{label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        {!locked && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-bold">Бэлэн туршилт</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCENARIOS.map((s) => (
                <Button
                  key={s.name}
                  variant="outline"
                  disabled={running}
                  className="h-auto flex-col items-start gap-1 rounded-2xl px-4 py-3 text-left whitespace-normal"
                  onClick={() => { onChange(s.config); onStart(s.config); setOpen(false) }}
                >
                  <span>{s.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{s.hint}</span>
                </Button>
              ))}
            </div>
          </section>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="lg">Хаах</Button>
          </DialogClose>
          {!running && (
            <Button size="lg" onClick={() => { onStart(config); setOpen(false) }}>
              <PlayIcon data-icon="inline-start" />
              Эхлүүлэх
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
