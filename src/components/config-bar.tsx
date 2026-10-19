"use client"

import { PlayIcon, RotateCcwIcon, SquareIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LIMITS, SCENARIOS, type RunConfig } from "@/lib/config"

const FIELDS: { key: keyof typeof LIMITS; label: string; width: string }[] = [
  { key: "producers", label: "Producer", width: "w-20" },
  { key: "consumers", label: "Consumer", width: "w-20" },
  { key: "buffer", label: "Буфер", width: "w-20" },
  { key: "sleepMax", label: "Унтах ≤ (мс)", width: "w-28" },
  { key: "duration", label: "Хугацаа (с)", width: "w-24" },
]

interface Props {
  config: RunConfig
  onChange: (c: RunConfig) => void
  running: boolean
  errors: string[]
  onStart: (c: RunConfig) => void
  onStop: () => void
  onReset: () => void
}

export function ConfigBar({ config, onChange, running, errors, onStart, onStop, onReset }: Props) {
  const set = (patch: Partial<RunConfig>) => onChange({ ...config, ...patch })

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {FIELDS.map(({ key, label, width }) => {
          const { min, max } = LIMITS[key]
          const v = config[key]
          const bad = !Number.isInteger(v) || v < min || v > max
          return (
            <Field key={key} className={width} data-invalid={bad || undefined}>
              <FieldLabel htmlFor={key} className="text-xs text-muted-foreground">{label}</FieldLabel>
              <Input
                id={key}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={Number.isNaN(v) ? "" : v}
                aria-invalid={bad || undefined}
                disabled={running}
                onChange={(e) => set({ [key]: e.target.valueAsNumber })}
                className="font-mono tabular-nums"
              />
            </Field>
          )
        })}
        <Field className="w-32">
          <FieldLabel htmlFor="seed" className="text-xs text-muted-foreground">Seed</FieldLabel>
          <Input
            id="seed"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="санамсаргүй"
            value={config.seed ?? ""}
            disabled={running}
            onChange={(e) => set({ seed: e.target.value === "" ? null : e.target.valueAsNumber })}
            className="font-mono tabular-nums"
          />
        </Field>
        <Field orientation="horizontal" className="h-9 w-auto">
          <Switch id="mutex" checked={config.mutex} disabled={running} onCheckedChange={(mutex) => set({ mutex })} />
          <FieldLabel htmlFor="mutex">mutex</FieldLabel>
        </Field>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => onStart(config)} disabled={running}>
            <PlayIcon data-icon="inline-start" />
            Start
          </Button>
          <Button variant="outline" onClick={onStop} disabled={!running}>
            <SquareIcon data-icon="inline-start" />
            Stop
          </Button>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Бэлэн туршилт</span>
        {SCENARIOS.map((s) => (
          <Tooltip key={s.name}>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" disabled={running} onClick={() => { onChange(s.config); onStart(s.config) }}>
                {s.name}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{s.hint}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
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
