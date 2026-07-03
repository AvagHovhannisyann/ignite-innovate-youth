# DESIGN_BLUEPRINT.md — Ignite Innovate Youth Design System Extraction

Reference URL audited: <https://ignite-innovate-youth-pearl.vercel.app>  
Audit date: 2026-07-03 UTC  
Scope: read-only app/source review plus isolated blueprint creation for future implementation.

> Note: the user requested no live application/source changes. This file is intentionally isolated at the repository root and does not alter runtime app code. Package/tool installation was performed for future analysis workflows.

---

## 1. Environment Preparation Summary

### Requested dependencies

- `remotion`
- `@remotion/player`
- `lucide-react`

These packages are present in the workspace after running the requested npm install command.

### Analysis / automation tooling

- `shot-scraper` installed through Python/pip because `shot-scraper` is not published as an npm package in the active registry.
- `pa11y` installed globally through npm.
- `lightbox-cli` installed globally through npm, but the deprecated `lightbox-cli@0.1.0` package did not expose a usable `lightbox-cli` shell binary in this environment. Treat it as installed but not operational; prefer `shot-scraper`, Playwright, or an available maintained replacement in future phases.
- Playwright browser dependencies were installed through apt so screenshot and browser automation tooling can run in this container.

### Generated audit artifacts outside the repo

- `/tmp/ignite-audit/home-desktop.png` — desktop full-page/reference screenshot at 1440px width.
- `/tmp/ignite-audit/home-mobile.png` — mobile screenshot at 390px width.
- `/tmp/ignite-audit/tokens.json` — computed CSS variables and sampled computed styles.
- `/tmp/ignite-audit/pa11y.json` — pa11y JSON report.

### Accessibility audit result

- `pa11y` reported **0 issues** for the public reference landing page under the configured headless Chrome run.

---

## 2. Reference Design System: Extracted Tokens

The live site is already driven by a strong semantic CSS-token system. The exact source tokens below were extracted from the live computed CSS variables and cross-checked against the local source files.

### 2.1 Color palette

#### Core semantic palette — light mode

| Token | OKLCH | Approx role |
|---|---:|---|
| `--background` | `oklch(99% .005 230)` | near-white cool page background |
| `--foreground` | `oklch(20% .04 240)` | deep blue/slate text |
| `--card` | `oklch(100% 0 0)` | white card surface |
| `--card-foreground` | `oklch(20% .04 240)` | card text |
| `--popover` | `oklch(100% 0 0)` | floating layer surface |
| `--popover-foreground` | `oklch(20% .04 240)` | popover text |
| `--primary` | `oklch(68% .14 235)` | logo blue / primary action |
| `--primary-foreground` | `oklch(99% 0 0)` | white text on primary |
| `--primary-glow` | `oklch(78% .12 230)` | bright blue glow |
| `--secondary` | `oklch(96% .02 230)` | subtle cool surface |
| `--secondary-foreground` | `oklch(25% .05 240)` | text on secondary |
| `--muted` | `oklch(96% .012 230)` | muted surface |
| `--muted-foreground` | `oklch(50% .025 240)` | muted text |
| `--accent` | `oklch(72% .17 55)` | warm orange brand accent |
| `--accent-foreground` | `oklch(99% 0 0)` | white text on accent |
| `--accent-soft` | `oklch(95% .04 235)` | pale blue accent wash |
| `--accent-soft-foreground` | `oklch(45% .15 240)` | blue text on accent-soft |
| `--destructive` | `oklch(60% .22 25)` | destructive/error |
| `--destructive-foreground` | `oklch(99% 0 0)` | text on destructive |
| `--success` | `oklch(65% .15 155)` | success green |
| `--success-foreground` | `oklch(99% 0 0)` | text on success |
| `--border` | `oklch(92% .012 230)` | subtle cool border |
| `--input` | `oklch(94% .012 230)` | input border/background |
| `--ring` | `oklch(68% .14 235)` | focus ring blue |

Approximate brand HEX anchors from source comments:

- Primary/logo blue: `#2BA8E0`.
- Accent/logo orange: `#F39B3D`.
- Foreground is visually a deep navy/slate near `#061B2A` to `#102334` depending on antialiasing and OKLCH conversion.
- Muted text is a blue-gray near `#657482`.
- Border is a very light blue-gray near `#DDE8EF`.

#### Dark mode semantic palette

| Token | OKLCH | Approx role |
|---|---:|---|
| `--background` | `oklch(16% .02 250)` | deep navy page background |
| `--foreground` | `oklch(93% .012 240)` | soft near-white text |
| `--card` | `oklch(20.5% .025 248)` | elevated dark card |
| `--primary` | `oklch(72% .13 235)` | bright blue action |
| `--primary-foreground` | `oklch(13% .03 245)` | dark text on primary |
| `--secondary` | `oklch(26% .025 246)` | dark secondary surface |
| `--muted` | `oklch(24% .02 246)` | muted dark surface |
| `--muted-foreground` | `oklch(68% .02 240)` | muted light text |
| `--accent` | `oklch(74% .15 58)` | warm orange accent |
| `--border` | `oklch(30% .022 246)` | dark border |
| `--ring` | `oklch(72% .13 235)` | focus ring |

### 2.2 Gradients

| Token | Value | Usage |
|---|---|---|
| `--gradient-hero` | `linear-gradient(135deg, oklch(68% .14 235) 0%, oklch(78% .12 230) 100%)` | primary blue hero/action gradient |
| `--gradient-warm` | `linear-gradient(135deg, oklch(76% .16 60) 0%, oklch(82% .13 55) 100%)` | warm orange XP/badge accents |
| `--gradient-brand` | `linear-gradient(135deg, oklch(68% .14 235) 0%, oklch(76% .16 60) 100%)` | blue-to-orange brand text/accents |
| `--gradient-soft` | radial blue wash + radial orange wash + cool white linear base | full-page background |
| `--gradient-card` | `linear-gradient(160deg, oklch(100% 0 0/.9) 0%, oklch(98% .015 230/.7) 100%)` | translucent elevated cards |

### 2.3 Typography

#### Font families

- Sans/UI: `Inter`, `Noto Sans Armenian`, `ui-sans-serif`, `system-ui`, `sans-serif`.
- Display/headline: `Fraunces`, `Noto Serif Armenian`, `ui-serif`, `Georgia`, `serif`.
- Mono: standard Tailwind/system mono stack.

#### Weights

- Normal: `400`.
- Medium: `500`.
- Semibold: `600`.
- Bold: `700`.

#### Observed type scale

| Context | Desktop computed size | Line-height | Weight | Family |
|---|---:|---:|---:|---|
| Hero H1 | `64px` | `69.12px` / `1.08` | `400` | display |
| Section H2 | `48px` | `60px` / `1.25` | `400` | display |
| Card H3 | `20px` | `25px` / `1.25` | `400` | display |
| Body lead | `18px` | relaxed, about `1.625` | `400` | sans |
| Body regular | `16px` | `24px` | `400` | sans |
| Button/nav small | `14px` | `20px` | `400–500` | sans |
| Eyebrow label | `11–12px` | compact | `500–600` | sans, uppercase/tracked |
| Micro labels | `10–11px` | compact | `500–700` | sans |

#### Typography behavior

- Armenian text uses Noto Armenian fallbacks to prevent glyph fallback artifacts.
- Headlines intentionally use large display type with italic gradient spans.
- Mobile headline scales down to `26px`, then `31px` above 380px, then `48–64px` at larger breakpoints.
- UI copy uses muted blue-gray for supporting text and stronger navy for primary text.

### 2.4 Spacing scale

The reference uses Tailwind’s 4px-based scale with dense responsive adjustments.

| Token / utility | Pixels | Observed usage |
|---|---:|---|
| `px-2` | `8px` | icon buttons, compact controls |
| `px-3` | `12px` | mobile page gutters, nav links |
| `px-4` | `16px` | buttons, cards, chips |
| `px-5` | `20px` | CTA buttons/cards |
| `px-6` | `24px` | desktop gutters/cards |
| `px-7` | `28px` | large pill CTAs |
| `md:px-10` | `40px` | large section gutters |
| `gap-2` | `8px` | icon/text groups |
| `gap-3` | `12px` | mobile card grid, CTA stack |
| `gap-4` | `16px` | primary layout spacing |
| `gap-10` | `40px` | hero grid gap |
| `lg:gap-14` | `56px` | desktop hero gap |
| `py-14` | `56px` | mobile section vertical rhythm |
| `sm:py-20` | `80px` | tablet section rhythm |
| `md:py-28` | `112px` | desktop section rhythm |

### 2.5 Border radius

| Token / utility | Value | Usage |
|---|---:|---|
| `--radius` | `1rem` / `16px` | base component radius |
| `--radius-sm` | `12px` | smaller controls |
| `--radius-md` | `14px` | medium controls |
| `--radius-lg` | `16px` | nav links/buttons/cards |
| `--radius-xl` | `20px` | cards / rounded panels |
| `--radius-2xl` | `24px` | bento cards / large surfaces |
| `rounded-full` | pill/circle | CTAs, badges, icon buttons |

### 2.6 Shadows and elevation

| Token | Value | Usage |
|---|---|---|
| `--shadow-soft` | `0 1px 2px oklch(20% .04 240/.04), 0 8px 24px -12px oklch(55% .14 235/.18)` | default card/button elevation |
| `--shadow-elegant` | `0 1px 2px ... , 0 24px 60px -24px oklch(55% .14 235/.28)` | hero CTA, large panels |
| `--shadow-glow` | `0 0 60px oklch(76% .16 60/.25)` | warm brand glow |
| `--shadow-lift` | `0 30px 80px -30px oklch(55% .14 235/.35)` | hover/elevated states |

### 2.7 Borders, glass, and surface treatment

- Borders are typically `1px solid var(--border)` or `border-border/60`.
- Header uses `background: var(--background) / 80–85%` plus `backdrop-blur-md`.
- Cards use `bg-gradient-card`, `bg-card/60`, or white translucent panels.
- Hero background combines large blurred blue and orange radial blobs.
- Bento cards use cursor-tracked glow variables (`--glow-x`, `--glow-y`) and subtle border/shadow.

### 2.8 Motion and interaction

Observed motion primitives:

- Tailwind transition curve: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Standard transition duration: `150ms` for color/background/border changes.
- CTA hover lift and arrow transform: `300ms`, translate/rotate microinteraction.
- Reveal/rise animations for scroll/entry.
- Floating logo animation in hero bento.
- Pulse animation on small status dot.
- Count-up stats.
- Cursor-tracked bento glow.

Recommended future timing tokens:

```ts
const motion = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  expressive: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  reveal: '600ms cubic-bezier(0.16, 1, 0.3, 1)',
};
```

---

## 3. Repository Architecture Mapping

### Current app stack

- React 19 + TypeScript.
- TanStack Start / TanStack Router file routes.
- Tailwind CSS v4.
- Radix UI primitives already installed for accessible UI foundations.
- Supabase client for auth/data.
- AI SDK/OpenRouter for assistant/recommendation flows.
- Recharts for admin analytics.
- Sonner for toasts.
- Remotion and `@remotion/player` are available for video-as-code work.

### Existing design system locations

| Area | Current location | Future design-system relevance |
|---|---|---|
| Global tokens/theme | `src/styles.css` | canonical token source |
| UI primitives | `src/components/ui/*` | should remain Radix/shadcn-compatible |
| App shell/sidebar | `src/components/AppShell.tsx` | future Sidebar component should align without breaking auth shell |
| Guest nav | `src/components/Navbar.tsx` | future Button/Dropdown primitives can standardize links/actions |
| Toasts | `src/components/ui/sonner.tsx` | future Toast wrapper should preserve Sonner internals |
| Calendar components | `src/components/calendar/*` | future Card/Input/Modal patterns should not disrupt schedule UX |
| AI chat | `src/components/AgentChat.tsx` | future Card/Input/Button variants should support chat density |
| Root document/head | `src/routes/__root.tsx` | font loading and CSS linkage live here |
| Remotion support | `src/components/remotion-autoplay.ts` | future video template can reuse installed Remotion stack |

### Future implementation rules

1. Preserve semantic tokens; do not hard-code brand colors in components unless adding token aliases.
2. Build components as strict TypeScript with discriminated variant props where helpful.
3. Keep Radix primitives underneath Modal/Dropdown/Accordion for accessibility.
4. Use Tailwind classes mapped to existing tokens; avoid custom CSS unless a token or keyframe is missing.
5. Maintain Armenian typography and wrapping constraints.
6. Do not replace existing app shell in one pass; introduce components incrementally and migrate page-by-page.
7. Maintain `forwardRef` for focusable primitives.
8. Support `asChild` where Radix Slot is already a pattern.
9. Ensure each primitive has clear disabled/loading/focus-visible behavior.
10. Keep all animated components respectful of `prefers-reduced-motion`.

---

## 4. Future Component Architecture Plan

### 4.1 Button

#### Goal

A single strict TypeScript button primitive that supports primary, secondary, ghost, outline, destructive, warm/accent, icon-only, loading, disabled, active, hover, and focus states without visual quality loss.

#### Proposed API

```ts
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'warm' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  active?: boolean;
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};
```

#### Styling blueprint

- Primary: `bg-primary text-primary-foreground shadow-soft hover:opacity-90 hover:shadow-elegant`.
- Hero CTA option: `bg-foreground text-background shadow-elegant hover:shadow-lift rounded-full`.
- Secondary: `border border-border/70 bg-card/60 hover:border-foreground/30 hover:bg-secondary`.
- Warm: `bg-gradient-warm text-accent-foreground shadow-soft`.
- Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Disabled: `disabled:pointer-events-none disabled:opacity-50`.
- Loading: render `Loader2` with `animate-spin`; keep width stable.
- Icon-only: `size-9` or `size-11`, `rounded-full`, accessible `aria-label` required by convention.

### 4.2 Card

#### Goal

A flexible bento/card primitive for grids, dashboard stats, opportunity items, chat modules, and feature panels.

#### Proposed API

```ts
type CardTone = 'default' | 'glass' | 'gradient' | 'interactive' | 'brand' | 'warm';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
  padding?: CardPadding;
  interactive?: boolean;
  glow?: boolean;
};
```

#### Styling blueprint

- Base: `rounded-2xl border border-border bg-card text-card-foreground shadow-soft`.
- Gradient: `bg-gradient-card`.
- Glass: `bg-card/70 backdrop-blur-md border-border/60`.
- Interactive: `transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant`.
- Glow: attach `onMouseMove={trackGlow}` and use a CSS pseudo-element only when needed.
- Badge support through composable `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, and optional `CardMedia`.

### 4.3 Input

#### Goal

A form field primitive with floating labels, helper text, validation state, icons, and consistent mobile-safe font sizing.

#### Proposed API

```ts
type InputState = 'default' | 'error' | 'success';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  errorText?: string;
  state?: InputState;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  floatingLabel?: boolean;
};
```

#### Styling blueprint

- Shell: `relative rounded-xl border bg-background/80 transition-colors`.
- Default border: `border-input focus-within:border-ring`.
- Error: `border-destructive text-destructive` helper.
- Success: `border-success` helper.
- Input: `h-12 w-full bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground`.
- Floating label: transform from centered to `top-1 text-[11px]` when focused or non-empty.
- Helper/error text: `mt-1.5 text-xs` with muted/destructive tone.

### 4.4 Modal

#### Goal

Accessible modal/dialog built on Radix Dialog with focus trapping, backdrop dimming, blur, animated content, and brand-consistent cards.

#### Proposed foundation

- Use existing `src/components/ui/dialog.tsx` as base.
- Wrap into product-level `Modal` only if API consistency is needed.

#### Styling blueprint

- Overlay: `fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm animate-fade-in`.
- Content: `rounded-2xl border border-border bg-card shadow-elegant`.
- Max widths: `sm:max-w-md`, `md:max-w-lg`, `lg:max-w-2xl`.
- Mobile: bottom sheet fallback can use existing drawer/vaul when appropriate.
- Close button: icon-only ghost, `top-4 right-4`, visible focus ring.

### 4.5 Dropdown

#### Goal

Accessible dropdown/popover menu with hover/click states, alignment variants, keyboard navigation, and consistent shadows.

#### Proposed foundation

- Use Radix Dropdown Menu for menus.
- Use Radix Popover for custom rich content.

#### Styling blueprint

- Content: `z-50 min-w-48 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elegant backdrop-blur-md`.
- Item: `flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-secondary focus:bg-secondary`.
- Destructive item: `text-destructive focus:bg-destructive/10`.
- Separator: `my-1 h-px bg-border`.
- Side offset: `8px`.
- Animation: fade/scale from transform origin.

### 4.6 Accordion

#### Goal

Smooth collapsible panels for FAQs, admin data, help/support sections, and dense mobile layouts.

#### Proposed foundation

- Use Radix Accordion.

#### Styling blueprint

- Root: `space-y-2`.
- Item: `rounded-2xl border border-border bg-card/70 shadow-soft overflow-hidden`.
- Trigger: `flex w-full items-center justify-between px-4 py-4 text-left font-medium`.
- Content: CSS variable height animation using Radix `--radix-accordion-content-height`.
- Icon: `ChevronDown` rotates `180deg` on open.
- Motion: `duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`.

### 4.7 Sidebar

#### Goal

A reusable sidebar architecture that can eventually replace or supplement `AppShell` without disrupting existing layout.

#### Proposed API

```ts
type SidebarItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: string | number;
};

type SidebarProps = {
  items: SidebarItem[];
  collapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (value: boolean) => void;
};
```

#### Styling blueprint

- Desktop: `fixed inset-y-0 left-0 hidden md:flex flex-col border-r bg-background`.
- Widths: collapsed `72px`, expanded `256px`.
- Transition: `transition-[width] duration-200`.
- Item active: `bg-primary/10 text-primary`.
- Item inactive: `text-muted-foreground hover:bg-secondary hover:text-foreground`.
- Mobile drawer: `fixed inset-y-0 left-0 z-50 w-72 bg-background animate-slide-in-left` with overlay `bg-black/40`.
- Must preserve `data-tour` hooks for guided tour.

### 4.8 Toast Notification

#### Goal

Stackable floating alerts using existing Sonner integration while adding brand-consistent variants.

#### Proposed foundation

- Keep `sonner` as rendering engine.
- Add typed helper functions: `toastSuccess`, `toastInfo`, `toastWarning`, `toastError`, `toastAction`.

#### Styling blueprint

- Position: top-right desktop, bottom-center mobile if desired.
- Success: `bg-success text-success-foreground` or white card with green icon.
- Info: blue icon, `border-primary/20`.
- Warning: warm orange icon, `border-accent/30`.
- Error: destructive icon, `border-destructive/30`.
- Shape: `rounded-2xl border shadow-elegant`.
- Auto-dismiss: default `4000ms`; persistent when action required.

### 4.9 Skeleton Loader

#### Goal

Reusable skeleton placeholders that mirror actual content structure and do not cause layout shifts.

#### Proposed API

```ts
type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'line' | 'circle' | 'card' | 'button' | 'avatar';
};
```

#### Styling blueprint

- Base: `animate-pulse rounded-md bg-secondary`.
- Line: height `h-4`, variable width.
- Card: `rounded-2xl border border-border bg-card p-4 shadow-soft` with inner skeleton lines.
- Avatar/icon: `rounded-full size-10`.
- Button: `h-11 rounded-full`.
- Respect reduced motion: disable pulse or slow it.

### 4.10 Remotion Video Template

#### Goal

A brand-consistent video-as-code template using `@remotion/player`, suitable for previews, campaigns, onboarding, or shareable youth-house announcements.

#### Proposed files for future implementation

- `src/components/video/BrandVideoPlayer.tsx`
- `src/components/video/IgniteIntroComposition.tsx`
- `src/components/video/tokens.ts`

#### Visual structure

- Canvas: 16:9, 1920x1080, `bg-gradient-soft` equivalent.
- Opening: floating logo mark, blue/orange radial background blobs.
- Typography: display headline in Fraunces/Noto Serif Armenian; body in Inter/Noto Sans Armenian.
- Cards: animated bento tiles matching AI assistant, XP, quest, and opportunity modules.
- Motion: slow reveal, spring card entrance, subtle logo float, progress bar fill, count-up numbers.
- Palette: exact CSS tokens from this blueprint.

#### Player wrapper blueprint

```tsx
<Player
  component={IgniteIntroComposition}
  durationInFrames={240}
  fps={30}
  compositionWidth={1920}
  compositionHeight={1080}
  controls
  loop
  className="rounded-2xl border border-border shadow-elegant overflow-hidden"
/>
```

#### Motion language

- Intro logo: 0–30 frames, opacity + scale.
- Headline: 25–75 frames, y-translate + fade.
- Bento cards: stagger every 10 frames.
- XP bar: 90–150 frames fill from 0% to target.
- Final CTA: 170–220 frames with glow.

---

## 5. Implementation Roadmap For Future Commands

### Phase A — Token hardening

1. Audit `src/styles.css` for any missing semantic aliases needed by new primitives.
2. Add only additive tokens if needed.
3. Avoid changing existing token values unless explicitly requested.

### Phase B — Primitive component layer

1. Implement `Button`, `Card`, `Input`, and `Skeleton` first because they are low-risk and widely reusable.
2. Build each with strict TypeScript and `React.forwardRef`.
3. Add focused usage examples in isolated demo route only if requested.

### Phase C — Overlay/navigation layer

1. Implement `Modal`, `Dropdown`, and `Accordion` as wrappers around existing Radix components.
2. Implement Sidebar as a non-breaking extraction from `AppShell` patterns.
3. Preserve existing authenticated navigation behavior.

### Phase D — Feedback and motion layer

1. Add typed toast helpers on top of Sonner.
2. Add Remotion video template and player wrapper.
3. Ensure reduced-motion handling.

### Phase E — Migration

1. Migrate one route at a time.
2. Run visual comparison screenshots after each route migration.
3. Run `pa11y`, lint, and build after each migration batch.

---

## 6. Terminal Summary Of Extracted Tokens

```txt
Primary:           oklch(68% .14 235)  ≈ #2BA8E0 brand blue
Accent:            oklch(72% .17 55)   ≈ #F39B3D brand orange
Background:        oklch(99% .005 230)
Foreground:        oklch(20% .04 240)
Card:              oklch(100% 0 0)
Secondary:         oklch(96% .02 230)
Muted text:        oklch(50% .025 240)
Border:            oklch(92% .012 230)
Success:           oklch(65% .15 155)
Destructive:       oklch(60% .22 25)
Radius base:       16px
Large radius:      20px–24px
Hero H1 desktop:   64px / 1.08 / display font
Section H2:        48px / 1.25 / display font
Card H3:           20px / 1.25 / display font
UI text:           14–16px / Inter + Noto Sans Armenian
Display text:      Fraunces + Noto Serif Armenian
Default motion:    150ms cubic-bezier(0.4, 0, 0.2, 1)
Expressive motion: 300ms cubic-bezier(0.4, 0, 0.2, 1)
Soft shadow:       0 1px 2px + 0 8px 24px -12px blue-tinted
Elegant shadow:    0 1px 2px + 0 24px 60px -24px blue-tinted
```

---

## 7. Readiness Checklist

- [x] Requested runtime/design packages installed.
- [x] Screenshot tooling installed and operational after browser dependency setup.
- [x] Accessibility tooling installed and operational.
- [x] Reference desktop screenshot captured.
- [x] Reference mobile screenshot captured.
- [x] Computed design tokens extracted.
- [x] Repo architecture reviewed.
- [x] Future component plan prepared.
- [x] Existing application source files intentionally left unmodified.

