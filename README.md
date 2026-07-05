# PipeBoard — Live Async Pipeline Dashboard

🔗 **Live demo:** https://pipeboard-beta.vercel.app

Press **chaos run** and watch a real job queue survive a provider outage and a worker crash — live, streamed over Server-Sent Events. No fake data: every chip that moves across the board is an event emitted by the engine.

## What it demonstrates

The state machine behind every reliable Celery / BullMQ / RQ deployment:

- **Queue → workers**: 3 workers pull jobs from a queue; in-flight work is visible in real time.
- **Retries with exponential backoff + jitter**: failed jobs back off (`800ms × 2^attempt × jitter`) instead of hammering the provider.
- **Dead-letter after max attempts**: jobs that fail 3× are quarantined, not silently lost.
- **Worker crash recovery**: in the chaos scenario worker `w2` dies mid-job — its job is re-queued (idempotency-key semantics), and the worker later rejoins the pool.
- **Degraded-provider phase**: error rate spikes to 65% for a window; the system absorbs it and drains the queue after recovery.
- **Observability**: live metrics (done / in-flight / retries / dead / error rate), per-worker stats, and a color-coded event log.

```
GET /api/run?scenario=chaos&jobs=24   ← one SSE connection = one live run
data: { t, phase, jobs[], workers[], metrics, log[] }  every ~360ms
```

## Stack

Next.js 16 (App Router route handler streaming SSE) · TypeScript · framer-motion (layout-animated job board) · Tailwind CSS v4 · Vercel

Design: OLED terminal — JetBrains Mono, deep black, status glow, scanline texture.

## Run locally

```bash
npm install
npm run dev
```

No env vars needed — the engine is self-contained.

## Why this exists

"Our pipeline starts jobs but they never complete / fail silently" is one of the most common rescue requests in production AI systems. This board makes the correct answer visible: explicit states, bounded retries, backoff, dead-letter, and logs that tell you *why* — the patterns I apply when fixing real queues.

---

Built by [Ilya Shapovalov](https://github.com/yagaMI-Reverse).
