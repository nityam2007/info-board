# AI: Tag Suggestion

> Small task: Generate tag suggestions for a post.

## When to Use

- After post creation
- User requests tags

## Template

```
Content: [post content]
Content Type: [text/image/url/audio]

Generate:
- 3-5 relevant tags
- 1 category suggestion

Format: JSON array of strings
```

## Output Expected

- Tag array
- Confidence optional
- No content modification
