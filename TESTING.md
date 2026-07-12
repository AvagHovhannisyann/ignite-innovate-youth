# Testing and verification

The repository uses npm as its canonical package manager. Use Node.js 22 or
newer and install the exact dependency graph from `package-lock.json`:

```bash
npm ci
```

Copy `.env.example` to `.env` for real local development. The UI audit does
not need real credentials: it injects deterministic fixture-only Supabase
configuration when those variables are absent.

## Standard checks

```bash
npm run typecheck
npm run lint
npm run build
npm run audit:deps
```

`npm run check` runs typecheck, lint, and the production build in sequence.
GitHub Actions runs all four checks plus the full UI audit on pull requests and
pushes to `main`.

## Full UI audit

Install the Playwright-managed Chromium build once, then run the audit:

```bash
npm run test:ui:install
npm run test:ui
```

The audit starts an isolated Vite server on an available `127.0.0.1` port,
waits for it to be ready, and shuts it down when complete. This makes parallel
or interrupted audit runs independent. It discovers Chromium from, in
order: `APP_AUDIT_CHROMIUM`, Playwright's browser cache, the system `PATH`, and
standard Chrome/Chromium install locations. This avoids machine-specific
executable paths.

To audit the built Nitro/Vercel bundle, an already-running server, or retain
screenshots:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:ui -- --base-url http://127.0.0.1:4173
npm run test:ui -- --shots artifacts/ui-audit
```

Equivalent environment variables are `APP_AUDIT_BASE_URL`,
`APP_AUDIT_SHOTS`, and `APP_AUDIT_CHROMIUM`.

### Coverage

The harness validates that every top-level `.tsx` UI route source has at least
one case. A newly added route makes the audit fail until it is covered.
Currently it executes **31 route/state cases**, including:

- signed-out and signed-in landing states
- sign-in, sign-up, forgot-password, reset-link, and callback-error states
- incomplete-profile onboarding
- public and authenticated opportunities
- every authenticated student surface, project detail, quest evidence form,
  both admin surfaces, the legacy assistant redirect, and the 404 boundary

Every case runs under four browser profiles (**124 renders total**):

| Profile     | Viewport | Touch | Theme | Motion  |
| ----------- | -------: | :---: | :---: | :-----: |
| Small phone |  360×780 |  yes  | light | normal  |
| Phone       |  390×844 |  yes  | dark  | normal  |
| Tablet      | 768×1024 |  yes  | dark  | reduced |
| Desktop     | 1440×900 |  no   | light | normal  |

Each render fails on:

- browser console errors, uncaught exceptions, or Vite's error overlay
- failed or HTTP 4xx/5xx same-origin resources
- unexpected redirects
- incorrect light/dark or reduced-motion media state
- horizontal document overflow, with offending elements reported
- enabled interactive controls smaller than **44×44 CSS pixels** on touch
  profiles

Hydration errors are not filtered. External fonts and CDNs are fulfilled with
empty successful fixtures so offline CI does not create unrelated noise;
Supabase REST, Auth, Storage, Functions, and Realtime are locally stubbed.

### Scope limits

This is a deterministic render and responsive-layout gate. It does not prove
live RLS policies, real provider integrations, upload behavior, email delivery,
or OpenRouter model behavior. Those require backend integration and end-to-end
tests against an isolated Supabase project. Route-specific interaction tests
should be added separately as those workflows stabilize.
