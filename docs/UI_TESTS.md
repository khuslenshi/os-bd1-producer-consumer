# UI туршилтын бүртгэл

Орчин: macOS (Apple Silicon), Safari, Python 3.9, Apple clang. Linux шалгалт: Docker ubuntu:24.04.
Бүх screenshot: `docs/screenshots/`

| № | Тохиргоо | Хүлээгдсэн үр дүн | Бодит үр дүн | Screenshot |
|---|---|---|---|---|
| 1 | P=2, C=2, buffer=5, sleep=1000, 20с, mutex асаалттай | Утга үүрэнд орж гарна, invariant OK | Үйлдвэрлэсэн 62, хэрэглэсэн 59, үлдсэн 3 → OK | 01_basic_running.png, 01b_basic_end.png |
| 2 | P=4, C=1, buffer=2, sleep=300 | Buffer дүүрч producer хүлээнэ, empty=0 | P1–P4 waiting (empty=0, буфер дүүрэн) | 02_producers_wait.png |
| 3 | P=1, C=4, buffer=5, sleep=300 | Buffer хоосорч consumer хүлээнэ, full=0 | C1–C4 waiting (full=0, буфер хоосон) | 03_consumers_wait.png |
| 4 | P=1, C=4, buffer=1, sleep=1000 | Ганц үүр, in=out=[0] | 34/34, үлдсэн 0, in=out=[0] → OK | 04_buffer1.png |
| 5 | Pause + Step | Үйл явдал нэг нэгээр харагдана | Pause нь Play болж, Step идэвхтэй, дараалалд 83 үйл явдал | 05_step_mode.png |
| 6 | P=8, C=8, buffer=5, sleep=5мс, 1с, mutex асаалттай | invariant OK | 2535−2533=2, buffer-т 2 үлдсэн → OK | 06_mutex_ok.png |
| 7 | Яг адилхан, mutex-гүй | Race: invariant зөрчигдөнө | 2541−2542=−1, full=−2, buffer хоосон байхад in=[1]≠out=[2] → БУРУУ | 07_race_no_mutex.png |
| 8 | Хугацаа=-5 | Алдааны мэдээлэл, ажиллахгүй | "Хугацаа (сек): 1..3600 хооронд байх ёстой" | 08_error_input.png |
| 9 | Reset | Цэвэр төлөв | Хоосон buffer, цэвэр лог | 09_reset.png |

Нэмэлт ажиглалт:
- P=8, C=8, buffer=1, sleep=1000, mutex-гүй: 246−245=1, buffer-т 1 үлдсэн → OK (race гараагүй). Thread-үүд ихэнх хугацаанд унтдаг тул давхцал ховор. Race нь sleep=5мс үед тогтвортой гарсан. (07a_mutex_off_no_race_buf1.png)
- P=8, C=8, buffer=1, sleep=1000, mutex-тэй: 248/248, үлдсэн 0 → OK (06a_mutex_on_P8_C8_buf1.png)

## Автомат тест ба CLI
- macOS: 18/18 PASS (10_tests_mac.png)
- Linux (Docker ubuntu:24.04): 18/18 PASS (11_tests_linux_docker.png)
- CLI ажиллуулалт: 12_cli_run.png
- CLI алдааны мэдээлэл: 13_cli_errors.png

## Core-оос шууд авсан логууд (sleep=5мс, P=8, C=8, buffer=5, 1 сек, seed=1)

| Лог | Горим | Үйлдвэрлэсэн | Хэрэглэсэн | Buffer-т үлдсэн | invariant |
|---|---|---|---|---|---|
| tests/logs/mutex_ok.jsonl | mutex-тэй | 2475 | 2470 | 5 | OK (2475−2470=5) |
| tests/logs/race_no_mutex.jsonl | mutex-гүй | 2516 | 2512 | 3 | БУРУУ (2516−2512=4≠3) |

Тэмдэглэл: race нь thread-ийн хуваарилалтаас хамаардаг магадлалтай үзэгдэл. seed нь зөвхөн унтах хугацааг тогтоодог тул өөр машин дээр үр дүн өөр байж болно.
