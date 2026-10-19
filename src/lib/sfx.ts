// Small synth sounds made with Web Audio: no files, nothing to load. Silent until the sound toggle allows it.
let ctx: AudioContext | null = null
let on = false

export function setSound(v: boolean) { on = v }

function tone(freq: number, dur: number, { type = "sine" as OscillatorType, gain = 0.1, to = 0, at = 0 } = {}) {
  if (!on || typeof window === "undefined") return
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  produce: () => tone(620, 0.12, { to: 880 }), // rising pop: an item goes in
  consume: () => tone(620, 0.12, { to: 420 }), // falling pop: an item comes out
  block: () => tone(170, 0.2, { type: "triangle", gain: 0.12 }), // low thud: a thread has to wait
  right: () => { tone(660, 0.16); tone(990, 0.28, { at: 0.09 }) },
  wrong: () => tone(240, 0.22, { type: "triangle", gain: 0.12, to: 150 }),
}

// The sound of one core event as the playhead passes it; a race sounds like a wrong answer.
export function eventSound(ev: string | undefined, race = false) {
  if (race) sfx.wrong()
  else if (ev === "produce") sfx.produce()
  else if (ev === "consume") sfx.consume()
  else if (ev === "wait_empty" || ev === "wait_full") sfx.block()
}
