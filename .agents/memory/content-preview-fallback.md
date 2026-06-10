---
name: Content preview calendar fallback
description: The /api/content-preview/:clientSlug route must merge scheduler AND calendar posts, with slug fallback for calendar-only clients
---

## Rule
Content preview merges two sources:
1. `scheduledPostsTable` — queried by `presetId` (only when preset exists for slug)
2. `calendarPostsTable` — queried by `clientName` text match (always)

Slug resolution: try `clientPresetsTable` first; if no match, scan `calendarPostsTable` for a matching slugified `clientName`.

**Why:** Most clients only have calendar entries, not scheduled posts. The original implementation only queried `scheduledPostsTable`, so the preview was always empty for calendar-only clients like "Skin Clinic London".

## How to apply
- `safeClientSlug(name)` = `name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`
- If client exists in presets: query both tables
- If client only in calendar: return calendar posts only, `logoUrl: null`
- Calendar `status === "posted"` maps to `"published"` for display consistency
