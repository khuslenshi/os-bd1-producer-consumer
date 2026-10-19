import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { bufferAt, buildModel, type CoreEvent } from "./model.ts"

const start: CoreEvent = { t: 0, ev: "start", buffer: 2, producers: 2, consumers: 1, mutex: true }
const ev = (t: number, e: Partial<CoreEvent>): CoreEvent => ({ t, ev: "sleep", ...e }) as CoreEvent

test("clean run: lanes, segments, no race, buffer replay", () => {
  const log = [
    start,
    ev(0, { ev: "sleep", role: "producer", id: 1, ms: 10 }),
    ev(0, { ev: "wait_full", role: "consumer", id: 1 }),
    ev(10, { ev: "produce", role: "producer", id: 1, item: 42, slot: 0 }),
    ev(10, { ev: "consume", role: "consumer", id: 1, item: 42, slot: 0 }),
    ev(12, { ev: "produce", role: "producer", id: 2, item: 7, slot: 1 }),
    ev(20, { ev: "end", produced: 2, consumed: 1, in_buffer: 1, invariant_ok: true }),
  ]
  const m = buildModel(log)
  assert.deepEqual(m.lanes.map((l) => l.key), ["P1", "P2", "C1"])
  assert.equal(m.races.size, 0)
  assert.deepEqual(m.lanes[0].segments[0], { kind: "sleep", t0: 0, t1: 10, label: "унтаж 10 мс" })
  assert.deepEqual(m.lanes[2].segments[0], { kind: "wait", t0: 0, t1: 10, label: "full хүлээж" })
  assert.equal(m.end?.invariant_ok, true)
  assert.deepEqual(bufferAt(log, 3, 2).slots, [42, null])
  assert.deepEqual(bufferAt(log, 5, 2), { slots: [null, 7], produced: 2, consumed: 1 })
})

test("no mutex: a logged count that skips the expected value is one race, then resyncs", () => {
  const log = [
    { ...start, mutex: false },
    ev(5, { ev: "produce", role: "producer", id: 1, item: 11, slot: 0, count: 1 }),
    ev(5, { ev: "produce", role: "producer", id: 2, item: 22, slot: 0, count: 1 }),
    ev(6, { ev: "consume", role: "consumer", id: 1, item: 22, slot: 0, count: 0 }),
  ]
  const m = buildModel(log)
  assert.deepEqual([...m.races.keys()], [2])
  assert.match(m.races.get(2) ?? "", /count = 1, 2 байх ёстой/)
})

const core = new URL("../core/pc", import.meta.url).pathname
const runCore = (args: string[]) =>
  execFileSync(core, args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim().split("\n").map((l) => JSON.parse(l) as CoreEvent)

test("real core: mutex on -> zero races; mutex off -> some, far fewer than operations", { skip: !existsSync(core) && "core not built" }, () => {
  const ok = buildModel(runCore(["1", "8", "8", "--sleep-max", "5", "--seed", "1"]))
  assert.equal(ok.races.size, 0)
  assert.equal(ok.end?.invariant_ok, true)

  const raced = runCore(["1", "8", "8", "--sleep-max", "5", "--seed", "1", "--no-mutex"])
  const m = buildModel(raced)
  const ops = raced.filter((e) => e.ev === "produce" || e.ev === "consume").length
  assert.ok(m.races.size > 0, "expected the no-mutex run to overlap somewhere")
  assert.ok(m.races.size < ops / 2, `${m.races.size} races of ${ops} operations: marks cascade`)
})
