# Багийн код 12 · The Producer–Consumer Problem

F.CSM302 Үйлдлийн систем · Бие даалт 1 · Сурах бичиг: *Operating System Concepts*, Бүлэг 7 (Synchronization Examples)
UI дүрслэл: **Buffer animation**

## Зорилго
Хязгаартай буфер (circular array) дээр producer/consumer thread-үүдийг POSIX semaphore (`empty`, `full`) ба `mutex`-ээр синхрончилж, thread бүрийн бодит үйл явдлыг браузер дээр буферийн хөдөлгөөн болгон харуулна.

## Бүтэц
```
src/core/    C: pthreads + semaphore, үйл явдал бүрийг JSON мөр болгон гаргана
src/server/  Python (зөвхөн стандарт сан): core-ийг ажиллуулж, үйл явдлыг UI руу дамжуулна (SSE)
src/ui/      HTML/JS: Buffer animation, тохиргоо, Start/Stop/Reset, Pause/Step
tests/       автомат тест (run_tests.py) + results.md
docs/        Manual, EVENT_FORMAT.md, TASKS.md
```

## Quick Start
Орчин: **Linux / WSL2 / macOS** (gcc эсвэл clang, make, Python 3.8+). Нэмэлт сан шаардлагагүй.
```bash
git clone <REPO_URL> && cd <REPO_DIR>
make -C src/core                      # core-ийг build хийнэ
python3 src/server/server.py          # → http://127.0.0.1:8000 нээнэ
```
Docker:
```bash
docker build -t pc12 . && docker run --rm -p 8000:8000 pc12
```

### Core-ийг командаас шууд ажиллуулах (номын хэлбэр)
```bash
./src/core/pc <хугацаа_сек> <producer_тоо> <consumer_тоо> [--buffer N] [--sleep-max MS] [--seed S] [--no-mutex]
./src/core/pc 10 3 2          # 10 секунд, 3 producer, 2 consumer
```

### Тест
```bash
python3 tests/run_tests.py
```

## Тэмдэглэл
- macOS дээр unnamed semaphore (`sem_init`) байхгүй тул `sem_open` ашигласан (`#ifdef __APPLE__`).
- `sem_getvalue` macOS дээр ажиллахгүй тул `empty`/`full`-ийн утгыг семафортой зэрэг шинэчлэгдэх тоолуураар гаргадаг.
- AI/бэлэн код ашигласан хэсэг: **<ЭНД ЗАЙЛШГҮЙ БИЧНЭ — жишээ: "Эхний C/JS загварыг Claude (Anthropic)-ээр үүсгэж, багаараа шалгаж өөрчилсөн">**

## Known issues
- `--sleep-max 0` үед секундэд сая орчим үйл явдал гарч UI удааширна. UI-д 10 мс-ээс дээш утга ашиглана.
- Нэг удаад зөвхөн нэг ажиллалт дэмжинэ.
