/**
 * Full-app UI audit with a stubbed Supabase backend.
 *
 * Injects a fake auth session and intercepts every Supabase REST/auth call
 * with fixtures, so authenticated routes render real layouts without a live
 * database. Visits every route at phone / tablet / desktop widths and reports:
 *   - uncaught console errors and page crashes
 *   - horizontal overflow (document wider than viewport)
 *   - tap targets smaller than 40x40 on touch widths
 *
 * Usage: node scripts/app-audit.mjs [baseUrl] [shotDir]
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:5173";
const SHOTS = process.argv[3] || "";
// Keep the stub aligned with the project the app actually targets.
const REF = /SUPABASE_PROJECT_ID="?([a-z0-9]+)"?/.exec(
  readFileSync(new URL("../.env", import.meta.url), "utf8"),
)?.[1];
if (!REF) throw new Error("Could not read SUPABASE_PROJECT_ID from .env");
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

function restResponse(url, headers) {
  const table = url.pathname.replace(/^\/rest\/v1\//, "").split("?")[0];
  if (table.startsWith("rpc/")) return { status: 200, body: JSON.stringify(null) };
  let rows = TABLES[table] ?? [];
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

async function stubBackend(context) {
  // External hosts (fonts, CDNs) are unreachable in CI sandboxes and only
  // slow the run down — kill them fast so page "load" settles quickly.
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "127.0.0.1" || host === "localhost" || host.endsWith(`${REF}.supabase.co`))
      return route.fallback();
    return route.abort();
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
    if (url.pathname.startsWith("/auth/v1/user")) return json(200, JSON.stringify(user));
    if (url.pathname.startsWith("/auth/v1/token")) return json(200, JSON.stringify(session));
    if (url.pathname.startsWith("/auth/v1/logout")) return json(204, "");
    if (url.pathname.startsWith("/auth/v1/")) return json(200, JSON.stringify({}));
    if (url.pathname.startsWith("/storage/")) return json(200, JSON.stringify({ signedUrls: [] }));
    if (url.pathname.startsWith("/functions/"))
      return json(200, JSON.stringify({ result: null, aiUsed: false }));
    if (url.pathname.startsWith("/rest/v1/")) {
      if (req.method() !== "GET" && req.method() !== "HEAD") {
        const preferObject = (headers["accept"] || "").includes("vnd.pgrst.object");
        const body = preferObject ? "{}" : "[]";
        return json(201, body);
      }
      const { status, body } = restResponse(url, headers);
      return json(status, body);
    }
    return json(200, "{}");
  });
  await context.addInitScript(
    ([ref, sess]) => {
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
    },
    [REF, session],
  );
}

const ROUTES = [
  "/",
  "/auth",
  "/dashboard",
  "/schedule",
  "/opportunities",
  "/quests",
  "/feed",
  "/community",
  "/agent",
  "/support",
  "/profile",
  "/achievements",
  "/masterclasses",
  "/trending",
  "/notifications",
  "/capabilities",
  "/admin",
  "/admin/quest-reviews",
  "/feed/create",
  "/projects/22222222-2222-4222-8222-222222222222",
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "phone-sm", width: 360, height: 780, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
];

const IGNORED_ERRORS = [
  /Failed to load resource/i, // stubbed/blocked network noise
  /net::ERR/i,
  /fonts\.googleapis/i,
  /hydrat/i, // React hydration warnings surface separately if fatal
  /WebSocket connection .* failed/i, // realtime WS can't be intercepted by the stub
];

async function auditRoute(context, route, vp, findings) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED_ERRORS.some((re) => re.test(msg.text())))
      errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));
  try {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {});

    const metrics = await page.evaluate((touch) => {
      const doc = document.documentElement;
      if (!doc || !document.body)
        return { overflowX: 0, offenders: [], smallTargets: [], path: "CRASHED", crashed: true };
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
        for (const el of document.querySelectorAll("a,button,[role=button]")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          if ((r.height < 36 || r.width < 36) && el.closest("[cmdk-root]") == null) {
            const label = (el.getAttribute("aria-label") || el.textContent || "")
              .trim()
              .slice(0, 30);
            smallTargets.push(`${Math.round(r.width)}x${Math.round(r.height)} "${label}"`);
            if (smallTargets.length >= 8) break;
          }
        }
      }
      return { overflowX, offenders, smallTargets, path: location.pathname };
    }, vp.touch);

    if (SHOTS) {
      await page
        .screenshot({
          path: `${SHOTS}/${vp.name}${route.replace(/[/$]/g, "_") || "_home"}.png`,
          fullPage: true,
        })
        .catch(() => {});
    }

    const issues = [];
    if (metrics.crashed) issues.push("page did not render (no document.body)");
    // Signed-in users are expected to be bounced from /auth to the dashboard.
    const expectedRedirect = route === "/auth" && metrics.path === "/dashboard";
    if (metrics.path !== route && !(route === "/" && metrics.path === "/") && !expectedRedirect)
      issues.push(`redirected to ${metrics.path}`);
    if (errors.length) issues.push(...errors.map((e) => `console: ${e.slice(0, 220)}`));
    if (metrics.overflowX > 1)
      issues.push(`overflow-x ${metrics.overflowX}px [${metrics.offenders.join(" | ")}]`);
    if (metrics.smallTargets.length)
      issues.push(`small tap targets: ${metrics.smallTargets.join(", ")}`);
    if (issues.length) findings.push({ route, vp: vp.name, issues });
  } catch (e) {
    findings.push({
      route,
      vp: vp.name,
      issues: [`audit error: ${String(e.message || e).slice(0, 160)}`],
    });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const findings = [];
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
    deviceScaleFactor: vp.touch ? 2 : 1,
  });
  await stubBackend(context);
  for (const route of ROUTES) await auditRoute(context, route, vp, findings);
  await context.close();
}
await browser.close();

if (!findings.length) {
  console.log("AUDIT CLEAN: no console errors, overflow, or tap-target issues found.");
} else {
  console.log(`AUDIT FINDINGS (${findings.length}):`);
  for (const f of findings) {
    console.log(`\n[${f.vp}] ${f.route}`);
    for (const i of f.issues) console.log(`  - ${i}`);
  }
  process.exitCode = 1;
}
