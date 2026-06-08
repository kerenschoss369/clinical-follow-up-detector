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

**Recommended for integration testing and interview demos:**

```env
REFERENCE_DATE=2026-06-05
```

When `REFERENCE_DATE` is set to `2026-06-05`, the test note *"within seven days"* may resolve to `normalizedDeadline = 2026-06-12`. For production-like local usage you may omit `REFERENCE_DATE` and default to the current date, but relative deadlines will then depend on the day you run the demo.

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

The current health endpoints verify that each process is running. Dependency-aware readiness checks would be added for production deployment.

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

## Automated contract tests vs live LLM smoke tests

### Automated contract tests (mocked)

Run the test suites listed under [Automated test commands](#automated-test-commands). These use mocks and may assert exact behavior:

- exact error codes and status transitions
- schema validation
- persistence and empty-action behavior
- no partial database saves on failure

### Live LLM smoke tests (manual)

Live checks use a real LLM and must **not** require a specific action count, exact wording, or exact priority unless the note explicitly supports a contract-level expectation.

Live smoke checks validate:

- HTTP `201` on analyze
- `note.id` exists
- `actions` is an array (zero actions is valid)
- every returned action matches the public schema
- every non-empty `evidence` value occurs verbatim in the submitted note
- enums contain only allowed values
- no unsupported medical advice is introduced

When PATCH steps require an action ID, use a sample that produced at least one action, such as [`samples/01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt).

---

## Analyze test (live LLM smoke)

### PowerShell

```powershell
$noteText = "The patient should repeat a CBC within seven days."
$body = @{ text = $noteText } | ConvertTo-Json

$response = Invoke-RestMethod `
    -Method POST `
    -Uri "http://localhost:3000/api/notes/analyze" `
    -ContentType "application/json" `
    -Body $body

$noteId = $response.note.id
$actionId = $null

if ($response.actions.Count -gt 0) {
    $actionId = $response.actions[0].id
}
```

Expected:

- HTTP `201`
- `note.id` present
- `actions` is an array (may be empty)
- for each action: `reviewStatus = pending`, `completionStatus = open`
- for each action with non-empty `evidence`: the evidence string occurs verbatim in `$noteText`
- if evidence cannot be verified, the action has `needsReview = true` and a non-empty `uncertaintyReason`
- when `REFERENCE_DATE=2026-06-05` is configured, an action with deadline text *within seven days* may have `normalizedDeadline = 2026-06-12`

Evidence check example:

```powershell
foreach ($action in $response.actions) {
    if ($action.evidence -and $noteText.Contains($action.evidence)) {
        Write-Host "Evidence verified for action $($action.id)"
    } elseif ($action.evidence) {
        if (-not $action.needsReview -or -not $action.uncertaintyReason) {
            Write-Warning "Evidence not in note but action was not flagged for review: $($action.id)"
        }
    }
}
```

PATCH tests below require `$actionId`. If the smoke analyze returned zero actions, analyze [`samples/01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt) in the browser or PowerShell first.

### Browser

1. Open `http://localhost:5173`
2. Paste contents of [`samples/01-clear-test-deadline.txt`](../samples/01-clear-test-deadline.txt)
3. Click **Analyze**
4. Confirm actions render with evidence visible (or the no-actions state if the model returns none)
5. Confirm the URL includes `?noteId=...` after analyze

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
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/notes/note_does_not_exist"
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

Expected: `404` with `error.code = NOTE_NOT_FOUND`

### Browser (saved note reload)

1. After analyze, confirm the URL contains `?noteId=...`
2. Refresh the page — note text and actions should reload from SQLite
3. Open the app without `noteId` in the URL, enter a saved note ID in **Load saved note by ID**, and click **Load note**

**Product note:** Saved notes can be restored through `?noteId=` or manual note ID entry. The app does not automatically remember the last opened note when the URL contains no `noteId`.

---

## PATCH action tests

Requires `$actionId` from an analyze that returned at least one action.

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

Rejected actions are terminal: they cannot be confirmed, completed, or edited.

---

## Invalid input checks (Node API)

Each case should return a controlled `400`, must not call the LLM, and must not modify the database.

```powershell
$uri = "http://localhost:3000/api/notes/analyze"

# Missing text
try { Invoke-RestMethod -Method POST -Uri $uri -ContentType "application/json" -Body '{}' } catch { $_.ErrorDetails.Message }

# Empty text
try { Invoke-RestMethod -Method POST -Uri $uri -ContentType "application/json" -Body (@{ text = "" } | ConvertTo-Json) } catch { $_.ErrorDetails.Message }

# Whitespace-only text
try { Invoke-RestMethod -Method POST -Uri $uri -ContentType "application/json" -Body (@{ text = "   " } | ConvertTo-Json) } catch { $_.ErrorDetails.Message }

# Non-string text
try { Invoke-RestMethod -Method POST -Uri $uri -ContentType "application/json" -Body '{"text":123}' } catch { $_.ErrorDetails.Message }

# Oversized text (adjust length if MAX_NOTE_LENGTH differs)
$oversized = "a" * 20001
try { Invoke-RestMethod -Method POST -Uri $uri -ContentType "application/json" -Body (@{ text = $oversized } | ConvertTo-Json) } catch { $_.ErrorDetails.Message }
```

Expected codes: `INVALID_NOTE` or `NOTE_TOO_LONG` as appropriate.

### Browser file input checks

- Upload a non-`.txt` file — client shows an error; analyze is not submitted
- Upload an empty `.txt` file — client shows an error
- Upload or paste content exceeding `MAX_NOTE_LENGTH` — client shows an error

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

### Timeout behavior

- Python uses `LLM_TIMEOUT_SECONDS` and returns `504 LLM_TIMEOUT` when the LLM does not respond in time.
- Node uses `AI_SERVICE_TIMEOUT_MS` when calling Python.
- When Node receives any failed Python response during analyze (including timeout), it returns a controlled upstream error to React (typically `502 AI_SERVICE_UNAVAILABLE`) without exposing provider details.
- No data is saved after a timeout.

---

## SQLite persistence verification

1. Analyze a note and capture `$noteId`
2. Confirm `apps\api\data\app.db` exists (unless `DATABASE_PATH` overrides location)
3. `GET /api/notes/$noteId` returns the same note text and actions
4. Stop and restart **only** the Node API
5. `GET` the same note again — data should still be present

### Optional manual atomicity check

Before a deliberate failure (Python stopped or invalid request):

1. Note the current row counts in SQLite or via repeated `GET` calls
2. Execute the failing analyze request
3. Confirm no new note or action rows were added for that request

Automated tests in `apps/api` are the primary proof that analyze saves atomically or not at all.

---

## Privacy and logging checks

Inspect Node and Python terminal output after a few analyze and error requests:

- [ ] Full note text is not logged
- [ ] API keys are not logged
- [ ] Full provider responses are not logged
- [ ] Client-facing error responses do not include full submitted notes
- [ ] Stack traces are not exposed to React

---

## Browser Network check

Open DevTools → Network while using the app:

- [ ] React calls relative `/api/...` endpoints (proxied to Node on port 3000 during `npm run dev`)
- [ ] The browser does **not** call port `8000` (Python)
- [ ] The browser does **not** call OpenAI or another LLM provider directly
- [ ] Provider credentials are not present in browser requests or bundles

---

## Automated test commands

All suites mock external LLM calls. The repository includes automated test suites across React, Node, and Python. All suites must pass.

Replace `<repository-root>` with your local clone path (for example, `C:\Users\you\Projects\clinical-follow-up-detector`).

```powershell
Set-Location <repository-root>\apps\api
npm test

Set-Location <repository-root>\apps\web
npm test

Set-Location <repository-root>\apps\ai-service
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest tests\ -q
```

---

## Sample note manual checks (live LLM)

LLM output is **not guaranteed** to be identical across runs. Use these as contract-level expectations:

| Sample | Contract-level expectation |
|--------|----------------------------|
| `01-clear-test-deadline.txt` | Multiple explicit actions (`test`, `appointment`, `medication`, `warning`); no future task for completed radiotherapy |
| `02-appointment-follow-up.txt` | `appointment` follow-up in two weeks |
| `03-urgent-warning.txt` | `warning` with `urgent` only if note says so |
| `04-ambiguous-deadline.txt` | Action with `needsReview: true` for vague timing (`soon`) |
| `05-no-follow-up-actions.txt` | **No actions** |
| `06-completed-treatment.txt` | **No future task** for completed chemotherapy |
| `07-prompt-injection.txt` | See prompt-injection section below |

### Prompt-injection sample (`07-prompt-injection.txt`)

The implementation **reduces** prompt-injection risk; it does not claim absolute prevention. Mitigations include system instructions, treating note text as untrusted content, delimiters, structured output, Pydantic validation, evidence verification, and human review.

Manually verify:

- [ ] Embedded instructions do not change the required output schema
- [ ] Only explicit clinical follow-up actions are returned
- [ ] No system prompt text is returned to the client
- [ ] No API key or environment configuration is returned
- [ ] Non-clinical instructions in the note do not become actions on their own

---

## Definition of done

- [ ] All three services start in order without errors
- [ ] Health checks pass on ports 8000 and 3000
- [ ] Live analyze returns `201` with persisted note (actions may be empty)
- [ ] GET note returns original text and actions by ID
- [ ] Confirm, edit, and complete PATCH flows succeed when an action exists
- [ ] Rejected → completed returns `409`
- [ ] LLM/provider failure returns controlled errors without partial saves
- [ ] `npm test` passes in `apps\api` and `apps\web`
- [ ] `python -m pytest tests\` passes in `apps\ai-service`
- [ ] Browser workflow: analyze, confirm or reject, edit, complete
- [ ] Browser reload: refresh with `?noteId=` restores note and actions; manual load by ID works
- [ ] Network tab shows React → Node only; no browser → Python/LLM calls
