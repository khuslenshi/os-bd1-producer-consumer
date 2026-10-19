"use client"

import { MinusIcon, PlayIcon, PlusIcon, RotateCcwIcon, SquareIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
    <div className="flex flex-col gap-1.5" data-invalid={bad || undefined}>
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
  running: boolean
  errors: string[]
  onStart: (c: RunConfig) => void
  onStop: () => void
  onReset: () => void
  locked?: boolean // level mode: the level fixes the config
}

export function ConfigBar({ config, onChange, running, errors, onStart, onStop, onReset, locked }: Props) {
  const frozen = running || Boolean(locked)
  const set = (patch: Partial<RunConfig>) => onChange({ ...config, ...patch })

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
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
            className="tactile h-9 w-32 rounded-xl border-edge bg-background px-3 font-mono text-sm tabular-nums outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-produce disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Mutex</span>
          <Toggle variant="outline" size="sm" pressed={config.mutex} disabled={frozen} onPressedChange={(mutex) => set({ mutex })} aria-label="mutex ашиглах">
            {config.mutex ? "Асаалттай" : "Унтраалттай"}
          </Toggle>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!locked && <span className="mr-1 text-xs text-muted-foreground">Бэлэн туршилт</span>}
        {!locked && SCENARIOS.map((s) => (
          <Tooltip key={s.name}>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" disabled={running} onClick={() => { onChange(s.config); onStart(s.config) }}>
                {s.name}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{s.hint}</TooltipContent>
          </Tooltip>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onReset}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
          {running ? (
            <Button variant="outline" onClick={onStop}>
              <SquareIcon data-icon="inline-start" />
              Stop
            </Button>
          ) : (
            <Button onClick={() => onStart(config)} className="px-6">
              <PlayIcon data-icon="inline-start" />
              Start
            </Button>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive" className="tactile rounded-xl border-race bg-race-soft">
          <AlertTitle>Ажиллуулж чадсангүй</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
