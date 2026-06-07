# Integration checklist

Use this checklist to verify the full three-service stack on a Windows PowerShell development machine.

---

## Prerequisites

- [ ] **Node.js** 18 or newer
- [ ] **Python** 3.11 or newer
- [ ] **npm** (bundled with Node.js)
- [ ] **OpenAI API key** and model name for the Python service
- [ ] Repository cloned locally

---

## Environment setup

### Node API — `apps/api/.env`

Copy from root [`.env.example`](../.env.example) or [apps/api/.env.example](../apps/api/.env.example):

| Variable | Default | Required |
|----------|---------|----------|
| `PORT` | `3000` | No |
| `AI_SERVICE_URL` | `http://localhost:8000` | No |
| `MAX_NOTE_LENGTH` | `20000` | No |
| `REFERENCE_DATE` | today | No |
| `AI_SERVICE_TIMEOUT_MS` | `30000` | No |
| `DATABASE_PATH` | `data/app.db` | No |

### Python AI — `apps/ai-service/.env`

| Variable | Required |
|----------|----------|
| `LLM_API_KEY` | **Yes** |
| `LLM_MODEL` | **Yes** |
| `LLM_TIMEOUT_SECONDS` | No (default `30`) |

### React — `apps/web`

No `.env` file required.

---

## Install dependencies

### Python AI service

```powershell
Set-Location apps\ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Node API

```powershell
Set-Location apps\api
npm install
```

### React frontend

```powershell
Set-Location apps\web
npm install
```

Return to the repository root when finished.

---

## Startup order

Start each service in a **separate PowerShell window** and leave it running.

| Order | Service | Directory | Command | URL |
|-------|---------|-----------|---------|-----|
| 1 | Python AI | `apps\ai-service` | `python main.py` (venv active) | `http://localhost:8000` |
| 2 | Node API | `apps\api` | `npm run dev` | `http://localhost:3000` |
| 3 | React | `apps\web` | `npm run dev` | `http://localhost:5173` |

---

## Health checks

### Python AI

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

Expected: `status = ok`, `service = ai-service`

### Node API

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

Expected: `status = ok`, `service = api`

---

## Analyze test

### curl-style (PowerShell)

```powershell
$body = @{ text = "The patient should repeat a CBC within seven days." } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/notes/analyze" -ContentType "application/json" -Body $body
```

Expected:

- HTTP `201`
- `note.id` present
- At least one action with `reviewStatus = pending`, `completionStatus = open`
- `evidence` matches note wording

Save `$response.note.id` and `$response.actions[0].id` for later steps:

```powershell
$noteId = $response.note.id
$actionId = $response.actions[0].id
```

### Browser

1. Open `http://localhost:5173`
2. Paste contents of [`samples/01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt)
3. Click **Analyze**
4. Confirm actions render with evidence visible

---

## GET note test

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/notes/$noteId"
```

Expected:

- HTTP `200`
- `note.text` contains the original note
- `actions` array matches persisted state

Unknown ID:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/notes/note_does_not_exist"
```

Expected: `404` with `error.code = NOTE_NOT_FOUND`

**Product limitation:** React does not call this endpoint. Persistence is verified via API or a new analyze in the UI.

---

## PATCH action tests

### Confirm

```powershell
$body = @{ reviewStatus = "confirmed" } | ConvertTo-Json
Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/actions/$actionId" -ContentType "application/json" -Body $body
```

Expected: `action.reviewStatus = confirmed`

### Edit

```powershell
$body = @{ title = "Repeat complete blood count" } | ConvertTo-Json
Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/actions/$actionId" -ContentType "application/json" -Body $body
```

Expected: updated `title`; `evidence` unchanged

### Mark completed

```powershell
$body = @{ completionStatus = "completed" } | ConvertTo-Json
Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/actions/$actionId" -ContentType "application/json" -Body $body
```

Expected: `completionStatus = completed`

### Reject (use a fresh pending action)

Analyze a second note or use another `actionId` still in `pending` state:

```powershell
$body = @{ reviewStatus = "rejected" } | ConvertTo-Json
Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/actions/<pendingActionId>" -ContentType "application/json" -Body $body
```

Expected: `reviewStatus = rejected`, `completionStatus = open`

---

## Invalid transition test

Try to complete a **rejected** action:

```powershell
$body = @{ completionStatus = "completed" } | ConvertTo-Json
try {
  Invoke-RestMethod -Method PATCH -Uri "http://localhost:3000/api/actions/<rejectedActionId>" -ContentType "application/json" -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

Expected: HTTP `409`, `error.code = INVALID_ACTION_TRANSITION`

---

## LLM failure behavior

### Python service stopped

Stop the Python window, then analyze from Node:

```powershell
$body = @{ text = "The patient should repeat a CBC within seven days." } | ConvertTo-Json
try {
  Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/notes/analyze" -ContentType "application/json" -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

Expected: Node `502`, `error.code = AI_SERVICE_UNAVAILABLE`, no new DB row for that failed request

### Missing LLM credentials

Start Python without `LLM_API_KEY` / `LLM_MODEL` and call `/extract-actions` directly:

```powershell
$body = @{ text = "Test note."; reference_date = "2026-06-05" } | ConvertTo-Json
try {
  Invoke-RestMethod -Method POST -Uri "http://localhost:8000/extract-actions" -ContentType "application/json" -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

Expected: Python `502`, `error.code = LLM_PROVIDER_ERROR`

Restart Python with valid credentials before continuing UI tests.

---

## SQLite persistence verification

1. Analyze a note and capture `$noteId`
2. Confirm `apps\api\data\app.db` exists (unless `DATABASE_PATH` overrides location)
3. `GET /api/notes/$noteId` returns the same note text and actions
4. Stop and restart **only** the Node API
5. `GET` the same note again — data should still be present

---

## Automated test commands

Run from each app directory. All suites mock external LLM calls.

### Node API

```powershell
Set-Location apps\api
npm test
```

Expected: 24 tests passed (4 files)

### React

```powershell
Set-Location apps\web
npm test
```

Expected: 17 tests passed

### Python

```powershell
Set-Location apps\ai-service
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest tests\ -q
```

Expected: 25 tests passed

---

## Sample note manual checks

LLM output is **not guaranteed** to be identical across runs. Use these as contract-level expectations:

| Sample | Contract-level expectation |
|--------|----------------------------|
| `01-clear-test-deadline.txt` | At least one explicit `test` action |
| `02-appointment-follow-up.txt` | `appointment` action if explicitly stated |
| `03-urgent-warning.txt` | `warning` with `urgent` only if note says so |
| `04-ambiguous-deadline.txt` | Action with `needsReview: true` for vague timing |
| `05-no-follow-up-actions.txt` | **No actions** |
| `06-completed-treatment.txt` | **No future task** for completed chemo |
| `07-prompt-injection.txt` | Injection text treated as note content; extract only explicit clinical actions |

---

## Definition of done

- [ ] All three services start in order without errors
- [ ] Health checks pass on ports 8000 and 3000
- [ ] Analyze returns `201` with persisted note and actions
- [ ] GET note returns original text and actions by ID
- [ ] Confirm, edit, and complete PATCH flows succeed
- [ ] Rejected → completed returns `409`
- [ ] LLM/provider failure returns controlled errors without partial saves
- [ ] `npm test` passes in `apps\api` and `apps\web`
- [ ] `python -m pytest tests\` passes in `apps\ai-service`
- [ ] Browser workflow: analyze, confirm or reject, edit, complete

---

## Historical reference

Early mock-only setup steps are archived in [day-1-integration-checklist.md](day-1-integration-checklist.md).
