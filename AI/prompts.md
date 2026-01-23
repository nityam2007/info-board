# Prompts Reference

> Atomic task templates. Each prompt = ONE small task, perfect execution.

---

## Analyze (Read First)

```
Read: [file1, file2]
Tell me:
1. What does this code do?
2. Key functions/components?
3. Dependencies?
```
**Output:** Bullets only, no code

---

## Plan (Before Implement)

```
Task: [describe]
Break into steps:
1. Each step = 1 small change
2. Each step = verifiable
3. Order by dependency
```
**Output:** Numbered list (max 5-7)

---

## Implement: Function

```
Implement: [name]
File: [path]
Purpose: [what it does]
Inputs: [params]
Outputs: [return]
```
**Output:** Single function with types

---

## Implement: API Endpoint

```
Endpoint: [METHOD /path]
Purpose: [what]
Request Body: [schema]
Response: [schema]
DB: [which tables]
```
**Output:** Route handler with validation

---

## Implement: DB Query

```
Operation: [SELECT/INSERT/UPDATE/DELETE]
Table: [name]
DB: [SQLite or DuckDB]
Purpose: [what data]
```
**Output:** Parameterized SQL/ORM call

---

## Implement: Svelte Component

```
Component: [Name.svelte]
Purpose: [what it renders]
Props: [list]
State: [list]
Events: [list]
```
**Output:** Single .svelte file with Svelte 5 runes

---

## Implement: Canvas Feature

```
Feature: [what to render/handle]
Input: [data/events]
Output: [visual result]
Constraints: No UI state in render, 60fps
```
**Output:** Render function only

---

## Fix: Single Bug

```
Bug: [description]
File: [location]
Error: [message]
Expected: [correct]
Actual: [wrong]
```
**Output:** Root cause + minimal fix

---

## Refactor: Single Function

```
Target: [function]
File: [path]
Issue: [what's wrong]
Goal: [cleaner/faster]
Constraint: Same behavior
```
**Output:** Refactored function only

---

## Test: Single Function

```
Function: [name]
File: [path]
Cases: [happy, edge, error]
```
**Output:** Test block

---

## Add: Types

```
For: [module]
Location: [types file]
Define: [entities]
```
**Output:** Type definitions

---

## Add: Env Variable

```
Variable: [NAME]
Type: [string/boolean/number]
Default: [value]
Purpose: [what it controls]
```
**Output:** .env.example + config update

---

## Review: Code

```
Review: [file/function]
Check:
- [ ] Follows rules.md
- [ ] Follows architecture.md
- [ ] Not in mistakes.md
- [ ] Async/non-blocking
- [ ] Error handling
```
**Output:** Pass/Fail + issues

---

## AI: Tag Suggestion

```
Content: [post content]
Type: [text/image/url]
Generate: 3-5 tags + 1 category
Format: JSON array
```

---

## AI: Task Extraction

```
Content: [post content]
Extract: Action items, due dates, priority
Format: JSON array of task objects
```

---

## AI: Search Query

```
Query: [user question]
Context: [relevant posts]
Respond: Direct answer + source refs
```
