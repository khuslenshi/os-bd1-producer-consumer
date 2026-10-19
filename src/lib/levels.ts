import { SCENARIOS, type RunConfig } from "@/lib/config"

export interface Quiz {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface Level {
  id: number
  title: string
  goal: string
  config: RunConfig
  quiz: Quiz
}

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "Буфер дүүрэх",
    goal: "4 producer, 1 consumer, буфер 2 тавиуртай. Run-ийг ажиллуулж producer-ууд юу хийж байгааг ажигла.",
    config: SCENARIOS[0].config,
    quiz: {
      q: "Producer-ууд яагаад шар болж хүлээгээд байна вэ?",
      options: [
        "Mutex-ийг consumer барьсаар байгаа",
        "Буфер дүүрч empty = 0 болсон тул sem_wait(empty) блоклосон",
        "Consumer хэт хурдан авч байна",
      ],
      answer: 1,
      explain: "Сул зай (empty) дуусахад producer sem_wait(empty) дээр зогсоно. Consumer нэгийг авч sem_post(empty) хийхэд нэг producer сэрнэ.",
    },
  },
  {
    id: 2,
    title: "Буфер хоосрох",
    goal: "1 producer, 4 consumer, буфер 5. Consumer-ууд хэзээ, юуг хүлээж байгааг ажигла.",
    config: SCENARIOS[1].config,
    quiz: {
      q: "Consumer-уудыг хүлээлгэж байгаа semaphore аль нь вэ?",
      options: ["empty", "full", "mutex"],
      answer: 1,
      explain: "full нь буферт байгаа item-ийн тоо. Буфер хоосон бол full = 0 тул consumer sem_wait(full) дээр producer тавих хүртэл хүлээнэ.",
    },
  },
  {
    id: 3,
    title: "Race condition",
    goal: "Mutex унтраалттай, 8 + 8 thread, 5 мс. Улаан тэмдэг гарсан газар болон төгсгөлийн invariant-ийг хар.",
    config: SCENARIOS[2].config,
    quiz: {
      q: "Mutex-гүй үед юу буруу болсон бэ?",
      options: [
        "Thread-үүд унтахаа больсон",
        "Хоёр thread зэрэг буферийг өөрчилж count, invariant зөрсөн",
        "Semaphore ажиллахаа больсон",
      ],
      answer: 1,
      explain: "in, out, count-ийг хоёр thread зэрэг шинэчлэхэд нэгнийх нь өөрчлөлт алдагдана (lost update). Mutex үүнийг нэг удаад нэг thread болгож хамгаална.",
    },
  },
]

const KEY = "pc-levels-done"

export function readDone(): number[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

export function markDone(id: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...readDone(), id])]))
  } catch {
    // ponytail: progress is a convenience; private mode just forgets it
  }
}
