## What I'm building

### 1. Desktop layout — sidebar shell (like the reference)

A new `AppShell` component:

- Left rail (collapsible): logo, primary nav (Dashboard, Schedule, Projects, Quests, Feed, Community, AI Agent, Support; admin link if admin), bottom: Onboarding Files / Settings.
- Top bar: page title (left), Help / Notifications bell / Avatar dropdown (right).
- Main: scrollable content area, max-width comfortable for desktop, dense info layout.
- Mobile: keeps the existing floating tab bar; sidebar collapses into a slide-over drawer.

All existing routes re-wrap in `AppShell`. The current `Navbar` becomes desktop-hidden.

### 2. Quest system — evidence + admin approval

DB changes (migration):

- `quest_templates.requires_evidence boolean default true`
- `quest_templates.evidence_prompt text` (instructions shown to student)
- New `quest_submissions` table: `id, user_id, template_id, period_key, content text, media_urls text[], status (pending/approved/rejected), reviewed_by, review_note, created_at, reviewed_at` + RLS + grants
- New RPC `submit_quest(_template_id, _period, _content, _media)` — creates submission, freezes the user_quest as `pending_review`
- New RPC `review_quest_submission(_id, _approve, _note)` — admin-only; on approve, awards XP via existing path
- Update `claim_quest`: if `requires_evidence=true`, refuse direct claim, point to submit flow

Frontend:

- Quest card "Claim" button → for evidence quests opens a submit dialog (textarea + file upload to a new `quest-evidence` storage bucket)
- New admin tab in `/admin`: "Quest submissions" with approve/reject + note

### 3. Personal schedule (internal + .ics + Google OAuth scaffold)

DB:

- `schedule_events`: `id, user_id, title, description, starts_at, ends_at, location, kind (study/project/meeting/quest/other), color, source (manual/ai/quest/project/google), external_id, all_day bool` + RLS
- `user_integrations`: `user_id, provider (google), access_token, refresh_token, expires_at, calendar_id, status` (encrypted via service role only)

Frontend:

- `/schedule` route: week + month view, quick-add, drag to reschedule, color-coded by `kind`
- Quest deadlines and project review reminders auto-appear via DB trigger
- "Subscribe with calendar" → copyable `webcal://` link to `/api/public/ics/:userToken.ics` (read-only feed using a per-user token)
- "Connect Google Calendar" button → starts OAuth flow; ON pasting Google client ID/secret in secrets, the button activates and does 2-way sync via a server function + nightly cron

### 4. Student AI agent (per-user, full-autonomy with confirmation gates)

Server: `src/routes/api/chat.ts` streaming chat route using AI SDK + Lovable Gateway, default `google/gemini-3-flash-preview`, `stopWhen: stepCountIs(50)`.

Tool catalog the agent can call directly (no confirmation):

- `get_profile`, `get_my_projects`, `get_my_quests`, `get_my_schedule`, `get_my_notifications`
- `add_schedule_event`, `update_schedule_event`, `delete_schedule_event`
- `log_quest_progress`, `draft_quest_submission` (saves a draft, doesn't submit)
- `ask_admin(question, urgency)` → opens a `support_threads` row tagged `ai_relay`, posts message; when admin replies, the agent reads it and tells the student
- `search_opportunities`, `recommend_next_step`, `summarize_my_week`

Tools that REQUIRE student confirmation (use AI SDK `needsApproval: true`):

- `start_project` (spends XP), `join_project` (spends XP)
- `submit_project_for_review`
- `submit_quest_with_evidence`
- `create_public_post`
- `delete_*` operations

Each student has one persistent thread. Storage: database-backed (`agent_threads`, `agent_messages`). Messages are AI SDK `UIMessage` JSON.

Role-specific system prompts (placeholders ready to be replaced when you send real ones):

- **Student Agent** — primary assistant, in Armenian, knows the student's profile/projects/quests/schedule, proactive but respectful, asks confirmation before irreversible actions, escalates to admins via `ask_admin` when uncertain about platform rules.
- **Admin Liaison sub-prompt** — used when forming `ask_admin` messages: concise, structured, never leaks private info.

UI: `/agent` route with sidebar conversation surface using AI Elements (Conversation, Message, MessageResponse, PromptInput, Tool with collapsed accordion, Shimmer).
Plus a small "AI Quick-Ask" launcher in the top bar that opens the same agent in a drawer.

### 5. Email scaffold (disabled until domain set up)

- Templates ready: post-approved, post-rejected, project-approved, project-rejected, support-replied, schedule-reminder, quest-reminder
- DB triggers fire `enqueue_email` calls; `email_send_state` starts disabled
- When user later adds a domain, one toggle activates delivery — no code changes needed

### 6. Smoke test

End-to-end Playwright run against localhost:

- AI agent thread: ask schedule, add event, ask admin, evidence-quest flow happy path
- Quest submission → admin approval → XP credited
- Schedule subscribe link works
- Sidebar layout renders on desktop, drawer on mobile

## Technical notes

- All DB writes go through SECURITY DEFINER RPCs with `auth.uid()` checks (no direct table inserts from the agent).
- Tool execution lives in `src/lib/agent-tools.functions.ts` calling existing RPCs — single source of truth.
- Agent thread stored in `agent_threads(user_id, title, created_at)` + `agent_messages(thread_id, role, parts jsonb, created_at)`; one thread per student (auto-created), with "Reset chat" button.
- Confirmation gates: AI SDK `needsApproval` + a `<ToolApproval>` UI block in the chat surface that shows the proposed action and lets the student approve/reject.
- `LOVABLE_API_KEY` already provisioned; no new secret needed for the agent.
- Email + Google Calendar secrets stay unset; UI shows "Setup required" states without breaking anything.

## Order of execution

1. Migration (quests + schedule + agent tables + email scaffolding)
2. AppShell + nav refactor (desktop sidebar layout)
3. Quest evidence flow (submit dialog + admin tab)
4. Schedule route + .ics endpoint + Google OAuth scaffold
5. AI agent route + tools + chat UI + confirmation gates
6. Email triggers (disabled state)
7. Smoke test + fixes

Also addition: For our AI I have sent very powerful AI system prompts .txt file which is very powerful-level. So use it too. At the end, however, if you won't have that file I can resend it.