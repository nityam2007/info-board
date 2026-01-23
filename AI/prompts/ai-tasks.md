# AI: Task Extraction

> Small task: Extract actionable tasks from content.

## When to Use

- Post contains action items
- User requests task extraction

## Template

```
Content: [post content]

Extract:
- Action items (if any)
- Due dates (if mentioned)
- Priority (if implied)

Format: JSON array of task objects
```

## Output Expected

- Task array
- Each with description
- No content modification
