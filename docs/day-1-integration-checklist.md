# Day 1 integration checklist

Use this checklist to verify that all three services work together end-to-end on Day 1.

Day 1 uses a **deterministic mock** in the Python AI service. No LLM API key is required.

---

## Goal

By the end of Day 1 you should be able to:

- Start all three services in the correct order
- Confirm each health endpoint responds
- Analyze a sample note through the UI or curl
- See a structured action for the CBC sample, or an empty list for non-matching notes

---

## Prerequisites

- [ ] **Node.js** 18 or newer installed
- [ ] **Python** 3.11 or newer installed
- [ ] Repository cloned locally
- [ ] Optional: copy the Node API section from [`.env.example`](../.env.example) to `apps/api/.env` (all variables have defaults; none are strictly required for Day 1)

**Not required on Day 1:**

- LLM API key
- Python environment variables
- SQLite database file
- Automated test suite

---

## Setup

### Python AI service

From `apps/ai-service`:

```bash
python -m venv .venv
```

Activate the virtual environment, then:

```bash
pip install -r requirements.txt
```

**Purpose:** Install FastAPI and Uvicorn for the deterministic mock service.

### Node API

From `apps/api`:

```bash
npm install
```

**Purpose:** Install Express, Zod, and TypeScript tooling.

Optional: copy Node variables from root [`.env.example`](../.env.example) into `apps/api/.env`.

### React frontend

From `apps/web`:

```bash
npm install
```

**Purpose:** Install React, Vite, and TypeScript tooling. No `.env` file is needed.

---

## Startup order

Start services in this order. Each depends on the one before it for the analyze flow.

| Order | Service | Directory | Command | URL |
|-------|---------|-----------|---------|-----|
| 1 | Python AI (mock) | `apps/ai-service` | `python main.py` | `http://localhost:8000` |
| 2 | Node API | `apps/api` | `npm run dev` | `http://localhost:3000` |
| 3 | React | `apps/web` | `npm run dev` | `http://localhost:5173` |

Leave each terminal running while testing.

---

## Health checks

Run these after starting the matching service.

### 1. Python AI service

```bash
curl http://localhost:8000/health
```

**Expected:**

```json
{ "status": "ok", "service": "ai-service" }
```

### 2. Node API

```bash
curl http://localhost:3000/health
```

**Expected:**

```json
{ "status": "ok", "service": "api" }
```

---

## Smoke tests

### Direct Python extraction (optional)

```bash
curl -X POST http://localhost:8000/extract-actions \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"The patient should repeat a CBC within seven days.\", \"reference_date\": \"2026-06-05\"}"
```

**Expected:** `200 OK` with one `test` action, `deadline_text` containing a seven-day phrase, and `normalized_deadline` of `2026-06-12`.

### Node analyze endpoint

```bash
curl -X POST http://localhost:3000/api/notes/analyze \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"The patient should repeat a CBC within seven days.\"}"
```

**Expected:** `201 Created` with a `note` object and one action in `actions`. Fields use `camelCase` (`deadlineText`, `needsReview`, `reviewStatus: pending`).

Set `REFERENCE_DATE=2026-06-05` in `apps/api/.env` before starting the API if you need a fixed `normalizedDeadline`.

### Browser flow

1. Open `http://localhost:5173`
2. Paste the contents of [`samples/01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt)
3. Click **Analyze**
4. Confirm one action appears with evidence matching the note text

---

## Sample note verification (Day 1 mock)

The Day 1 mock only recognizes **CBC + repeat + seven-day** patterns. Other samples are included for future LLM testing.

| Sample file | Day 1 mock expectation |
|-------------|------------------------|
| [`01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt) | **One action** — primary integration test |
| [`02-appointment-follow-up.txt`](../samples/02-appointment-follow-up.txt) | Empty list (planned: `appointment` on Day 2+) |
| [`03-urgent-warning.txt`](../samples/03-urgent-warning.txt) | Empty list (planned: `warning` with `urgent` priority) |
| [`04-ambiguous-deadline.txt`](../samples/04-ambiguous-deadline.txt) | Empty list (planned: `needsReview: true` for vague timing) |
| [`05-no-follow-up-actions.txt`](../samples/05-no-follow-up-actions.txt) | Empty list (matches planned behavior) |

An empty action list is valid and must not be treated as an error.

---

## Failure triage

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `502` with `AI_SERVICE_UNAVAILABLE` | Python service not running or wrong `AI_SERVICE_URL` | Start `apps/ai-service` on port 8000 |
| `502` with `INVALID_AI_RESPONSE` | Python response does not match Node Zod schema | Check Python logs; compare output to [contracts.md](contracts.md) |
| Browser network error on analyze | Node API not running | Start `apps/api` on port 3000 |
| Analyze works in curl but not browser | React dev server not running | Start `apps/web`; confirm Vite proxy targets port 3000 |
| `400` with `INVALID_NOTE` | Empty or whitespace-only text | Provide non-empty note text |

---

## Explicitly out of scope for Day 1

- [ ] SQLite persistence (notes are not saved between requests)
- [ ] `GET /api/notes/:noteId`
- [ ] `PATCH /api/actions/:actionId` (confirm, reject, edit, complete)
- [ ] External LLM provider integration
- [ ] Automated tests
- [ ] Production security (authentication, encryption, HIPAA)

---

## Definition of done

Day 1 integration is complete when all of the following are true:

- [ ] `GET /health` returns `200` on Python (`:8000`) and Node (`:3000`)
- [ ] `POST /api/notes/analyze` with sample `01` returns `201` and one action
- [ ] Browser analyze flow shows the same action with visible evidence
- [ ] A non-matching note (for example sample `05`) returns `201` with `actions: []`
- [ ] No LLM API key was needed to complete any step

---

## Day 2+ prerequisites (planned, not for Day 1)

When the external LLM and SQLite are implemented, additional setup will be required. See root [`.env.example`](../.env.example) **Day 2+ / planned** section for:

- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_SECONDS`
- `SQLITE_DB_PATH`

Do not block Day 1 integration on these variables.
