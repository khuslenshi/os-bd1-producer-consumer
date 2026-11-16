| ID | Тест | Хүлээгдсэн | Бодит | Үр дүн |
|---|---|---|---|---|
| T1 | 1P+1C, 3s, buffer=5 | invariant, FIFO, slot order OK | produced=24 consumed=21 left=3 | PASS |
| T2 | 3P+1C: буфер дүүрч producer хүлээх | wait_empty > 0 | produced=53 consumed=48 left=5 waits(empty/full)=45/0 | PASS |
| T3 | 1P+4C: буфер хоосорч consumer хүлээх | wait_full > 0 | produced=46 consumed=46 left=0 waits(empty/full)=0/49 | PASS |
| T4 | Invariant produced-consumed=in_buffer, 5s | produced−consumed = left | produced=455 consumed=450 left=5 | PASS |
| B1 | buffer=1 (хамгийн хатуу) | slot үргэлж 0, invariant OK | produced=149 consumed=149 left=0 | PASS |
| B2 | sleep=0 (хамгийн их contention) | invariant, FIFO OK | produced=44662 consumed=44660 left=2 | PASS |
| B3 | 100P+100C (хэт олон thread) | invariant OK | produced=21212 consumed=21212 left=0 | PASS |
| B4 | buffer=64 (дээд хязгаар) | invariant OK | produced=285 consumed=221 left=64 | PASS |
| B5 | 0 consumer: буфер дүүрээд producer гацна | left=buffer, wait_empty>0 | produced=5 consumed=0 left=5 waits(empty/full)=2/0 | PASS |
| B6 | 0 producer: consumer хүлээнэ | produced=0, wait_full>0 | produced=0 consumed=0 left=0 waits(empty/full)=0/2 | PASS |
| E1 | аргумент дутуу | exit≠0 + '3 үндсэн аргумент' | exit=1 stderr='Алдаа: 3 үндсэн аргумент шаардлагатай (өгсөн: 2)' | PASS |
| E2 | сөрөг хугацаа | exit≠0 + 'хооронд байх ёстой' | exit=1 stderr='Алдаа: хугацаа (сек) нь 1..3600 хооронд байх ёстой (өгсөн утга: -3)' | PASS |
| E3 | тоо биш producer | exit≠0 + 'бүхэл тоо' | exit=1 stderr='Алдаа: producer-ийн тоо бүхэл тоо байх ёстой (өгсөн утга: 'abc')' | PASS |
| E4 | buffer=0 | exit≠0 + 'buffer' | exit=1 stderr='Алдаа: buffer нь 1..64 хооронд байх ёстой (өгсөн утга: 0)' | PASS |
| E5 | producer=201 | exit≠0 + 'хооронд байх ёстой' | exit=1 stderr='Алдаа: producer-ийн тоо нь 0..200 хооронд байх ёстой (өгсөн утга: 201)' | PASS |
| E6 | үл мэдэгдэх сонголт | exit≠0 + 'үл мэдэгдэх' | exit=1 stderr='Алдаа: үл мэдэгдэх сонголт '--foo'' | PASS |
| E7 | --buffer утгагүй | exit≠0 + 'утга дутуу' | exit=1 stderr='Алдаа: --buffer сонголтод утга дутуу' | PASS |
| S1 | SIGTERM: 60s ажиллагааг 1с-д зогсоох | хурдан зогсож end event гаргана | exit=0 1.0s end=yes | PASS |
| R1 | mutex-гүй 8P+8C, 8 ажиллалт: item шалгалт | ≥1 ажиллалтад lost/dup > 0 | item шалгалт 8/8, invariant 8/8 ажиллалтад зөрчил илрүүлсэн | PASS |

no-mutex race: 8 ажиллалтаас item шалгалт 8-д, invariant 8-д зөрчил илрүүлсэн.
