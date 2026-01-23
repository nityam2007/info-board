# Add: Env Config

> Small task: Add ONE environment variable.

## When to Use

- New feature toggle
- New external config
- New secret

## Template

```
Variable: [NAME]
Type: [string/boolean/number]
Default: [value]
Purpose: [what it controls]

Add to:
- .env.example
- config loader
- types
```

## Output Expected

- .env.example update
- Config loader update
- Type update
