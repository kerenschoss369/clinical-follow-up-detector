# Clinical Follow-Up Detector — API Contracts

This document defines the shared data contracts between:

* React frontend
* Node.js API
* Python FastAPI AI service
* SQLite persistence layer

These contracts are the source of truth for all Cursor agents working on the project.

Do not change an endpoint, field name, enum, or response structure without reviewing every affected service.

---

# 1. Naming conventions

## React and Node.js

React and Node.js use `camelCase`.

Example:

```json
{
  "deadlineText": "within seven days",
  "needsReview": true
}
```

## Python

Python uses `snake_case`.

Example:

```json
{
  "deadline_text": "within seven days",
  "needs_review": true
}
```

## Mapping responsibility

Node.js is responsible for converting Python `snake_case` fields into the `camelCase` fields returned to React.

React must never receive Python-specific field names.

---

# 2. Shared enums

## Action type

Allowed values:

```text
appointment
test
medication
treatment
warning
other
```

Meaning:

* `appointment`: a visit, consultation, or follow-up appointment
* `test`: blood test, imaging, laboratory test, or other clinical test
* `medication`: an explicitly written medication-related action
* `treatment`: chemotherapy, radiotherapy, procedure, or another treatment action
* `warning`: an explicit instruction to contact a clinic or seek help if a condition occurs
* `other`: an explicit follow-up action that does not fit another category

The system must not create a medication or treatment action unless it is explicitly written in the note.

## Priority

Allowed values:

```text
low
medium
high
urgent
```

Priority is an extraction label based only on the wording in the note.

Use `urgent` only when the note explicitly indicates urgency with wording such as:

```text
urgent
immediately
without delay
as soon as possible
emergency
```

Do not infer urgency only from the diagnosis or medical condition.

## Review status

Allowed values:

```text
pending
confirmed
rejected
```

Meaning:

* `pending`: extracted by AI but not yet reviewed
* `confirmed`: reviewed and accepted by the user
* `rejected`: reviewed and determined not to be a valid action

All newly extracted actions start with:

```text
pending
```

## Completion status

Allowed values:

```text
open
completed
```

Meaning:

* `open`: the confirmed action has not yet been marked completed
* `completed`: the action has been marked completed by the user

All newly extracted actions start with:

```text
open
```

Review status and completion status are separate.

Examples:

```text
pending + open
confirmed + open
confirmed + completed
rejected + open
```

A rejected action cannot be completed.

An action should normally be confirmed before it can be completed.

---

# 3. React to Node.js contracts

Base URL during local development:

```text
http://localhost:3000
```

## 3.1 Health check

### Endpoint

```http
GET /health
```

### Successful response

Status:

```text
200 OK
```

Body:

```json
{
  "status": "ok",
  "service": "api"
}
```

---

## 3.2 Analyze a note

### Endpoint

```http
POST /api/notes/analyze
```

### Purpose

Accepts fictional clinical note text, sends it to the Python AI service, saves the note and extracted actions, and returns the created application entities.

### Request body

```json
{
  "text": "The patient should repeat a CBC within seven days."
}
```

### Request validation

The `text` field must:

* exist
* be a string
* contain non-whitespace characters
* not exceed the configured maximum length

Recommended development limit:

```text
20,000 characters
```

### Successful response

Status:

```text
201 Created
```

Body:

```json
{
  "note": {
    "id": "note_01JYABC123",
    "createdAt": "2026-06-05T15:30:00.000Z"
  },
  "actions": [
    {
      "id": "action_01JYXYZ456",
      "noteId": "note_01JYABC123",
      "title": "Repeat CBC blood test",
      "type": "test",
      "deadlineText": "within seven days",
      "normalizedDeadline": null,
      "priority": "high",
      "evidence": "The patient should repeat a CBC within seven days.",
      "needsReview": false,
      "uncertaintyReason": null,
      "reviewStatus": "pending",
      "completionStatus": "open",
      "createdAt": "2026-06-05T15:30:00.000Z",
      "updatedAt": "2026-06-05T15:30:00.000Z"
    }
  ]
}
```

### Successful response with no actions

Status:

```text
201 Created
```

Body:

```json
{
  "note": {
    "id": "note_01JYABC123",
    "createdAt": "2026-06-05T15:30:00.000Z"
  },
  "actions": []
}
```

An empty action list is valid and must not be treated as an error.

---

## 3.3 Get a saved note

### Endpoint

```http
GET /api/notes/:noteId
```

### Successful response

Status:

```text
200 OK
```

Body:

```json
{
  "note": {
    "id": "note_01JYABC123",
    "text": "The patient should repeat a CBC within seven days.",
    "createdAt": "2026-06-05T15:30:00.000Z"
  },
  "actions": [
    {
      "id": "action_01JYXYZ456",
      "noteId": "note_01JYABC123",
      "title": "Repeat CBC blood test",
      "type": "test",
      "deadlineText": "within seven days",
      "normalizedDeadline": null,
      "priority": "high",
      "evidence": "The patient should repeat a CBC within seven days.",
      "needsReview": false,
      "uncertaintyReason": null,
      "reviewStatus": "confirmed",
      "completionStatus": "open",
      "createdAt": "2026-06-05T15:30:00.000Z",
      "updatedAt": "2026-06-05T15:35:00.000Z"
    }
  ]
}
```

---

## 3.4 Update an action

### Endpoint

```http
PATCH /api/actions/:actionId
```

### Purpose

Allows the user to:

* edit an extracted action
* confirm it
* reject it
* mark it completed

### Allowed editable fields

```text
title
type
deadlineText
normalizedDeadline
priority
reviewStatus
completionStatus
```

The following fields must not be editable through this endpoint:

```text
id
noteId
evidence
needsReview
uncertaintyReason
createdAt
updatedAt
```

For this portfolio project, source evidence remains unchanged after extraction.

### Example: confirm an action

Request:

```json
{
  "reviewStatus": "confirmed"
}
```

### Example: reject an action

Request:

```json
{
  "reviewStatus": "rejected"
}
```

### Example: edit an action

Request:

```json
{
  "title": "Repeat complete blood count",
  "priority": "medium"
}
```

### Example: mark completed

Request:

```json
{
  "completionStatus": "completed"
}
```

### Successful response

Status:

```text
200 OK
```

Body:

```json
{
  "action": {
    "id": "action_01JYXYZ456",
    "noteId": "note_01JYABC123",
    "title": "Repeat complete blood count",
    "type": "test",
    "deadlineText": "within seven days",
    "normalizedDeadline": null,
    "priority": "medium",
    "evidence": "The patient should repeat a CBC within seven days.",
    "needsReview": false,
    "uncertaintyReason": null,
    "reviewStatus": "confirmed",
    "completionStatus": "open",
    "createdAt": "2026-06-05T15:30:00.000Z",
    "updatedAt": "2026-06-05T15:40:00.000Z"
  }
}
```

### Invalid workflow transition

A rejected action cannot be marked completed.

Response status:

```text
409 Conflict
```

Body:

```json
{
  "error": {
    "code": "INVALID_ACTION_TRANSITION",
    "message": "A rejected action cannot be marked as completed."
  }
}
```

---

# 4. Node.js to Python AI service contracts

Base URL during local development:

```text
http://localhost:8000
```

## 4.1 Python health check

### Endpoint

```http
GET /health
```

### Successful response

Status:

```text
200 OK
```

Body:

```json
{
  "status": "ok",
  "service": "ai-service"
}
```

---

## 4.2 Extract actions

### Endpoint

```http
POST /extract-actions
```

### Purpose

Accepts note text and returns only validated AI extraction results.

The Python service does not:

* save notes
* create application IDs
* manage review status
* manage completion status
* access SQLite

### Request body

```json
{
  "text": "The patient should repeat a CBC within seven days.",
  "reference_date": "2026-06-05"
}
```

### Request fields

#### `text`

Required string containing the fictional note.

#### `reference_date`

Required ISO date in this format:

```text
YYYY-MM-DD
```

It is used only when the note contains a safely resolvable relative deadline such as:

```text
within seven days
tomorrow
in two weeks
```

Python must not use the server's current date implicitly.

Node must send the reference date explicitly so the behavior is deterministic and testable.

### Successful response

Status:

```text
200 OK
```

Body:

```json
{
  "actions": [
    {
      "title": "Repeat CBC blood test",
      "type": "test",
      "deadline_text": "within seven days",
      "normalized_deadline": "2026-06-12",
      "priority": "high",
      "evidence": "The patient should repeat a CBC within seven days.",
      "needs_review": false,
      "uncertainty_reason": null
    }
  ]
}
```

### Successful response with no actions

```json
{
  "actions": []
}
```

An empty list is valid.

---

# 5. Python extracted action schema

Each Python action must match this structure.

## `title`

Type:

```text
string
```

Rules:

* concise
* action-oriented
* based only on the source note
* must not add medical advice

Example:

```text
Repeat CBC blood test
```

## `type`

Type:

```text
enum
```

Allowed values:

```text
appointment
test
medication
treatment
warning
other
```

## `deadline_text`

Type:

```text
string | null
```

Rules:

* preserve the deadline wording from the note
* use `null` when no timing is provided
* do not invent wording

Examples:

```json
"within seven days"
```

```json
"on June 15"
```

```json
null
```

## `normalized_deadline`

Type:

```text
string | null
```

Format when present:

```text
YYYY-MM-DD
```

Rules:

* use only when the date can be safely resolved
* use `reference_date` for relative dates
* never guess a missing year
* never convert vague wording such as `soon` into an exact date
* use `null` when uncertain

## `priority`

Type:

```text
enum
```

Allowed values:

```text
low
medium
high
urgent
```

Rules:

* base priority on explicit note wording
* do not infer clinical severity
* use `urgent` only for explicit urgency

## `evidence`

Type:

```text
string
```

Rules:

* must be copied exactly from the source note
* must directly support the action
* must not be paraphrased
* must not be empty
* must occur verbatim in the source note

After parsing the LLM response, Python must verify:

```text
evidence exists inside the submitted note text
```

If evidence cannot be verified, the action must not be silently accepted.

Recommended project behavior:

* keep the action
* set `needs_review` to `true`
* set an appropriate `uncertainty_reason`

## `needs_review`

Type:

```text
boolean
```

Use `true` when:

* the deadline is vague
* the responsible party is unclear
* the action is implied rather than explicit
* evidence verification fails
* date normalization is uncertain
* the model output cannot be fully trusted

Use `false` only when the action is explicit and verifiable.

## `uncertainty_reason`

Type:

```text
string | null
```

Rules:

* required when `needs_review` is `true`
* must be `null` when `needs_review` is `false`
* must describe the uncertainty concisely

Example:

```json
{
  "needs_review": true,
  "uncertainty_reason": "The note says 'soon' and does not provide an exact deadline."
}
```

---

# 6. Node mapping from Python to React

Python response:

```json
{
  "title": "Repeat CBC blood test",
  "type": "test",
  "deadline_text": "within seven days",
  "normalized_deadline": "2026-06-12",
  "priority": "high",
  "evidence": "The patient should repeat a CBC within seven days.",
  "needs_review": false,
  "uncertainty_reason": null
}
```

Node converts it into:

```json
{
  "title": "Repeat CBC blood test",
  "type": "test",
  "deadlineText": "within seven days",
  "normalizedDeadline": "2026-06-12",
  "priority": "high",
  "evidence": "The patient should repeat a CBC within seven days.",
  "needsReview": false,
  "uncertaintyReason": null
}
```

Node then adds:

```json
{
  "id": "action_01JYXYZ456",
  "noteId": "note_01JYABC123",
  "reviewStatus": "pending",
  "completionStatus": "open",
  "createdAt": "2026-06-05T15:30:00.000Z",
  "updatedAt": "2026-06-05T15:30:00.000Z"
}
```

---

# 7. Standard Node API error format

All Node errors returned to React must use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message."
  }
}
```

Optional development-only details may be logged on the server, but must not be exposed to React.

## Invalid note

Status:

```text
400 Bad Request
```

Body:

```json
{
  "error": {
    "code": "INVALID_NOTE",
    "message": "Note text is required."
  }
}
```

## Note too long

Status:

```text
400 Bad Request
```

Body:

```json
{
  "error": {
    "code": "NOTE_TOO_LONG",
    "message": "The note exceeds the maximum allowed length."
  }
}
```

## Unsupported file type

Status:

```text
400 Bad Request
```

Body:

```json
{
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "Only .txt files are supported."
  }
}
```

## Note not found

Status:

```text
404 Not Found
```

Body:

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "The requested note was not found."
  }
}
```

## Action not found

Status:

```text
404 Not Found
```

Body:

```json
{
  "error": {
    "code": "ACTION_NOT_FOUND",
    "message": "The requested action was not found."
  }
}
```

## Invalid workflow transition

Status:

```text
409 Conflict
```

Body:

```json
{
  "error": {
    "code": "INVALID_ACTION_TRANSITION",
    "message": "The requested action status change is not allowed."
  }
}
```

## Python service unavailable

Status:

```text
502 Bad Gateway
```

Body:

```json
{
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "message": "The note could not be analyzed because the AI service is unavailable."
  }
}
```

## Invalid AI response

Status:

```text
502 Bad Gateway
```

Body:

```json
{
  "error": {
    "code": "INVALID_AI_RESPONSE",
    "message": "The AI service returned an invalid response. No data was saved."
  }
}
```

## Unexpected server error

Status:

```text
500 Internal Server Error
```

Body:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected server error occurred."
  }
}
```

---

# 8. Python AI service error format

Errors returned from Python to Node must use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message."
  }
}
```

## Invalid request

Status:

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "INVALID_EXTRACTION_REQUEST",
    "message": "Note text is required."
  }
}
```

## LLM provider timeout

Status:

```text
504 Gateway Timeout
```

Example:

```json
{
  "error": {
    "code": "LLM_TIMEOUT",
    "message": "The language model did not respond within the allowed time."
  }
}
```

## LLM provider failure

Status:

```text
502 Bad Gateway
```

Example:

```json
{
  "error": {
    "code": "LLM_PROVIDER_ERROR",
    "message": "The language model provider could not process the request."
  }
}
```

## Invalid model output

Status:

```text
502 Bad Gateway
```

Example:

```json
{
  "error": {
    "code": "INVALID_MODEL_OUTPUT",
    "message": "The model returned output that did not match the required schema."
  }
}
```

Python must not return:

* raw provider stack traces
* API keys
* complete provider responses
* internal prompts
* full note text in error messages

---

# 9. Persistence contracts

## Notes table

Recommended fields:

```text
id
original_text
created_at
```

Suggested SQL types:

```sql
id TEXT PRIMARY KEY
original_text TEXT NOT NULL
created_at TEXT NOT NULL
```

## Actions table

Recommended fields:

```text
id
note_id
title
type
deadline_text
normalized_deadline
priority
evidence
needs_review
uncertainty_reason
review_status
completion_status
created_at
updated_at
```

Suggested SQL types:

```sql
id TEXT PRIMARY KEY
note_id TEXT NOT NULL
title TEXT NOT NULL
type TEXT NOT NULL
deadline_text TEXT NULL
normalized_deadline TEXT NULL
priority TEXT NOT NULL
evidence TEXT NOT NULL
needs_review INTEGER NOT NULL
uncertainty_reason TEXT NULL
review_status TEXT NOT NULL
completion_status TEXT NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
FOREIGN KEY (note_id) REFERENCES notes(id)
```

SQLite stores booleans as:

```text
0 = false
1 = true
```

Node converts them into JavaScript booleans before returning data to React.

---

# 10. Data-saving rules

Node saves data only after:

1. React request validation succeeds.
2. Python returns a successful response.
3. Python response shape is validated by Node.
4. All extracted actions can be mapped safely.

If the AI response is invalid:

* do not save the note
* do not save partial actions
* return a controlled error

The note and its actions should be saved as one logical operation.

A database transaction is recommended.

---

# 11. File upload behavior

The React frontend may accept:

* pasted text
* one `.txt` file

The frontend reads the `.txt` file as text and sends the resulting text to Node using the same request contract:

```json
{
  "text": "Contents of the uploaded file"
}
```

The first version does not require multipart file upload.

React must reject:

* non-`.txt` files
* empty files
* files that exceed the configured note-length limit

Node must still validate the final text because frontend validation cannot be trusted.

---

# 12. Security and privacy boundaries

This portfolio project uses fictional medical data only.

The system must not:

* store real patient information
* log complete note content
* expose LLM API keys
* send provider credentials to React
* allow React to call the LLM directly
* claim clinical accuracy
* claim HIPAA compliance
* claim production readiness

The system extracts explicit follow-up actions only.

It does not:

* diagnose
* recommend treatment
* prescribe medication
* alter dosage
* verify medical correctness
* replace human review

---

# 13. Contract ownership by service

## React owns

* user input
* `.txt` file reading
* loading state
* error state
* rendering actions
* review controls
* edit controls
* completion controls

## Node owns

* public application API
* request validation
* Python-service communication
* Python-to-React field mapping
* persistence
* IDs
* review status
* completion status
* workflow validation
* application error responses

## Python owns

* prompt construction
* LLM provider communication
* structured-output parsing
* Pydantic validation
* evidence verification
* uncertainty handling
* AI-specific errors

## SQLite owns

* persisted notes
* persisted actions
* current review state
* current completion state
* created and updated timestamps

---

# 14. Contract-change policy

Before changing this document:

1. Identify every affected service.
2. Explain why the change is needed.
3. Update the contract first.
4. Update Python models if affected.
5. Update Node schemas and mappings if affected.
6. Update React types if affected.
7. Update tests.
8. Update documentation examples.

Cursor agents must not independently modify this file while working in parallel.

One agent or the project owner must be responsible for contract changes.
