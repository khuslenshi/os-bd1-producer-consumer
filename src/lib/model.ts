// One JSON line from src/core/pc (docs/EVENT_FORMAT.md) or the "closed" line added by /api/run.
export interface CoreEvent {
  t: number
  ev: "start" | "sleep" | "wait_empty" | "wait_full" | "produce" | "consume" | "error" | "end" | "closed"
  role?: "producer" | "consumer"
  id?: number
  item?: number
  slot?: number
  ms?: number
  empty?: number
  full?: number
  in?: number
  out?: number
  count?: number
  mtx?: string
  buffer?: number
  producers?: number
  consumers?: number
  duration?: number
  sleep_max?: number
  mutex?: boolean
  seed?: number
  produced?: number
  consumed?: number
  in_buffer?: number
  invariant_ok?: boolean
  code?: number | null
  truncated?: boolean
  message?: string
}

export interface Segment { kind: "sleep" | "wait"; t0: number; t1: number; label: string }
export interface Mark { kind: "produce" | "consume" | "error"; t: number; index: number; item: number; slot: number }
export interface Lane { key: string; segments: Segment[]; marks: Mark[] }

export interface Model {
  lanes: Lane[]
  races: Map<number, string>
  start?: CoreEvent
  end?: CoreEvent
  lastT: number
}

export const who = (e: CoreEvent) => (e.role === "producer" ? "P" : "C") + e.id

export function buildModel(events: CoreEvent[]): Model {
  const start = events.find((e) => e.ev === "start")
  const lanes = new Map<string, Lane>()
  for (let i = 1; i <= (start?.producers ?? 0); i++) lanes.set("P" + i, { key: "P" + i, segments: [], marks: [] })
  for (let i = 1; i <= (start?.consumers ?? 0); i++) lanes.set("C" + i, { key: "C" + i, segments: [], marks: [] })

  const open = new Map<string, Segment>()
  const races = new Map<number, string>()
  let balance = 0 // produce events minus consume events so far
  let drift = 0
  let end: CoreEvent | undefined
  let lastT = 0

  events.forEach((e, index) => {
    lastT = Math.max(lastT, e.t ?? 0)
    if (e.ev === "end") end = e
    if (!e.role) return
    const key = who(e)
    const lane = lanes.get(key)
    if (!lane) return
    const prev = open.get(key)
    if (prev) { prev.t1 = e.t; lane.segments.push(prev); open.delete(key) }

    if (e.ev === "sleep") open.set(key, { kind: "sleep", t0: e.t, t1: e.t, label: `унтаж ${e.ms} мс` })
    else if (e.ev === "wait_empty") open.set(key, { kind: "wait", t0: e.t, t1: e.t, label: "empty хүлээж" })
    else if (e.ev === "wait_full") open.set(key, { kind: "wait", t0: e.t, t1: e.t, label: "full хүлээж" })
    else lane.marks.push({ kind: e.ev as Mark["kind"], t: e.t, index, item: e.item ?? -1, slot: e.slot ?? -1 })

    // With the mutex, produce/consume are logged inside the critical section, so their `count`
    // always equals produces - consumes logged so far. A jump means another thread changed the
    // buffer while this one was inside: the critical sections overlapped (a race).
    if (e.ev === "produce" || e.ev === "consume") {
      balance += e.ev === "produce" ? 1 : -1
      const expected = balance + drift
      if (e.count !== undefined && e.count !== expected) {
        races.set(index, `count = ${e.count}, ${expected} байх ёстой: өөр thread зэрэг critical section-д байсан`)
        drift = e.count - balance
      }
    } else if (e.ev === "error") {
      races.set(index, "буфер дүүрэн/хоосон байхад хандлаа")
    }
  })

  for (const [key, seg] of open) { seg.t1 = lastT; lanes.get(key)?.segments.push(seg) }
  return { lanes: [...lanes.values()], races, start, end, lastT }
}

export function bufferAt(events: CoreEvent[], upto: number, size: number) {
  const slots: (number | null)[] = Array(size).fill(null)
  let produced = 0
  let consumed = 0
  for (let i = 0; i <= upto && i < events.length; i++) {
    const e = events[i]
    if (e.slot === undefined || e.slot < 0 || e.slot >= size) continue
    if (e.ev === "produce") { slots[e.slot] = e.item ?? null; produced++ }
    else if (e.ev === "consume") { slots[e.slot] = null; consumed++ }
  }
  return { slots, produced, consumed }
}

export type ThreadState = { kind: "idle" | "sleep" | "wait" | "work"; text: string; e?: CoreEvent }

// State of every thread at event `upto`: the last event each thread logged up to then.
export function threadStates(events: CoreEvent[], upto: number, keys: string[]) {
  const states = new Map<string, ThreadState>(keys.map((k) => [k, { kind: "idle", text: "эхлээгүй" }]))
  const seen = new Set<string>()
  for (let i = Math.min(upto, events.length - 1); i >= 0 && seen.size < keys.length; i--) {
    const e = events[i]
    if (!e.role || seen.has(who(e))) continue
    seen.add(who(e))
    const s: Omit<ThreadState, "e"> =
      e.ev === "sleep" ? { kind: "sleep", text: `унтаж ${e.ms} мс` }
      : e.ev === "wait_empty" ? { kind: "wait", text: "empty = 0, хүлээж" }
      : e.ev === "wait_full" ? { kind: "wait", text: "full = 0, хүлээж" }
      : e.ev === "produce" ? { kind: "work", text: `${e.item} → [${e.slot}]` }
      : e.ev === "consume" ? { kind: "work", text: `[${e.slot}] → ${e.item}` }
      : { kind: "work", text: "алдаа" }
    states.set(who(e), { ...s, e })
  }
  return states
}

export function describe(e: CoreEvent): string {
  switch (e.ev) {
    case "start": return `Эхэллээ: ${e.producers} producer, ${e.consumers} consumer, буфер ${e.buffer}, mutex ${e.mutex ? "асаалттай" : "унтраалттай"}`
    case "sleep": return `${who(e)} ${e.ms} мс унтана`
    case "wait_empty": return `${who(e)} хүлээж байна: буфер дүүрэн (empty = 0)`
    case "wait_full": return `${who(e)} хүлээж байна: буфер хоосон (full = 0)`
    case "produce": return `${who(e)} ${e.item}-г [${e.slot}]-д тавив`
    case "consume": return `${who(e)} ${e.item}-г [${e.slot}]-аас авав`
    case "error": return `${who(e)} алдаа: буфер ${e.role === "producer" ? "дүүрэн" : "хоосон"} байхад хандсан`
    case "end": return `Дууслаа: ${e.produced} тавьж, ${e.consumed} авсан, буферт ${e.in_buffer} үлдсэн. Invariant ${e.invariant_ok ? "OK" : "БУРУУ"}`
    case "closed": return e.truncated ? "20000 event-д хүрч зогслоо" : e.code ? `Core алдаатай дууслаа (код ${e.code})` : "Core процесс дууслаа"
  }
}
