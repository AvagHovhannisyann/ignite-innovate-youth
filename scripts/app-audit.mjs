/**
 * Full-app UI audit with a stubbed Supabase backend.
 *
 * Injects a fake auth session and intercepts every Supabase REST/auth call
 * with fixtures, so authenticated routes render real layouts without a live
 * database. Visits every UI route/state across phone, tablet, and desktop
 * profiles (including dark and reduced-motion profiles) and reports:
 *   - uncaught console errors and page crashes
 *   - horizontal overflow (document wider than viewport)
 *   - interactive targets smaller than 44x44 on touch widths
 *   - unexpected redirects and local resource failures
 *
 * By default the audit starts and stops its own Vite server. Pass --base-url
 * to audit an already-running server instead.
 *
 * Usage: node scripts/app-audit.mjs [--base-url URL] [--shots DIR]
 */
import { chromium } from "playwright-core";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIN_TOUCH_TARGET = 44;

async function availableLoopbackPort() {
  return new Promise((resolvePort, reject) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      if (!address || typeof address === "string") {
        reservation.close();
        reject(new Error("Could not allocate a loopback port for the UI audit"));
        return;
      }
      const { port } = address;
      reservation.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function printUsage() {
  console.log(
    `Usage: node scripts/app-audit.mjs [options]\n\nOptions:\n  --base-url URL   Audit an existing server instead of starting Vite\n  --shots DIR      Write a full-page screenshot for every render\n  --help            Show this help\n\nEnvironment equivalents:\n  APP_AUDIT_BASE_URL, APP_AUDIT_SHOTS, APP_AUDIT_CHROMIUM`,
  );
}

function parseArgs(argv) {
  const values = [];
  let baseUrl = process.env.APP_AUDIT_BASE_URL || "";
  let shots = process.env.APP_AUDIT_SHOTS || "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--base-url") {
      baseUrl = argv[++index] || "";
      if (!baseUrl) throw new Error("--base-url requires a URL");
      continue;
    }
    if (arg === "--shots") {
      shots = argv[++index] || "";
      if (!shots) throw new Error("--shots requires a directory");
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    values.push(arg);
  }

  // Preserve the original positional interface: [baseUrl] [shotDir].
  if (values[0]) baseUrl ||= values[0];
  if (values[1]) shots ||= values[1];
  if (values.length > 2) throw new Error("Too many positional arguments");
  return { baseUrl, shots };
}

const cli = parseArgs(process.argv.slice(2));
const DEFAULT_BASE = `http://127.0.0.1:${cli.baseUrl ? 5173 : await availableLoopbackPort()}`;
const BASE = (cli.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
const BASE_ORIGIN = new URL(BASE).origin;
const SHOTS = cli.shots ? resolve(ROOT, cli.shots) : "";
const SHOULD_START_SERVER = !cli.baseUrl;

function readProjectEnv() {
  try {
    return readFileSync(resolve(ROOT, ".env"), "utf8");
  } catch {
    return "";
  }
}

function envFileValue(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}=["']?([^"'\\r\\n]+)["']?`, "m").exec(source)?.[1];
}

// Keep the network stub aligned with the Supabase host used by the app. CI
// can provide environment variables directly; local runs may use .env.
const projectEnv = readProjectEnv();
const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  envFileValue(projectEnv, "VITE_SUPABASE_URL") ||
  envFileValue(projectEnv, "SUPABASE_URL");
const REF =
  process.env.SUPABASE_PROJECT_ID ||
  process.env.VITE_SUPABASE_PROJECT_ID ||
  envFileValue(projectEnv, "SUPABASE_PROJECT_ID") ||
  envFileValue(projectEnv, "VITE_SUPABASE_PROJECT_ID") ||
  (supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "") ||
  "audit-fixture";
const AUDIT_SUPABASE_URL = supabaseUrl || `https://${REF}.supabase.co`;
const AUDIT_SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  envFileValue(projectEnv, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
  envFileValue(projectEnv, "SUPABASE_PUBLISHABLE_KEY") ||
  "audit-publishable-key";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const user = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Թեստ Ուսանող" },
  created_at: "2026-01-01T00:00:00Z",
};

const profile = {
  id: USER_ID,
  full_name: "Թեստ Ուսանող",
  email: "test@example.com",
  age: 17,
  xp: 240,
  onboarded: true,
  interests: ["դիզայն", "էկոլոգիա", "ծրագրավորում"],
  skills: ["Figma", "թիմային աշխատանք"],
  goal: "Դառնալ պրոդուկտ դիզայներ",
  bio: "Սիրում եմ ստեղծել։",
  preferred_project_type: "թիմային",
  ics_token: "test-ics-token",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

const iso = (d) => new Date(Date.now() + d * 864e5).toISOString();

/** Table fixtures: whatever PostgREST is asked for, answer from here. */
const TABLES = {
  profiles: [profile],
  user_roles: [{ user_id: USER_ID, role: "admin" }],
  recommendations: [
    {
      user_id: USER_ID,
      source: "ai",
      generated_at: iso(0),
      data: {
        recommendedLessons: [
          {
            title: "UX հիմունքներ",
            reason: "Քո դիզայն հետաքրքրության համար",
            category: "դիզայն",
            difficulty: "սկսնակ",
            duration: "2 շաբաթ",
          },
        ],
        recommendedEvents: [
          {
            title: "Էկո հակաթոն",
            reason: "Էկոլոգիա + թիմ",
            category: "էկոլոգիա",
            date: "2026-07-15",
          },
        ],
        recommendedMasterclasses: [
          {
            title: "Figma մաստեր-դաս",
            reason: "Գործիքդ խորացրու",
            skillFocus: "UI",
            duration: "3 ժամ",
          },
        ],
        suggestedProjects: [
          {
            title: "Կանաչ բակ պաստառներ",
            shortDescription: "Բնապահպանական պաստառների շարք դպրոցի համար։",
            fullDescription:
              "Ստեղծիր 6 պաստառից բաղկացած շարք, տպագրիր և տեղադրիր համայնքում։ Կսովորես կոմպոզիցիա, տիպոգրաֆիա և արշավի մտածողություն։",
            matchingInterests: ["դիզայն", "էկոլոգիա"],
            difficulty: "միջին",
            suggestedTeamSize: "2-3",
            timeEstimate: "4-6 շաբաթ",
            weeklyCommitment: "5-7 ժամ",
            milestones: [
              { week: "Շաբաթ 1", goal: "Հետազոտություն և մուդբորդ" },
              { week: "Շաբաթ 2", goal: "Առաջին 2 էսքիզ" },
            ],
            resources: {
              tools: ["Figma", "Canva"],
              materials: ["Տպագրություն"],
              budgetEstimate: "0–15,000 ֏",
              learningTopics: ["կոմպոզիցիա"],
            },
            skillsLearned: ["տիպոգրաֆիա", "բրենդինգ"],
            impact: "Համայնքի էկո գիտակցության բարձրացում։",
            firstSteps: ["Ընտրիր թեման", "Հավաքիր референս"],
          },
        ],
        growthSuggestions: [
          {
            title: "Միացիր դիզայն ակումբին",
            description: "Շաբաթական հանդիպումներ համախոհների հետ։",
          },
        ],
      },
    },
  ],
  started_projects: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: USER_ID,
      title: "Կանաչ բակ",
      short_description: "Էկո պաստառներ",
      status: "active",
      progress: 45,
      difficulty_tier: "միջին",
      created_at: iso(-7),
      milestones: [],
      xp_spent: 10,
    },
  ],
  participations: [
    {
      id: "p1",
      user_id: USER_ID,
      joined_at: iso(-3),
      opportunities: { title: "Էկո հակաթոն", category: "էկոլոգիա", date: "2026-07-15" },
    },
  ],
  achievements: [
    { id: "a1", user_id: USER_ID, badge: "Առաջին մասնակցություն", earned_at: iso(-3) },
  ],
  opportunities: [
    {
      id: "o1",
      title: "Էկո հակաթոն",
      category: "էկոլոգիա",
      description: "48-ժամյա մարտահրավեր դպրոցականների համար՝ իրական համայնքային խնդիրների շուրջ։",
      difficulty: "միջին",
      date: "2026-07-15",
      location: "Էջմիածին",
      spots: 30,
      created_at: iso(-10),
    },
    {
      id: "o2",
      title: "Ռոբոտաշինության ակումբ",
      category: "տեխնոլոգիա",
      description: "Շաբաթական հանդիպումներ, Arduino և 3D տպագրություն։",
      difficulty: "սկսնակ",
      date: "2026-07-20",
      location: "Երիտասարդական տուն",
      spots: 15,
      created_at: iso(-9),
    },
  ],
  quest_templates: [
    {
      id: "d-login",
      kind: "daily",
      title: "Մուտք գործիր հարթակ",
      description: "Պարզապես այցելիր այսօր",
      icon: "Star",
      xp: 5,
      target: 1,
      active: true,
      requires_evidence: false,
      evidence_prompt: null,
    },
    {
      id: "a-join",
      kind: "activity",
      title: "Միացիր 3 միջոցառման",
      description: "Մասնակցիր համայնքի կյանքին",
      icon: "Users",
      xp: 30,
      target: 3,
      active: true,
      requires_evidence: false,
      evidence_prompt: null,
    },
    {
      id: "e-photo",
      kind: "daily",
      title: "Կիսվիր առաջընթացով",
      description: "Վերբեռնիր նախագծիդ լուսանկարը",
      icon: "Sparkles",
      xp: 15,
      target: 1,
      active: true,
      requires_evidence: true,
      evidence_prompt: "Կցիր լուսանկար",
    },
  ],
  user_quests: [
    {
      id: "uq1",
      user_id: USER_ID,
      template_id: "a-join",
      period_key: "permanent",
      progress: 1,
      awarded: false,
    },
  ],
  quest_submissions: [],
  quest_rerolls: [],
  reward_claims: [],
  schedule_events: [
    {
      id: "e1",
      user_id: USER_ID,
      title: "Ուսումնական ժամ",
      description: null,
      starts_at: iso(0.1),
      ends_at: iso(0.15),
      location: "Տուն",
      kind: "study",
      source: "manual",
      all_day: false,
    },
    {
      id: "e2",
      user_id: USER_ID,
      title: "Թիմի հանդիպում",
      description: null,
      starts_at: iso(1),
      ends_at: iso(1.08),
      location: "Երիտ. տուն",
      kind: "meeting",
      source: "ai",
      all_day: false,
    },
  ],
  agent_threads: [
    { id: "t1", user_id: USER_ID, title: null, created_at: iso(-1), updated_at: iso(0) },
  ],
  agent_messages: [
    {
      id: "m1",
      thread_id: "t1",
      role: "user",
      parts: [{ type: "text", text: "Բարև" }],
      created_at: iso(-0.5),
      ai_message_id: "u1",
    },
    {
      id: "m2",
      thread_id: "t1",
      role: "assistant",
      parts: [{ type: "text", text: "Բարև։ **Ի՞նչ կօգնեմ** այսօր։\n- Օրակարգ\n- Քվեստներ" }],
      created_at: iso(-0.49),
      ai_message_id: null,
    },
  ],
  notifications: [
    {
      id: "n1",
      user_id: USER_ID,
      title: "Նոր առաջարկներ",
      body: "Ստուգիր վահանակդ",
      kind: "info",
      read: false,
      created_at: iso(-0.2),
    },
  ],
  posts: [
    {
      id: "po1",
      user_id: USER_ID,
      title: "Իմ առաջին պաստառը",
      content: "Այսօր ավարտեցի առաջին էսքիզը 🎨",
      media_paths: [],
      status: "approved",
      created_at: iso(-2),
      profiles: { full_name: "Թեստ Ուսանող", avatar_url: null },
      likes: [],
      comments: [],
    },
  ],
  post_likes: [],
  post_comments: [],
  support_threads: [
    {
      id: "s1",
      user_id: USER_ID,
      subject: "Հարց մակարդակի մասին",
      status: "open",
      origin: "user",
      created_at: iso(-1),
      last_message_at: iso(-1),
    },
  ],
  support_messages: [
    {
      id: "sm1",
      thread_id: "s1",
      sender_id: USER_ID,
      sender_role: "user",
      content: "Ինչպե՞ս եմ XP հավաքում",
      created_at: iso(-1),
    },
  ],
  masterclasses: [
    {
      id: "mc1",
      title: "Figma մաստեր-դաս",
      description: "UI դիզայնի հիմունքներ",
      category: "դիզայն",
      date: "2026-07-18",
      duration: "3 ժամ",
      instructor: "Անի Մ.",
      spots: 20,
      created_at: iso(-5),
    },
  ],
  community_members: [],
  email_queue: [],
};

// supabase-js validates the token's JWT structure before trusting a stored
// session, so the stub token must decode (the signature is never verified
// client-side).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const accessToken = [
  b64url({ alg: "HS256", typ: "JWT" }),
  b64url({
    iss: `https://${REF}.supabase.co/auth/v1`,
    sub: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    exp: now + 3600,
    iat: now,
    session_id: "33333333-3333-4333-8333-333333333333",
  }),
  "stub-signature",
].join(".");

const session = {
  access_token: accessToken,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: now + 3600,
  refresh_token: "stub-refresh",
  user,
};

function restResponse(url, headers, scenario) {
  const table = url.pathname.replace(/^\/rest\/v1\//, "").split("?")[0];
  if (table.startsWith("rpc/")) return { status: 200, body: JSON.stringify(null) };
  let rows =
    table === "profiles" && scenario.profile ? [scenario.profile] : [...(TABLES[table] ?? [])];
  const accept = headers["accept"] || "";
  const preferObject = accept.includes("vnd.pgrst.object");
  // crude eq filters so per-id lookups behave
  for (const [k, v] of url.searchParams) {
    const m = /^eq\.(.*)$/.exec(v);
    if (m && k !== "select") rows = rows.filter((r) => String(r[k]) === m[1]);
  }
  if (preferObject) {
    return rows.length
      ? { status: 200, body: JSON.stringify(rows[0]) }
      : {
          status: 406,
          body: JSON.stringify({ code: "PGRST116", message: "no rows", details: null }),
        };
  }
  return { status: 200, body: JSON.stringify(rows) };
}

async function stubBackend(context, scenario, profileConfig) {
  // Keep Supabase Realtime deterministic without suppressing WebSocket
  // errors. The fake socket stays open for the short lifetime of the page.
  await context.routeWebSocket(`**/${REF}.supabase.co/realtime/v1/**`, (socket) => {
    socket.onMessage(() => {});
  });

  // External fonts/CDNs are irrelevant to this structural audit and may be
  // unavailable in CI. Return successful empty resources instead of aborting
  // them (which would create console noise indistinguishable from app errors).
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const host = url.hostname;
    if (
      url.origin === BASE_ORIGIN ||
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === `${REF}.supabase.co`
    ) {
      return route.fallback();
    }
    const extension = url.pathname.split(".").pop()?.toLowerCase();
    const contentType =
      extension === "css"
        ? "text/css"
        : extension === "js" || extension === "mjs"
          ? "application/javascript"
          : "text/plain";
    return route.fulfill({
      status: 200,
      body: "",
      headers: {
        "content-type": contentType,
        "access-control-allow-origin": "*",
      },
    });
  });
  await context.route(`**/${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = req.headers();
    const json = (status, body) =>
      route.fulfill({
        status,
        body,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      });

    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (url.pathname.startsWith("/auth/v1/user")) {
      return scenario.authenticated
        ? json(200, JSON.stringify(user))
        : json(401, JSON.stringify({ message: "Auth session missing" }));
    }
    if (url.pathname.startsWith("/auth/v1/token")) {
      return scenario.authenticated
        ? json(200, JSON.stringify(session))
        : json(400, JSON.stringify({ error: "invalid_grant" }));
    }
    if (url.pathname.startsWith("/auth/v1/logout")) return json(204, "");
    if (url.pathname.startsWith("/auth/v1/")) return json(200, JSON.stringify({}));
    if (url.pathname.startsWith("/storage/")) return json(200, JSON.stringify({ signedUrls: [] }));
    if (url.pathname.startsWith("/functions/"))
      return json(200, JSON.stringify({ result: null, aiUsed: false }));
    if (url.pathname.startsWith("/rest/v1/")) {
      if (url.pathname.endsWith("/rpc/ensure_agent_thread")) {
        return json(200, JSON.stringify(TABLES.agent_threads[0]));
      }
      if (url.pathname.endsWith("/rpc/reset_agent_thread")) {
        return json(200, JSON.stringify(TABLES.agent_threads[0]));
      }
      if (url.pathname.endsWith("/rpc/save_agent_message")) {
        return json(200, JSON.stringify(TABLES.agent_messages[0]));
      }
      if (req.method() !== "GET" && req.method() !== "HEAD") {
        const preferObject = (headers["accept"] || "").includes("vnd.pgrst.object");
        const body = preferObject ? "{}" : "[]";
        return json(201, body);
      }
      const { status, body } = restResponse(url, headers, scenario);
      return json(status, body);
    }
    return json(200, "{}");
  });
  await context.addInitScript(
    ({ ref, sess, authenticated, theme }) => {
      if (authenticated) {
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
      } else {
        window.localStorage.removeItem(`sb-${ref}-auth-token`);
      }
      window.localStorage.setItem("theme", theme);
    },
    {
      ref: REF,
      sess: session,
      authenticated: scenario.authenticated,
      theme: profileConfig.theme,
    },
  );
}

const signedIn = { authenticated: true, profile };
const signedOut = { authenticated: false, profile };
const incompleteProfile = { ...profile, onboarded: false, interests: [], skills: [] };

/**
 * Explicit cases make auth/search/redirect state part of route coverage.
 * `source` is checked against src/routes so a newly-added UI route cannot be
 * silently omitted from the harness.
 */
const ROUTE_CASES = [
  { id: "landing-public", source: "index.tsx", path: "/", ...signedOut },
  { id: "landing-signed-in", source: "index.tsx", path: "/", ...signedIn },
  { id: "auth-sign-in", source: "auth.tsx", path: "/auth?mode=signin", ...signedOut },
  { id: "auth-sign-up", source: "auth.tsx", path: "/auth?mode=signup", ...signedOut },
  { id: "auth-forgot", source: "auth.tsx", path: "/auth?mode=forgot", ...signedOut },
  {
    id: "auth-callback-error",
    source: "auth.callback.tsx",
    path: "/auth/callback?error=access_denied&error_description=Audit%20fixture",
    settleMs: 300,
    ...signedOut,
  },
  {
    id: "reset-password-invalid-link",
    source: "reset-password.tsx",
    path: "/reset-password",
    ...signedOut,
  },
  {
    id: "reset-password-recovery",
    source: "reset-password.tsx",
    path: "/reset-password",
    ...signedIn,
  },
  {
    id: "onboarding-incomplete-profile",
    source: "onboarding.tsx",
    path: "/onboarding",
    authenticated: true,
    profile: incompleteProfile,
  },
  { id: "dashboard", source: "dashboard.tsx", path: "/dashboard", ...signedIn },
  { id: "schedule", source: "schedule.tsx", path: "/schedule", ...signedIn },
  {
    id: "opportunities-public",
    source: "opportunities.tsx",
    path: "/opportunities",
    ...signedOut,
  },
  {
    id: "opportunities-signed-in",
    source: "opportunities.tsx",
    path: "/opportunities",
    ...signedIn,
  },
  { id: "quests", source: "quests.tsx", path: "/quests", ...signedIn },
  {
    id: "quest-evidence-submit",
    source: "quest-submit.tsx",
    path: "/quest-submit?template_id=e-photo",
    ...signedIn,
  },
  { id: "feed", source: "feed.tsx", path: "/feed", ...signedIn },
  { id: "feed-create", source: "feed.create.tsx", path: "/feed/create", ...signedIn },
  { id: "community", source: "community.tsx", path: "/community", ...signedIn },
  { id: "agent", source: "agent.tsx", path: "/agent", ...signedIn },
  {
    id: "assistant-legacy-redirect",
    source: "assistant.tsx",
    path: "/assistant",
    expectedPath: "/agent",
    ...signedIn,
  },
  { id: "support", source: "support.tsx", path: "/support", ...signedIn },
  { id: "profile", source: "profile.tsx", path: "/profile", ...signedIn },
  {
    id: "achievements",
    source: "achievements.tsx",
    path: "/achievements",
    ...signedIn,
  },
  {
    id: "masterclasses",
    source: "masterclasses.tsx",
    path: "/masterclasses",
    ...signedIn,
  },
  { id: "trending", source: "trending.tsx", path: "/trending", ...signedIn },
  {
    id: "notifications",
    source: "notifications.tsx",
    path: "/notifications",
    ...signedIn,
  },
  {
    id: "capabilities-public",
    source: "capabilities.tsx",
    path: "/capabilities",
    ...signedOut,
  },
  { id: "admin", source: "admin.tsx", path: "/admin", ...signedIn },
  {
    id: "admin-quest-reviews",
    source: "admin.quest-reviews.tsx",
    path: "/admin/quest-reviews",
    ...signedIn,
  },
  {
    id: "project-detail",
    source: "projects.$id.tsx",
    path: "/projects/22222222-2222-4222-8222-222222222222",
    ...signedIn,
  },
  {
    id: "not-found",
    source: "__root.tsx",
    path: "/audit-not-found",
    expectedStatus: 404,
    ...signedOut,
  },
];

function assertUiRouteCoverage() {
  const routeDir = resolve(ROOT, "src/routes");
  const uiRouteFiles = readdirSync(routeDir)
    .filter((name) => name.endsWith(".tsx"))
    .sort();
  const covered = new Set(ROUTE_CASES.map((scenario) => scenario.source));
  const missing = uiRouteFiles.filter((name) => !covered.has(name));
  if (missing.length) {
    throw new Error(`UI route coverage is incomplete. Add audit cases for: ${missing.join(", ")}`);
  }
}

assertUiRouteCoverage();

const PROFILES = [
  {
    name: "phone-sm-light",
    width: 360,
    height: 780,
    touch: true,
    theme: "light",
    reducedMotion: "no-preference",
  },
  {
    name: "phone-dark",
    width: 390,
    height: 844,
    touch: true,
    theme: "dark",
    reducedMotion: "no-preference",
  },
  {
    name: "tablet-dark-reduced",
    width: 768,
    height: 1024,
    touch: true,
    theme: "dark",
    reducedMotion: "reduce",
  },
  {
    name: "desktop-light",
    width: 1440,
    height: 900,
    touch: false,
    theme: "light",
    reducedMotion: "no-preference",
  },
];

async function auditRoute(context, scenario, profileConfig, findings) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (
      scenario.expectedStatus === 404 &&
      msg.text().startsWith("Failed to load resource: the server responded with a status of 404")
    ) {
      return;
    }
    // Remotion's <Player> creates a SharedAudioContext on mount as an
    // autoplay-unlock trick — it preloads a silent MP3 and logs this via
    // console.error on every browser, for every Player, whether or not the
    // composition uses audio at all. Confirmed upstream Remotion behavior
    // (node_modules/remotion/dist/cjs/audio/shared-audio-tags.js), not an
    // app defect. Because routing here is client-side (no full reload
    // between routes), it also re-fires on every subsequent route audited
    // in the same page/tab after the first Player mount.
    if (msg.text().startsWith("Loading media from  'data:audio/mp3;base64,")) {
      return;
    }
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === BASE_ORIGIN) {
      errors.push(
        `LOCAL REQUEST FAILED: ${request.method()} ${url.pathname} (${request.failure()?.errorText || "unknown"})`,
      );
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    const requestedPath = new URL(BASE + scenario.path).pathname;
    const isExpectedNavigationError =
      response.request().isNavigationRequest() &&
      url.pathname === requestedPath &&
      response.status() === scenario.expectedStatus;
    if (url.origin === BASE_ORIGIN && response.status() >= 400 && !isExpectedNavigationError) {
      errors.push(`LOCAL RESPONSE ${response.status()}: ${url.pathname}`);
    }
  });
  try {
    const response = await page.goto(BASE + scenario.path, {
      waitUntil: "load",
      timeout: 30000,
    });
    if (!response) throw new Error("navigation returned no response");
    const expectedStatus = scenario.expectedStatus ?? 200;
    if (response.status() !== expectedStatus) {
      errors.push(`NAVIGATION STATUS ${response.status()} (expected ${expectedStatus})`);
    }
    await page.waitForTimeout(scenario.settleMs ?? 800);

    let metrics = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        metrics = await page.evaluate(
          ({ touch, minTarget }) => {
            const doc = document.documentElement;
            if (!doc || !document.body)
              return {
                overflowX: 0,
                offenders: [],
                smallTargets: [],
                path: "CRASHED",
                crashed: true,
              };
            const overflowX = Math.max(
              doc.scrollWidth - doc.clientWidth,
              document.body.scrollWidth - doc.clientWidth,
            );
            const offenders = [];
            if (overflowX > 1) {
              for (const el of document.querySelectorAll("body *")) {
                const r = el.getBoundingClientRect();
                if (r.right > doc.clientWidth + 1 && r.width > 8 && el.children.length < 8) {
                  offenders.push(
                    `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} right=${Math.round(r.right)}`,
                  );
                  if (offenders.length >= 5) break;
                }
              }
            }
            const smallTargets = [];
            if (touch) {
              const selector =
                'a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[role="button"]:not([aria-disabled="true"])';
              for (const el of document.querySelectorAll(selector)) {
                let target = el;
                if (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type)) {
                  target =
                    el.closest("label") ||
                    (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null) ||
                    el;
                }
                const r = target.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) continue; // hidden
                const style = getComputedStyle(target);
                if (
                  style.visibility === "hidden" ||
                  style.display === "none" ||
                  style.pointerEvents === "none"
                ) {
                  continue;
                }
                if (r.height < minTarget - 0.5 || r.width < minTarget - 0.5) {
                  const label = (el.getAttribute("aria-label") || el.textContent || "")
                    .trim()
                    .slice(0, 30);
                  const identity = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`;
                  smallTargets.push(
                    `${Math.round(r.width)}x${Math.round(r.height)} ${identity} "${label}"`,
                  );
                  if (smallTargets.length >= 12) break;
                }
              }
            }
            return {
              overflowX,
              offenders,
              smallTargets,
              path: location.pathname,
              crashed: false,
              dark: doc.classList.contains("dark"),
              reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
              viteError: Boolean(document.querySelector("vite-error-overlay")),
            };
          },
          { touch: profileConfig.touch, minTarget: MIN_TOUCH_TARGET },
        );
        break;
      } catch (error) {
        const transientNavigation = String(error).includes("Execution context was destroyed");
        if (!transientNavigation || attempt === 1) throw error;
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(250);
      }
    }
    if (!metrics) throw new Error("page metrics were unavailable after navigation settled");

    if (SHOTS) {
      await page
        .screenshot({
          path: `${SHOTS}/${profileConfig.name}__${scenario.id}.png`,
          fullPage: true,
        })
        .catch(() => {});
    }

    const issues = [];
    if (metrics.crashed) issues.push("page did not render (no document.body)");
    if (metrics.viteError) issues.push("Vite error overlay rendered");
    const expectedPath = scenario.expectedPath || new URL(BASE + scenario.path).pathname;
    if (metrics.path !== expectedPath) {
      issues.push(`redirected to ${metrics.path}`);
    }
    if (metrics.dark !== (profileConfig.theme === "dark")) {
      issues.push(`expected ${profileConfig.theme} theme but document.dark=${metrics.dark}`);
    }
    if (metrics.reducedMotion !== (profileConfig.reducedMotion === "reduce")) {
      issues.push(
        `expected reducedMotion=${profileConfig.reducedMotion} but media query=${metrics.reducedMotion}`,
      );
    }
    if (errors.length) issues.push(...errors.map((e) => `console: ${e.slice(0, 220)}`));
    if (metrics.overflowX > 1)
      issues.push(`overflow-x ${metrics.overflowX}px [${metrics.offenders.join(" | ")}]`);
    if (metrics.smallTargets.length)
      issues.push(`small tap targets: ${metrics.smallTargets.join(", ")}`);
    if (issues.length) {
      findings.push({ scenario: scenario.id, profile: profileConfig.name, issues });
    }
  } catch (e) {
    findings.push({
      scenario: scenario.id,
      profile: profileConfig.name,
      issues: [`audit error: ${String(e.message || e).slice(0, 160)}`],
    });
  } finally {
    await page.close();
  }
}

function executable(path) {
  if (!path) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandPath(command) {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [command], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.split(/\r?\n/).find(Boolean)?.trim() || "";
}

function playwrightCacheCandidates() {
  const cacheRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? process.env.PLAYWRIGHT_BROWSERS_PATH
      : resolve(homedir(), ".cache/ms-playwright");
  if (!existsSync(cacheRoot)) return [];
  const candidates = [];
  for (const entry of readdirSync(cacheRoot)) {
    if (!entry.startsWith("chromium")) continue;
    const root = resolve(cacheRoot, entry);
    candidates.push(
      resolve(root, "chrome-linux64/chrome"),
      resolve(root, "chrome-linux/chrome"),
      resolve(root, "chrome-headless-shell-linux64/chrome-headless-shell"),
      resolve(root, "chrome-linux/headless_shell"),
    );
  }
  return candidates;
}

function resolveChromiumExecutable() {
  const configured =
    process.env.APP_AUDIT_CHROMIUM ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROME_PATH;
  if (configured && !executable(configured)) {
    throw new Error(`Configured Chromium executable is not usable: ${configured}`);
  }

  const commands = [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "chrome",
    "msedge",
  ];
  const candidates = [
    configured,
    chromium.executablePath(),
    ...playwrightCacheCandidates(),
    ...commands.map(commandPath),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    resolve(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ];
  return candidates.find(executable) || "";
}

function formatServerOutput(chunks) {
  return chunks.join("").trim().split(/\r?\n/).slice(-30).join("\n");
}

async function startViteServer() {
  const base = new URL(BASE);
  if (!["127.0.0.1", "localhost"].includes(base.hostname) || base.protocol !== "http:") {
    throw new Error(
      `The automatic server only supports a local HTTP URL (received ${BASE}). Use --base-url for an external server.`,
    );
  }

  const viteEntry = resolve(ROOT, "node_modules/vite/bin/vite.js");
  if (!existsSync(viteEntry)) {
    throw new Error("Vite is not installed. Run `npm ci` before the UI audit.");
  }
  const output = [];
  const server = spawn(
    process.execPath,
    [viteEntry, "dev", "--host", base.hostname, "--port", base.port || "80", "--strictPort"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SUPABASE_PROJECT_ID: REF,
        SUPABASE_URL: AUDIT_SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: AUDIT_SUPABASE_KEY,
        VITE_SUPABASE_PROJECT_ID: REF,
        VITE_SUPABASE_URL: AUDIT_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: AUDIT_SUPABASE_KEY,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const collect = (chunk) => {
    output.push(String(chunk));
    if (output.length > 100) output.shift();
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Vite exited before the audit started (code ${server.exitCode}).\n${formatServerOutput(output)}`,
      );
    }
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        console.log(`Audit server ready at ${BASE}`);
        return server;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  server.kill("SIGTERM");
  throw new Error(`Timed out waiting for Vite at ${BASE}.\n${formatServerOutput(output)}`);
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => server.once("exit", resolveExit)),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

let server;
let browser;
try {
  if (SHOULD_START_SERVER) server = await startViteServer();

  const executablePath = resolveChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "Chromium was not found. Run `npm run test:ui:install`, or set APP_AUDIT_CHROMIUM to an executable path.",
    );
  }
  console.log(`Using Chromium: ${executablePath}`);

  // Some sandboxes require outbound traffic through HTTPS_PROXY. External
  // resources are stubbed, but retain proxy support for an explicit remote
  // --base-url while always bypassing the local audit server.
  const upstreamProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  browser = await chromium.launch({
    executablePath,
    proxy: upstreamProxy
      ? { server: upstreamProxy, bypass: "127.0.0.1,localhost,<loopback>" }
      : undefined,
  });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  const findings = [];
  for (const profileConfig of PROFILES) {
    for (const scenario of ROUTE_CASES) {
      // A fresh context is intentional: auth storage, theme, service workers,
      // and route handlers must not leak between state cases.
      const context = await browser.newContext({
        viewport: { width: profileConfig.width, height: profileConfig.height },
        hasTouch: profileConfig.touch,
        isMobile: profileConfig.touch,
        deviceScaleFactor: profileConfig.touch ? 2 : 1,
        colorScheme: profileConfig.theme,
        reducedMotion: profileConfig.reducedMotion,
        serviceWorkers: "block",
      });
      await stubBackend(context, scenario, profileConfig);
      await auditRoute(context, scenario, profileConfig, findings);
      await context.close();
    }
  }

  const renders = ROUTE_CASES.length * PROFILES.length;
  if (!findings.length) {
    console.log(
      `AUDIT CLEAN: ${ROUTE_CASES.length} route/state cases × ${PROFILES.length} profiles = ${renders} renders; no console, resource, redirect, theme, overflow, or ${MIN_TOUCH_TARGET}px target failures.`,
    );
  } else {
    console.log(`AUDIT FINDINGS (${findings.length} of ${renders} renders):`);
    for (const finding of findings) {
      console.log(`\n[${finding.profile}] ${finding.scenario}`);
      for (const issue of finding.issues) console.log(`  - ${issue}`);
    }
    process.exitCode = 1;
  }
} finally {
  await browser?.close().catch(() => {});
  await stopServer(server);
}
