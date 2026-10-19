export interface RunConfig {
  duration: number
  producers: number
  consumers: number
  buffer: number
  sleepMax: number
  seed: number | null
  mutex: boolean
}

type NumKey = "duration" | "producers" | "consumers" | "buffer" | "sleepMax"

// Narrower than the core's own limits (pc.c): every thread gets a lane and every slot a cell.
export const LIMITS: Record<NumKey, { label: string; min: number; max: number }> = {
  duration: { label: "Хугацаа (сек)", min: 1, max: 60 },
  producers: { label: "Producer", min: 0, max: 16 },
  consumers: { label: "Consumer", min: 0, max: 16 },
  buffer: { label: "Буфер", min: 1, max: 16 },
  sleepMax: { label: "Унтах дээд хугацаа (мс)", min: 0, max: 5000 },
}

export const DEFAULT_CONFIG: RunConfig = {
  duration: 10, producers: 2, consumers: 2, buffer: 5, sleepMax: 1000, seed: null, mutex: true,
}

export const SCENARIOS: { name: string; hint: string; config: RunConfig }[] = [
  { name: "Буфер дүүрэх", hint: "Producer олон: буфер дүүрч producer-ууд хүлээнэ",
    config: { duration: 8, producers: 4, consumers: 1, buffer: 2, sleepMax: 600, seed: 7, mutex: true } },
  { name: "Буфер хоосрох", hint: "Consumer олон: буфер хоосорч consumer-ууд хүлээнэ",
    config: { duration: 8, producers: 1, consumers: 4, buffer: 5, sleepMax: 600, seed: 7, mutex: true } },
  { name: "Race condition", hint: "mutex-гүй, 8+8 thread, 5 мс: critical section давхцана",
    config: { duration: 1, producers: 8, consumers: 8, buffer: 5, sleepMax: 5, seed: 1, mutex: false } },
]

export function validate(c: RunConfig): string[] {
  const errors: string[] = []
  for (const [key, { label, min, max }] of Object.entries(LIMITS) as [NumKey, (typeof LIMITS)[NumKey]][]) {
    const v = c[key]
    if (!Number.isInteger(v)) errors.push(`${label}: бүхэл тоо байх ёстой`)
    else if (v < min || v > max) errors.push(`${label}: ${min}..${max} хооронд байх ёстой (өгсөн: ${v})`)
  }
  if (c.seed !== null && (!Number.isInteger(c.seed) || c.seed < 0 || c.seed > 2147483647))
    errors.push("Seed: 0..2147483647 хооронд бүхэл тоо байх ёстой")
  return errors
}

export function toQuery(c: RunConfig): string {
  const q = new URLSearchParams({
    duration: String(c.duration), producers: String(c.producers), consumers: String(c.consumers),
    buffer: String(c.buffer), sleepMax: String(c.sleepMax), mutex: c.mutex ? "1" : "0",
  })
  if (c.seed !== null) q.set("seed", String(c.seed))
  return q.toString()
}

export function fromQuery(q: URLSearchParams): RunConfig {
  const num = (k: string, d: number) => (q.has(k) && q.get(k) !== "" ? Number(q.get(k)) : d)
  return {
    duration: num("duration", DEFAULT_CONFIG.duration),
    producers: num("producers", DEFAULT_CONFIG.producers),
    consumers: num("consumers", DEFAULT_CONFIG.consumers),
    buffer: num("buffer", DEFAULT_CONFIG.buffer),
    sleepMax: num("sleepMax", DEFAULT_CONFIG.sleepMax),
    seed: q.has("seed") && q.get("seed") !== "" ? Number(q.get("seed")) : null,
    mutex: q.get("mutex") !== "0",
  }
}

export function coreArgs(c: RunConfig): string[] {
  const args = [c.duration, c.producers, c.consumers].map(String)
  args.push("--buffer", String(c.buffer), "--sleep-max", String(c.sleepMax))
  if (c.seed !== null) args.push("--seed", String(c.seed))
  if (!c.mutex) args.push("--no-mutex")
  return args
}
