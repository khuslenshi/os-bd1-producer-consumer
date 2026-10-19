# Багийн код II-4-12 · The Producer–Consumer Problem

F.CSM302 Үйлдлийн систем · Бие даалт 1 · Сурах бичиг: *Operating System Concepts*, Бүлэг 7 (Synchronization Examples)
UI дүрслэл: **Buffer animation** (тойрог буфер, semaphore токен, mutex түлхүүр + thread бүрийн timeline)

## Зорилго
Хязгаартай буфер (circular array) дээр producer/consumer thread-үүдийг POSIX semaphore (`empty`, `full`) ба `mutex`-ээр синхрончилж, thread бүрийн бодит үйл явдлыг браузер дээр timeline болон буферийн хөдөлгөөн болгон харуулна.

## Бүтэц
```
src/core/        C: pthreads + semaphore, үйл явдал бүрийг JSON мөр болгон гаргана
src/app/         Next.js: цэс, /learn, /levels, /play, /about + /api/run (core-ийг ажиллуулж event-үүдийг stream хийнэ)
src/components/  UI: цэс, хичээл, түвшин, буферийн 3 дүрслэл, thread timeline, event log
src/lib/         event → timeline загвар, race илрүүлэлт + тест
tests/           core-ийн автомат тест (run_tests.py) + results.md
docs/            Manual.md (хэрэглэгчийн + operational заавар), screenshots/, EVENT_FORMAT.md
```

## Quick Start
Шаардлага: **macOS эсвэл Linux** (Windows дээр **WSL2 Ubuntu**), `gcc`/`clang` + `make`, **Node.js 20+**.
```bash
git clone https://github.com/khuslenshi/os-bd1-producer-consumer.git && cd os-bd1-producer-consumer
npm install
npm run dev          # C core-ийг автоматаар build хийгээд → http://localhost:3000
```
Эхлэлийн цэснээс сонгоно (← → + Enter, Esc буцах):
- **Хичээл ба заавар** (`/learn`): талхны дэлгүүрийн жишээнээс эхлээд semaphore, mutex хүртэл 12 алхмаар заана, бодит run-тай, дуу хоолойгоор уншина (ElevenLabs), асуулттай.
- **Түвшингүүд** (`/levels`): Буфер дүүрэх, Буфер хоосрох, Race condition. Run дуусахад асуулт гарна.
- **Чөлөөт горим** (`/play`, Түвшингүүд → Өөрийн туршилт): **Тохиргоо** цонхонд run-ий тоо, mutex, буферийн дүрслэл, бэлэн туршилтыг сонгоно. Timeline дээр дарж/чирж аль ч агшин руу очно; `←` `→` нэг event, `Space` pause.
- **Тухай** (`/about`).

### Core-ийг командаас шууд ажиллуулах (номын хэлбэр)
```bash
make -C src/core
./src/core/pc <хугацаа_сек> <producer_тоо> <consumer_тоо> [--buffer N] [--sleep-max MS] [--seed S] [--no-mutex]
./src/core/pc 10 3 2          # 10 секунд, 3 producer, 2 consumer
```

### Тест
```bash
npm test             # timeline загварын тест (бодит core-оор) + python3 tests/run_tests.py
```
GitHub Actions (`.github/workflows/ci.yml`) push/PR бүрт Ubuntu ба macOS дээр core build, тест, web build, `/api/run` smoke тестийг ажиллуулна. `v*` tag push хийхэд Release автоматаар гарна.

## Тэмдэглэл
- macOS дээр unnamed semaphore (`sem_init`) байхгүй тул `sem_open` ашигласан (`#ifdef __APPLE__`).
- `sem_getvalue` macOS дээр ажиллахгүй тул `empty`/`full`-ийн утгыг семафортой зэрэг шинэчлэгдэх тоолуураар гаргадаг.
- Race илрүүлэлт: mutex-тэй үед produce/consume нь critical section дотроос log-логддог тул тэдгээрийн `count` үргэлж "produce − consume" -тэй тэнцүү. Mutex-гүй үед энэ зөрвөл тухайн агшинд өөр thread зэрэг critical section-д байсан гэсэн үг тул улаанаар тэмдэглэнэ (`src/lib/model.ts`).
- AI/бэлэн код ашигласан хэсэг:
  - **Next.js UI** (`src/app`, `src/components`, `src/lib`), **CI/release workflow** (`.github/workflows`), **`docs/Manual.md`**: Claude Code (Anthropic)-ийн тусламжтайгаар бичсэн. B241940029 өөрчлөлт бүрийг бодит C core дээр ажиллуулж, `npm test`, GitHub Actions CI болон гараар шалгасан.
  - **Хичээлийн дуу хоолой** (`public/audio/learn/*.m4a`): уншлагын текстийг Claude-ээр бичиж, ElevenLabs TTS (Sarnai voice)-ээр дуу болгосон.
  - **Бэлэн код**: shadcn/ui component-ууд (албан ёсны registry, өөрсдийн загвараар өөрчилсөн), lucide-react icon, Gilroy font.
  - **C core** (`src/core/pc.c`), **тест** (`tests/run_tests.py`): **<багаар баталгаажуулна: AI ашигласан эсэх, хэрэв ашигласан бол аль хэсэгт>**

## Known issues
- Нэг run-д хамгийн ихдээ 20 000 event харуулна; түүнээс хойш core-ийг зогсоож анхааруулна (`sleep-max` 0-5 мс үед).
- UI-ийн хязгаар core-оос нарийн: producer/consumer ≤ 16, буфер ≤ 16, хугацаа ≤ 60 с (thread бүр нэг мөр, үүр бүр нэг нүд).
