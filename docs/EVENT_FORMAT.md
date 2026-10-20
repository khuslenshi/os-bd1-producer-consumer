# JSON event формат (core → /api/run → browser)

Core нь stdout руу **нэг үйл явдал = нэг JSON мөр** гаргана. Бүх үйл явдал (`end`-ээс бусад) төлөвийн snapshot-тай.

| Талбар | Утга |
|---|---|
| `t` | core эхэлснээс хойших мс |
| `ev` | `start`, `sleep`, `wait_empty`, `wait_full`, `produce`, `consume`, `error`, `end` |
| `role`, `id` | `producer`/`consumer`, 1-ээс эхлэх дугаар (thread-ийн үйл явдалд) |
| `item`, `slot` | утга ба үүрний индекс (байхгүй бол -1) |
| `ms` | `sleep` үед унтах хугацаа |
| `empty`, `full` | семафорын утга (тоолуураар хуулбарласан) |
| `in`, `out`, `count` | буферийн заагчууд ба доторх элементийн тоо |
| `mtx` | mutex эзэмшигч ("P2", "C1") эсвэл "" |

- `wait_empty`: producer-ийн `sem_wait(empty)` блоклогдох гэж байна (буфер дүүрэн).
- `wait_full`: consumer-ийн `sem_wait(full)` блоклогдох гэж байна (буфер хоосон).
- `produce`/`consume` нь mutex дотроос бичигддэг тул лог дахь дараалал нь буферт бодитоор болсон дараалал.
- `start`: `buffer, producers, consumers, duration, sleep_max, mutex, seed`.
- `end`: `produced, consumed, in_buffer, invariant_ok` (`produced − consumed == in_buffer`).

Жишээ:
```
{"t":16,"ev":"produce","role":"producer","id":1,"item":57,"slot":0,"empty":2,"full":1,"in":1,"out":0,"count":1,"mtx":"P1"}
```
`/api/run` route процесс дуусахад нэмэлт нэг мөр илгээнэ: `{"ev":"closed","code":0,"truncated":false}` (`code` нь core-ийн exit код, `truncated` нь 20000 event-ийн хязгаарт хүрч зогсоосон эсэх, алдаа гарвал `message` нь stderr).
