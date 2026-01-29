# 3rd Party Integrations

Extensions and apps to capture content from outside the web interface.

## Available Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| [Mobile App](./mobile/) | Capture via Android share intent | Planned |
| [Chrome Extension](./chrome/) | One-click capture from browser | Planned |

## API Endpoint

All integrations use the same backend API:

```
POST /api/posts          - Create text post
POST /api/upload         - Upload file (base64)
POST /api/upload/url     - Upload URL with metadata extraction
```

## Authentication

Simple password-based auth (set via `PASSWORD` env var).
