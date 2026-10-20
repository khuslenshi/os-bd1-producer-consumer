# The Producer-Consumer Problem · II-4-12

[![CI](https://github.com/khuslenshi/os-bd1-producer-consumer/actions/workflows/ci.yml/badge.svg)](https://github.com/khuslenshi/os-bd1-producer-consumer/actions/workflows/ci.yml)

F.CSM302 Үйлдлийн систем · Бие даалт 1 · *Operating System Concepts* (10-р хэвлэл), 7-р бүлгийн Programming Project 4 · UI дүрслэл: **Buffer animation**

Хязгаартай тойрог буферийг C хэл дээр pthreads, POSIX semaphore (`empty`, `full`), `mutex`-ээр хэрэгжүүлж, бодит программын thread бүрийн үйлдлийг browser дээр алхам алхмаар харуулна. Дэлгэц зөвхөн харуулдаг: бүх синхрончлол C программ дотор явагдана.

![Буфер дүүрэх: producer-ууд empty = 0 дээр хүлээж байна](docs/screenshots/web_02_buffer_full.png)

## Quick Start

Шаардлага: macOS эсвэл Linux (Windows дээр WSL2 Ubuntu), `gcc`/`clang` + `make`, Node.js 20+.

```bash
git clone https://github.com/khuslenshi/os-bd1-producer-consumer.git
cd os-bd1-producer-consumer
npm install
npm run dev
```

http://localhost:3000 нээнэ. `npm run dev` C программыг (`src/core/pc`) автоматаар build хийнэ.

| Цэс | Юу хийх |
|---|---|
| **Хичээл ба заавар** `/learn` | 3 оршил, 12 алхам: талхны дэлгүүрийн жишээнээс semaphore, mutex хүртэл. Бодит run, дуут уншлага, 5 асуулт |
| **Түвшингүүд** `/levels` | Буфер дүүрэх, Буфер хоосрох, Race condition. Run дуусахад асуулт |
| **Чөлөөт горим** `/play` | Түвшингүүд → Өөрийн туршилт. Бүх тохиргоо, 3 дүрслэл (Массив, Хоолой, Талх), timeline, event log |
| **Тухай** `/about` | Систем хэрхэн холбогддог, гол ойлголтууд |

Гараас: `←` `→` сонгох / нэг event, `Enter` нээх, `Space` тоглуулах, `Esc` цэс рүү.

## Командаас ажиллуулах

```bash
make -C src/core
./src/core/pc <секунд> <producer> <consumer> [--buffer N] [--sleep-max MS] [--seed S] [--no-mutex]
./src/core/pc 10 3 2              # номын хэлбэр: 10 с, 3 producer, 2 consumer
./src/core/pc 1 8 8 --sleep-max 5 --no-mutex   # race condition
```

Үйлдэл бүр нэг JSON мөрөөр хэвлэгдэнэ ([docs/EVENT_FORMAT.md](docs/EVENT_FORMAT.md)). Төгсгөлийн `end` мөрөнд `produced - consumed = in_buffer` шалгалт (`invariant_ok`) байна.

## Хэрхэн ажилладаг

```
C core (pc)  --stdout, JSON мөр-->  Next.js /api/run  --HTTP stream-->  Browser
pthreads, empty/full semaphore,     шалгах, spawn, stream,              timeline загвар, race илрүүлэлт,
mutex, тойрог буфер                 таслахад kill                       Stage, Timeline, Event log
```

- Producer: `sem_wait(empty)` → `mutex` lock → `buffer[in] = item`, `in = (in + 1) % n` → unlock → `sem_post(full)`. Consumer тэгш хэмтэй.
- Race илрүүлэлт: `produce`/`consume` мөрийн `count` нь тэр хүртэлх "тавьсан - авсан"-тай тэнцэх ёстой. Mutex-гүй үед зөрвөл тэр агшинд өөр thread зэрэг critical section-д байсан гэсэн үг ([src/lib/model.ts](src/lib/model.ts)).
- macOS нэргүй semaphore (`sem_init`) дэмждэггүй тул `sem_open`, `sem_getvalue` ажиллахгүй тул `empty`/`full`-ийг атомар тоолуураар хадгална.

## Бүтэц

```
src/core/         C программ (pc.c, Makefile)
src/app/          Next.js хуудсууд + api/run (core-ийг ажиллуулж stream хийнэ)
src/components/   Цэс, хичээл, түвшин, Stage, буферийн 3 дүрслэл, timeline, event log
src/lib/          Тохиргоо, timeline загвар, race илрүүлэлт, дуу + тест
public/audio/     Хичээлийн дуут уншлага
tests/            Core-ийн 18 автомат тест (run_tests.py) + results.md
docs/             Тайлан, Manual (PDF + LaTeX эх), Manual.md, дэлгэцийн зураг
.github/          CI ба release workflow
```

## Тест ба CI

```bash
npm test     # timeline загварын 3 тест (нэг нь бодит core-оор) + 18 core тест
```

- `tests/run_tests.py`: үндсэн (T1-T4), захын (B1-B6: буфер 1, унтах 0, 100+100 thread, буфер 64, 0 consumer/producer), буруу оролт (E1-E7), SIGTERM (S1), mutex-гүй race. Үр дүн: [tests/results.md](tests/results.md), 18/18 PASS.
- GitHub Actions push ба PR бүрт Ubuntu, macOS дээр `-Werror` build, тестүүд, Next.js build, `/api/run` smoke тест ажиллуулна.
- `v*` tag push хийхэд GitHub Release автоматаар гарч, тестийн үр дүн хавсрагдана.

## Баримт бичиг

- [Тайлан (Report.pdf)](docs/II-4-12_BD1_Report.pdf)
- [Гарын авлага (Manual.pdf)](docs/II-4-12_Manual.pdf), [Manual.md](docs/Manual.md)
- LaTeX эх: [docs/report/](docs/report/) (`cd docs/report && tectonic -o build II-4-12_Manual.tex`)

## Баг

II-4-12: B231910039, B232270802, B241940029, B242270031, B242270107

## AI ба бэлэн код

- **Next.js UI** (`src/app`, `src/components`, `src/lib`), **CI/release** (`.github/workflows`), **Manual, тайлан** (`docs/`): Claude Code (Anthropic)-ийн тусламжтайгаар бичсэн. B241940029 өөрчлөлт бүрийг бодит C core дээр ажиллуулж, `npm test`, CI болон гараар шалгасан.
- **Хичээлийн дуут уншлага** (`public/audio/learn/*.m4a`): текстийг Claude-ээр бичиж, ElevenLabs TTS-ээр дуу болгосон.
- **Бэлэн код**: shadcn/ui component (өөрчилсөн), lucide-react icon, Gilroy font.
- **C core** (`src/core/pc.c`), **тест** (`tests/run_tests.py`): **<багаар баталгаажуулна: AI ашигласан эсэх, хэрэв ашигласан бол аль хэсэгт>**

## Known issues

- Нэг run-д хамгийн ихдээ 20000 үйлдэл; түүнээс хойш core-ийг зогсоож анхааруулна (унтах 0-5 мс, олон thread үед).
- 600-аас олон үйлдэлтэй run (Түвшин 3) нүдээр хөөх боломжгүй тул 0.1×-д түгжигдэж, race-уудыг нэг нэгээр нь үзүүлнэ.
- UI-ийн хязгаар core-оос нарийн: producer/consumer ≤ 16, буфер ≤ 16, хугацаа ≤ 60 с.
- Нэг машин дээр зэрэг 4 хүртэл run.
- Windows дээр WSL-гүй ажиллахгүй (pthreads, POSIX semaphore).
