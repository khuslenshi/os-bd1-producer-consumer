"use client"

import type { ReactNode } from "react"
import { CircleCheckIcon, KeyRoundIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { bufferAt, describe, type CoreEvent, type Model } from "@/lib/model"
import { cn } from "@/lib/utils"

interface Props {
  events: CoreEvent[]
  index: number
  model: Model
  onSeek: (i: number) => void
}

const LEGEND = [
  ["bg-sleep", "унтаж байна"],
  ["border border-wait-border bg-wait", "semaphore хүлээж байна"],
  ["bg-produce", "produce ↓ (буферт тавив)"],
  ["bg-consume", "consume ↑ (буферээс авав)"],
  ["bg-primary", "mutex эзэмшигч"],
  ["bg-race", "race: critical section давхцсан"],
] as const

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function StatePanel({ events, index, model, onSeek }: Props) {
  const size = model.start?.buffer ?? 5
  const current = events[index]
  let snap: CoreEvent | undefined
  for (let i = Math.min(index, events.length - 1); i >= 0 && !snap; i--) if (events[i].empty !== undefined) snap = events[i]
  const { slots, produced, consumed } = bufferAt(events, index, size)
  const race = current && model.races.get(index)
  const firstRace = model.races.keys().next().value
  const racesSoFar = [...model.races.keys()].filter((i) => i <= index).length

  return (
    <aside className="flex flex-col gap-5 rounded-lg border bg-card p-4 lg:sticky lg:top-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {current ? `${(current.t / 1000).toFixed(3)} с · event ${index + 1}` : "—"}
        </span>
        <p className={cn("text-[15px] font-semibold leading-snug", race && "text-race")}>
          {current ? describe(current) : "Start дарахад энд одоогийн event тайлбарлагдана"}
        </p>
        {race && <p className="text-sm text-race">Race: {race}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Буфер · circular array, {size} үүр</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
          {slots.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-md border font-mono text-sm font-bold tabular-nums",
                  v === null ? "bg-muted text-muted-foreground" : "border-produce/30 bg-produce-soft text-produce",
                )}
              >
                {v ?? ""}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                [{i}]{snap?.in === i && <b className="text-foreground"> in</b>}{snap?.out === i && <b className="text-foreground"> out</b>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={snap?.empty ?? size} label="empty" />
        <Stat value={snap?.full ?? 0} label="full" />
        <Stat
          value={snap?.mtx ? <span className="flex items-center gap-1"><KeyRoundIcon className="size-4" />{snap.mtx}</span> : "—"}
          label="mutex"
        />
        <Stat value={produced} label="тавьсан" />
        <Stat value={consumed} label="авсан" />
        <Stat value={produced - consumed} label="буферт" />
      </div>

      {model.races.size > 0 && firstRace !== undefined && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Race condition: {model.races.size} газар</AlertTitle>
          <AlertDescription>
            <p>{racesSoFar} нь энэ агшин хүртэл. Эхнийх: {model.races.get(firstRace)}</p>
            <Button size="xs" variant="outline" className="mt-1" onClick={() => onSeek(firstRace)}>Эхнийх рүү очих</Button>
          </AlertDescription>
        </Alert>
      )}

      {model.end && (
        <Alert variant={model.end.invariant_ok ? "default" : "destructive"}>
          {model.end.invariant_ok ? <CircleCheckIcon /> : <TriangleAlertIcon />}
          <AlertTitle>Invariant {model.end.invariant_ok ? "OK" : "БУРУУ"}</AlertTitle>
          <AlertDescription>
            {model.end.produced} − {model.end.consumed} = {(model.end.produced ?? 0) - (model.end.consumed ?? 0)}, буферт {model.end.in_buffer}
          </AlertDescription>
        </Alert>
      )}

      <Separator />
      <ul className="grid gap-1.5 text-xs text-muted-foreground">
        {LEGEND.map(([cls, text]) => (
          <li key={text} className="flex items-center gap-2">
            <span className={cn("h-3 w-5 rounded-sm", cls)} />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  )
}
