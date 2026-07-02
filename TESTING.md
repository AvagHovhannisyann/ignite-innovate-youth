# Testing report

Automated full-app UI verification, run via `npm run test:ui` (source:
`scripts/app-audit.mjs`). The harness stubs the Supabase backend (fake
signed-in session + fixture data for every table), so all authenticated
routes render with realistic content and no live database is needed.

## What each run covers

- **20 routes**: landing, auth, dashboard, schedule, opportunities, quests,
  feed, feed/create, community, agent, support, profile, achievements,
  masterclasses, trending, notifications, capabilities, admin,
  admin/quest-reviews, and a project detail page.
- **3 viewports per route**: 390×844 phone, 360×780 small phone (both with
  touch + mobile emulation), and 1440×900 desktop — 60 page renders per run.
- **Checks per render**:
  - uncaught console errors and page crashes
  - horizontal overflow (any element wider than the viewport)
  - tap targets smaller than ~40 px on touch viewports
  - unexpected redirects (only signed-in `/auth → /dashboard` is allowed)
- Full-page screenshots of every render are written to the directory given
  as the second CLI argument.

## Final result

**All 60 renders pass: zero console errors, zero horizontal overflow, zero
undersized tap targets, zero crashes.**

## Defects found and fixed during this pass

| # | Where | Defect | Fix |
|---|-------|--------|-----|
| 1 | Global CSS | `overflow-wrap: anywhere` + `hyphens: auto` broke Armenian words mid-word app-wide | `overflow-wrap: break-word`, no hyphenation |
| 2 | Fonts | Inter/Fraunces/Fredoka have no Armenian glyphs — whole app fell back to system fonts | Added Noto Sans/Serif Armenian fallbacks |
| 3 | Mobile layout | 184 px body padding applied to pages without the tab bar (landing, auth) | Scoped via `body:has(nav.mobile-tab-bar)`, reduced to 112 px |
| 4 | Landing | Hero chips clipped by `overflow-hidden`; heading overflowed its column; `<wbr>` forced a mid-word break | Restructured hero |
| 5 | Types | `/auth` search param made 20 `navigate()` calls fail typecheck | Optional `mode` with default |
| 6 | Landing `head` | React warning: invalid DOM prop `fetchpriority` | `fetchPriority` |
| 7 | Toasts | Global `<Toaster>` was never mounted — every `toast()` call in quests silently did nothing | Mounted in root |
| 8 | Dark mode | Schedule event colors used `text-*-700` only (unreadable on dark) | Added `dark:` variants |
| 9 | Agent chat | Assistant messages persisted in model-message shape; tool parts didn't survive thread reload | Persist `UIMessage.parts` via `toUIMessageStreamResponse.onEnd` |
| 10 | Tap targets | Navbar brand (32 px), auth password-eye (28 px wide), "back home" link (14 px), landing footer links (18 px), schedule week arrows (30 px), admin quest-review link (32 px), profile project links (18 px) | All raised to ≥44 px |
| 11 | Secondary pages | Assorted: missing 44 px targets, bare-text empty states, ad-hoc card styles, `truncate` without `min-w-0` (onboarding, support, notifications, trending, opportunities, feed, feed/create, profile, quests) | Fixed across all nine files |

## Known limitations

- The stub cannot exercise real network failure paths, RLS policies, or the
  live OpenRouter model — those need the real backend (see PR notes for the
  one-time Supabase setup).
- Supabase Realtime opens a WebSocket the stub can't intercept; the harness
  ignores that connection error (it is environmental, not an app defect).
