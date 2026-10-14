/*
 * Producer-Consumer (bounded buffer) - Operating System Concepts, ch.7
 * Core: pthreads + POSIX semaphores (empty, full) + mutex.
 * Every state change is printed to stdout as ONE JSON line (see docs/EVENT_FORMAT.md)
 * so the UI shows what the real threads did.
 *
 * Usage: ./pc <duration_sec> <producers> <consumers> [--buffer N] [--sleep-max MS] [--seed S] [--no-mutex]
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <semaphore.h>
#include <signal.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define DEFAULT_BUFFER 5
#define MAX_BUFFER 64
#define MAX_THREADS 200

typedef int buffer_item;

/* ---------- shared state ---------- */
static buffer_item *buffer;
static int bsize = DEFAULT_BUFFER;
static int in_idx = 0, out_idx = 0, count = 0;
static int empty_cnt, full_cnt;           /* shadow copies of semaphore values (sem_getvalue is not portable) */
static long produced_total = 0, consumed_total = 0;
static volatile int mtx_owner = 0;        /* mutex holder: +id producer, -id consumer, 0 free */

static sem_t *sem_empty, *sem_full;
static sem_t sem_empty_s, sem_full_s;   /* storage for sem_init (Linux); unused on macOS where sem_open is used */
static pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t log_mutex = PTHREAD_MUTEX_INITIALIZER;

static int use_mutex = 1;
static int sleep_max_ms = 1000;
static unsigned base_seed;
static volatile sig_atomic_t running = 1;
static long long t0;

/* ---------- helpers ---------- */
static long long now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void on_signal(int sig) { (void)sig; running = 0; }

/* one JSON line per event, printed atomically */
static void emit(const char *ev, const char *role, int id, int item, int slot, int ms) {
    pthread_mutex_lock(&log_mutex);
    int ow = mtx_owner; char mtx_str[16];
    if (ow > 0) snprintf(mtx_str, sizeof mtx_str, "P%d", ow);
    else if (ow < 0) snprintf(mtx_str, sizeof mtx_str, "C%d", -ow);
    else mtx_str[0] = 0;
    printf("{\"t\":%lld,\"ev\":\"%s\"", now_ms() - t0, ev);
    if (role) printf(",\"role\":\"%s\",\"id\":%d", role, id);
    printf(",\"item\":%d,\"slot\":%d", item, slot);
    if (ms >= 0) printf(",\"ms\":%d", ms);
    printf(",\"empty\":%d,\"full\":%d,\"in\":%d,\"out\":%d,\"count\":%d,\"mtx\":\"%s\"}\n",
           empty_cnt, full_cnt, in_idx, out_idx, count, mtx_str);
    fflush(stdout);
    pthread_mutex_unlock(&log_mutex);
}

static void nap(int ms) { /* interruptible sleep so Stop reacts quickly */
    while (ms > 0 && running) {
        int c = ms > 20 ? 20 : ms;
        usleep(c * 1000);
        ms -= c;
    }
}

static void sem_wait_retry(sem_t *s) { while (sem_wait(s) == -1 && errno == EINTR) {} }

static int sem_make(sem_t **out, void *storage, const char *name, unsigned v) {
#ifdef __APPLE__
    (void)storage;
    sem_unlink(name);
    *out = sem_open(name, O_CREAT | O_EXCL, 0600, v);
    return *out == SEM_FAILED ? -1 : 0;
#else
    (void)name;
    if (sem_init((sem_t *)storage, 0, v) != 0) return -1;
    *out = (sem_t *)storage;
    return 0;
#endif
}

static void sem_destroy_portable(sem_t *s, const char *name) {
#ifdef __APPLE__
    sem_close(s); sem_unlink(name);
#else
    (void)name; sem_destroy(s);
#endif
}

/* ---------- buffer (circular array), textbook API ---------- */
/* returns 0 on success, -1 if buffer is full */
static int insert_item(buffer_item item, int *slot) {
    if (count >= bsize) return -1;
    *slot = in_idx;
    buffer[in_idx] = item;
    in_idx = (in_idx + 1) % bsize;
    count++;
    return 0;
}

/* returns 0 on success, -1 if buffer is empty */
static int remove_item(buffer_item *item, int *slot) {
    if (count <= 0) return -1;
    *slot = out_idx;
    *item = buffer[out_idx];
    out_idx = (out_idx + 1) % bsize;
    count--;
    return 0;
}

/* ---------- threads ---------- */
static void *producer(void *arg) {
    int id = (int)(intptr_t)arg;
    unsigned seed = base_seed + (unsigned)id * 7919u + 1u;
    while (running) {
        int ms = sleep_max_ms ? (int)(rand_r(&seed) % (unsigned)(sleep_max_ms + 1)) : 0;
        emit("sleep", "producer", id, -1, -1, ms);
        nap(ms);
        if (!running) break;
        buffer_item item = (int)(rand_r(&seed) % 100);

        if (sem_trywait(sem_empty) != 0) {            /* buffer full -> will block */
            emit("wait_empty", "producer", id, item, -1, -1);
            sem_wait_retry(sem_empty);
        }
        if (!running) break;
        __sync_fetch_and_sub(&empty_cnt, 1);

        if (use_mutex) { pthread_mutex_lock(&mutex); mtx_owner = id; }
        int slot = -1;
        if (insert_item(item, &slot) == 0) {
            __sync_fetch_and_add(&produced_total, 1);
            __sync_fetch_and_add(&full_cnt, 1);
            emit("produce", "producer", id, item, slot, -1);
        } else {
            emit("error", "producer", id, item, -1, -1);
        }
        if (use_mutex) { mtx_owner = 0; pthread_mutex_unlock(&mutex); }
        sem_post(sem_full);
    }
    return NULL;
}

static void *consumer(void *arg) {
    int id = (int)(intptr_t)arg;
    unsigned seed = base_seed + (unsigned)id * 104729u + 99u;
    while (running) {
        int ms = sleep_max_ms ? (int)(rand_r(&seed) % (unsigned)(sleep_max_ms + 1)) : 0;
        emit("sleep", "consumer", id, -1, -1, ms);
        nap(ms);
        if (!running) break;

        if (sem_trywait(sem_full) != 0) {             /* buffer empty -> will block */
            emit("wait_full", "consumer", id, -1, -1, -1);
            sem_wait_retry(sem_full);
        }
        if (!running) break;
        __sync_fetch_and_sub(&full_cnt, 1);

        if (use_mutex) { pthread_mutex_lock(&mutex); mtx_owner = -id; }
        buffer_item item = -1; int slot = -1;
        if (remove_item(&item, &slot) == 0) {
            __sync_fetch_and_add(&consumed_total, 1);
            __sync_fetch_and_add(&empty_cnt, 1);
            emit("consume", "consumer", id, item, slot, -1);
        } else {
            emit("error", "consumer", id, -1, -1, -1);
        }
        if (use_mutex) { mtx_owner = 0; pthread_mutex_unlock(&mutex); }
        sem_post(sem_empty);
    }
    return NULL;
}

/* ---------- argument handling ---------- */
static void usage(const char *p) {
    fprintf(stderr,
        "Хэрэглээ: %s <хугацаа_сек> <producer_тоо> <consumer_тоо> [сонголт]\n"
        "  --buffer N       буферийн хэмжээ 1..%d (анхдагч %d)\n"
        "  --sleep-max MS   унтах дээд хугацаа 0..10000 мс (анхдагч 1000)\n"
        "  --seed S         санамсаргүй тооны seed (анхдагч: цаг)\n"
        "  --no-mutex       mutex-гүй ажиллуулах (race condition үзүүлэх)\n",
        p, MAX_BUFFER, DEFAULT_BUFFER);
}

static int parse_int(const char *s, long lo, long hi, const char *name, long *out) {
    char *e; errno = 0;
    long v = strtol(s, &e, 10);
    if (*s == 0 || *e != 0 || errno) {
        fprintf(stderr, "Алдаа: %s бүхэл тоо байх ёстой (өгсөн утга: '%s')\n", name, s);
        return -1;
    }
    if (v < lo || v > hi) {
        fprintf(stderr, "Алдаа: %s нь %ld..%ld хооронд байх ёстой (өгсөн утга: %ld)\n", name, lo, hi, v);
        return -1;
    }
    *out = v;
    return 0;
}

int main(int argc, char **argv) {
    long duration = 0, np = 0, nc = 0, v;
    long seed = (long)time(NULL);
    int npos = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--no-mutex") == 0) { use_mutex = 0; continue; }
        if (strncmp(argv[i], "--", 2) == 0) {
            if (i + 1 >= argc) { fprintf(stderr, "Алдаа: %s сонголтод утга дутуу\n", argv[i]); usage(argv[0]); return 1; }
            if (strcmp(argv[i], "--buffer") == 0) { if (parse_int(argv[++i], 1, MAX_BUFFER, "buffer", &v)) return 1; bsize = (int)v; }
            else if (strcmp(argv[i], "--sleep-max") == 0) { if (parse_int(argv[++i], 0, 10000, "sleep-max", &v)) return 1; sleep_max_ms = (int)v; }
            else if (strcmp(argv[i], "--seed") == 0) { if (parse_int(argv[++i], 0, 2147483647L, "seed", &seed)) return 1; }
            else { fprintf(stderr, "Алдаа: үл мэдэгдэх сонголт '%s'\n", argv[i]); usage(argv[0]); return 1; }
            continue;
        }
        if (npos == 0) { if (parse_int(argv[i], 1, 3600, "хугацаа (сек)", &duration)) return 1; }
        else if (npos == 1) { if (parse_int(argv[i], 0, MAX_THREADS, "producer-ийн тоо", &np)) return 1; }
        else if (npos == 2) { if (parse_int(argv[i], 0, MAX_THREADS, "consumer-ийн тоо", &nc)) return 1; }
        else { fprintf(stderr, "Алдаа: илүү аргумент '%s'\n", argv[i]); usage(argv[0]); return 1; }
        npos++;
    }
    if (npos != 3) { fprintf(stderr, "Алдаа: 3 үндсэн аргумент шаардлагатай (өгсөн: %d)\n", npos); usage(argv[0]); return 1; }
    base_seed = (unsigned)seed;

    buffer = calloc((size_t)bsize, sizeof *buffer);
    pthread_t *th = calloc((size_t)(np + nc + 1), sizeof *th);
    if (!buffer || !th) { fprintf(stderr, "Алдаа: санах ой хүрэлцсэнгүй\n"); return 1; }
    empty_cnt = bsize; full_cnt = 0;
    if (sem_make(&sem_empty, &sem_empty_s, "/pc_empty", (unsigned)bsize) ||
        sem_make(&sem_full, &sem_full_s, "/pc_full", 0)) {
        perror("Алдаа: семафор үүсгэж чадсангүй"); return 1;
    }

    struct sigaction sa; memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_signal; sigaction(SIGINT, &sa, NULL); sigaction(SIGTERM, &sa, NULL);

    t0 = now_ms();
    printf("{\"t\":0,\"ev\":\"start\",\"buffer\":%d,\"producers\":%ld,\"consumers\":%ld,\"duration\":%ld,"
           "\"sleep_max\":%d,\"mutex\":%s,\"seed\":%ld,\"empty\":%d,\"full\":0,\"in\":0,\"out\":0,\"count\":0,\"mtx\":\"\"}\n",
           bsize, np, nc, duration, sleep_max_ms, use_mutex ? "true" : "false", seed, bsize);
    fflush(stdout);

    int nt = 0;
    for (long i = 1; i <= np; i++) pthread_create(&th[nt++], NULL, producer, (void *)(intptr_t)i);
    for (long i = 1; i <= nc; i++) pthread_create(&th[nt++], NULL, consumer, (void *)(intptr_t)i);

    while (running && now_ms() - t0 < duration * 1000) usleep(20000);
    running = 0;
    for (long i = 0; i < np + nc; i++) { sem_post(sem_empty); sem_post(sem_full); } /* wake blocked threads */
    for (int i = 0; i < nt; i++) pthread_join(th[i], NULL);

    int ok = (produced_total - consumed_total == count) && count >= 0 && count <= bsize;
    printf("{\"t\":%lld,\"ev\":\"end\",\"produced\":%ld,\"consumed\":%ld,\"in_buffer\":%d,\"invariant_ok\":%s}\n",
           now_ms() - t0, produced_total, consumed_total, count, ok ? "true" : "false");
    fflush(stdout);

    sem_destroy_portable(sem_empty, "/pc_empty");
    sem_destroy_portable(sem_full, "/pc_full");
    free(buffer); free(th);
    return 0;
}
