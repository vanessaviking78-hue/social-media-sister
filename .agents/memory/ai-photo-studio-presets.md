---
name: AI Photo Studio presets
description: 15 fixed prompt presets (ps-01..ps-15) that replaced the old outfit/background picker in the AI Portrait Studio
---

## Rule
Photo studio presets use IDs `ps-01` through `ps-15`. They are defined in `aiPortraitScenarios.ts` as `PHOTO_STUDIO_PRESETS`. The worker checks for these IDs first (before custom/legacy scenario logic).

**Why:** The old "outfit + background picker" UI was replaced with 15 specific editorial/clinical prompts curated by the user. The IDs must stay stable because they are stored in `aiGeneratedPortraitsTable.scenarioId`.

## How to apply
- Colour-variable presets: 3, 6, 7, 8, 11, 12, 15 — pass `scrubColor` in the scenario config
- `buildPhotoStudioPrompt(preset, colour?, aspectRatio?)` replaces `[COLOUR]`, adds aspect ratio description, appends universal negative prompt
- Per-job cap is 15 (raised from 6 in `aiPortrait.ts` route)
- Frontend shows inline colour input only when card is checked AND `hasColour === true`
