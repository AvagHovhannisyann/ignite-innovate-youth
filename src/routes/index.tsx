import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { GrowthSimulator } from "@/components/GrowthSimulator";
import { BrandIntroTile } from "@/components/BrandIntro";
import { CountUp } from "@/components/CountUp";
import { trackGlow } from "@/lib/glow";
import {
  Sparkles,
  Compass,
  Lightbulb,
  Rocket,
  BarChart3,
  Users,
  Trophy,
  ArrowRight,
  ArrowUpRight,
  Check,
  Zap,
} from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    links: [{ rel: "preload", as: "image", href: logo, fetchPriority: "high" } as any],
  }),
});

/* ---------- Hero bento modules (live UI previews, not static art) ---------- */

function XPModule() {
  return (
    <div className="bento-tile p-4 sm:p-5" onMouseMove={trackGlow}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Քո աճը
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-warm text-accent-foreground shadow-soft">
          <Zap className="w-3 h-3" /> 240 XP
        </span>
      </div>
      <div className="font-display text-lg leading-tight mb-1">Համայնքի ներդրող</div>
      <div className="text-[11px] text-muted-foreground mb-3">Մակարդակ 3 → 4</div>
      <div className="demo-bar">
        <span style={{ width: "45%" }} />
      </div>
    </div>
  );
}

function AgentModule() {
  return (
    <div className="bento-tile p-4 sm:p-5 row-span-2 flex flex-col" onMouseMove={trackGlow}>
      <div className="flex items-center gap-2 mb-4">
        <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-hero text-primary-foreground">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          AI օգնական
        </span>
      </div>
      <div className="space-y-2.5 text-[13px] leading-snug flex-1">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 w-fit">
          Ի՞նչ նախագիծ սկսեմ։
        </div>
        <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">
          Քո «դիզայն» և «էկոլոգիա» հետաքրքրություններով՝ փորձիր «Կանաչ բակ» պաստառների շարքը 🌱
        </div>
        <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">
          Ավելացնե՞մ առաջին քայլը օրակարգիդ։
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
        <span className="text-xs text-muted-foreground flex-1">Գրիր հաղորդագրություն…</span>
        <span className="grid place-items-center w-6 h-6 rounded-lg bg-primary text-primary-foreground">
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

function QuestModule() {
  const quests = [
    { t: "Միացիր միջոցառման", done: true },
    { t: "Թարմացրու պրոֆիլդ", done: true },
    { t: "Սկսիր նախագիծ", done: false },
  ];
  return (
    <div className="bento-tile p-4 sm:p-5" onMouseMove={trackGlow}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Այսօրվա քվեստներ
        </span>
        <Trophy className="w-3.5 h-3.5 text-accent" />
      </div>
      <ul className="space-y-2">
        {quests.map((q) => (
          <li key={q.t} className="flex items-center gap-2 text-[13px]">
            <span
              className={`grid place-items-center w-[18px] h-[18px] rounded-full border shrink-0 ${
                q.done ? "bg-success border-success text-success-foreground" : "border-border"
              }`}
            >
              {q.done && <Check className="w-3 h-3" />}
            </span>
            <span className={q.done ? "line-through text-muted-foreground" : ""}>{q.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------- Ecosystem bento ----------------------------- */

const FEATURES = [
  {
    icon: Compass,
    title: "Անհատականացված AI առաջարկներ",
    desc: "Մեկ անգամ նշիր քո հետաքրքրությունները՝ և ակնթարթորեն ստացիր քեզ համար ընտրված դասեր, միջոցառումներ ու նախագծեր։",
    big: true,
  },
  {
    icon: Lightbulb,
    title: "AI նախագծային գաղափարներ",
    desc: "Իրական, կոնկրետ գաղափարներ՝ առաջին քայլերի հետ միասին։",
  },
  {
    icon: Rocket,
    title: "Մեկնարկ մեկ հպումով",
    desc: "Գործարկիր նախագիծ, հետևիր առաջընթացին, առաջ շարժվիր թիմով։",
  },
  {
    icon: Trophy,
    title: "Մակարդակներ և նշաններ",
    desc: "Վեց մակարդակ, ինը նշան․ աճը դառնում է տեսանելի։",
  },
  {
    icon: Users,
    title: "Կրթական հնարավորություններ",
    desc: "Աշխատանոցներ, մաստեր-դասեր, ակումբներ և համայնքային միջոցառումներ։",
  },
  {
    icon: BarChart3,
    title: "Վերլուծություններ",
    desc: "Կազմակերպիչները տեսնում են հետաքրքրությունների միտումները՝ ավելի լավ պլանավորելու համար։",
    big: true,
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />

      {/* Hero — asymmetric split with a live product bento on the right */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 w-[420px] sm:w-[520px] h-[420px] sm:h-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 w-[460px] sm:w-[560px] h-[460px] sm:h-[560px] rounded-full bg-accent/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 pt-8 sm:pt-16 md:pt-24 pb-12 sm:pb-20 md:pb-28">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-6 animate-rise">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full glass border border-border/60 text-[11px] sm:text-xs font-medium text-foreground/80 mb-5 sm:mb-7 shadow-soft max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">AI-ով աշխատող երիտասարդական հարթակ</span>
              </div>

              <h1 className="font-display text-[26px] min-[380px]:text-[31px] sm:text-5xl lg:text-5xl xl:text-[64px] leading-[1.08] text-foreground mb-5 sm:mb-7 max-w-full">
                Տարածք
                <br />
                <span className="text-gradient italic font-medium">հետաքրքրասեր</span>
                <br />
                <span className="text-gradient italic font-medium">սերնդի համար։</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed mb-7 sm:mb-10">
                Հետաքրքրություններից դեպի իրական հնարավորություններ և նախագծեր․ խելացի հարթակ, որտեղ
                Էջմիածնի երիտասարդները բացահայտում, ստեղծում և աճում են իրենց համայնքի հետ։
              </p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="group w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 pl-5 sm:pl-7 pr-2.5 sm:pr-3 py-3 rounded-full bg-foreground text-background font-medium shadow-elegant hover:shadow-lift transition-all duration-300 min-h-[52px]"
                >
                  Միացիր հիմա
                  <span className="w-9 h-9 rounded-full bg-background/15 grid place-items-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:rotate-45">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  to="/opportunities"
                  className="group w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 rounded-full text-foreground font-medium border border-border/70 hover:border-foreground/30 hover:bg-card/60 backdrop-blur transition-all min-h-[52px]"
                >
                  Բացահայտել հնարավորությունները
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
                {[
                  { n: 6, s: "", l: "մակարդակ" },
                  { n: 9, s: "", l: "նշան" },
                  { n: 100, s: "%", l: "անվճար" },
                ].map((x) => (
                  <div key={x.l} className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl sm:text-3xl text-gradient">
                      <CountUp to={x.n} suffix={x.s} />
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      {x.l}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live product bento */}
            <div
              className="lg:col-span-6 relative animate-rise pt-10 sm:pt-14"
              style={{ animationDelay: "150ms" }}
            >
              <img
                src={logo}
                alt="Էջմիածնի Երիտասարդական Տուն"
                className="absolute top-0 right-1 sm:right-2 w-14 h-14 sm:w-[72px] sm:h-[72px] object-contain animate-float drop-shadow-[0_16px_40px_rgba(43,168,224,0.35)]"
              />
              <div className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-3 sm:gap-4">
                <AgentModule />
                <XPModule />
                <QuestModule />
                <BrandIntroTile />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem — asymmetric bento, no uniform grid */}
      <section className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 py-14 sm:py-20 md:py-28">
        <div className="max-w-3xl mb-9 sm:mb-14 min-w-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-primary mb-4">
            Էկոհամակարգ
          </div>
          <h2 className="font-display text-2xl min-[380px]:text-3xl sm:text-4xl md:text-5xl leading-tight mb-4">
            Ամբողջական երիտասարդական էկոհամակարգ՝
            <span className="italic text-muted-foreground">
              {" "}
              կառուցված քո հետաքրքրությունների շուրջ։
            </span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              onMouseMove={trackGlow}
              className={`bento-tile p-5 sm:p-7 animate-rise ${f.big ? "lg:col-span-2" : ""}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-warm grid place-items-center text-accent-foreground mb-4 shadow-soft">
                <f.icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
              </div>
              <h3 className="font-display text-lg sm:text-xl text-foreground mb-1.5 leading-tight">
                {f.title}
              </h3>
              <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Growth simulator — interactive, uses the real level model */}
      <section className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 pb-14 sm:pb-20 md:pb-28">
        <GrowthSimulator />
      </section>

      {/* How it works — timeline rail */}
      <section className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 pb-20 sm:pb-24 md:pb-32">
        <div className="grid lg:grid-cols-12 gap-8 sm:gap-12 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-primary mb-4">
              Ինչպես է աշխատում
            </div>
            <h2 className="font-display text-2xl min-[380px]:text-3xl sm:text-4xl md:text-5xl leading-tight mb-4">
              Չորս հանգիստ քայլ՝
              <br />
              <span className="italic text-muted-foreground">մեկ պայծառ ճանապարհ։</span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Գրանցվիր, կիսվիր քո հետաքրքրություններով, և թող հարթակը անի մնացածը։
            </p>
          </div>

          <ol className="lg:col-span-7 relative space-y-4 sm:space-y-5 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-primary/50 before:via-accent/40 before:to-transparent">
            {[
              { t: "Գրանցվել", d: "Ստեղծիր քո հաշիվը մի քանի վայրկյանում։" },
              { t: "Սկսել", d: "Ընտրիր հետաքրքրությունները, հմտություններն ու անձնական նպատակը։" },
              {
                t: "Ստանալ AI առաջարկներ",
                d: "Մենք առաջարկում ենք դասեր, միջոցառումներ և նախագծեր։",
              },
              { t: "Սկսել նախագծեր", d: "Մեկնարկիր և աճիր ճանապարհին։" },
            ].map((s, i) => (
              <li
                key={s.t}
                className="relative flex gap-4 sm:gap-5 animate-rise"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="relative z-10 grid place-items-center w-10 h-10 rounded-full bg-gradient-hero text-primary-foreground font-display text-sm shadow-soft shrink-0">
                  {i + 1}
                </span>
                <div className="bento-tile flex-1 p-4 sm:p-5" onMouseMove={trackGlow}>
                  <div className="font-display text-lg mb-1">{s.t}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <div className="relative mt-14 sm:mt-20 overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-hero shadow-elegant">
          <div className="absolute -top-20 -right-20 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-white/15 blur-3xl" />
          <div className="relative px-4 min-[380px]:px-5 sm:px-10 md:px-14 py-8 sm:py-14 grid md:grid-cols-12 gap-5 sm:gap-10 items-center text-primary-foreground">
            <div className="md:col-span-8">
              <h3 className="font-display text-[20px] min-[380px]:text-[22px] sm:text-3xl md:text-4xl leading-tight mb-3 sm:mb-4">
                Քո հետաքրքրությունները արժանի են <span className="italic">աճելու տարածքի։</span>
              </h3>
              <p className="text-primary-foreground/80 text-sm min-[380px]:text-base sm:text-lg max-w-xl">
                Միացիր Էջմիածնի Երիտասարդական Տանը և քո սիրած զբաղմունքը դարձրու հաջորդ ձեռքբերումը։
              </p>
            </div>
            <div className="md:col-span-4 md:text-right">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 pl-5 sm:pl-7 pr-2.5 sm:pr-3 py-3 rounded-full bg-background text-foreground font-medium shadow-elegant hover:shadow-lift transition-all duration-300 min-h-[52px]"
              >
                <span className="min-w-0">Սկսել ճանապարհը</span>
                <span className="w-9 h-9 rounded-full bg-foreground/10 grid place-items-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:rotate-45 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-10 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="w-7 h-7 object-contain" />
            <span className="text-xs sm:text-sm text-muted-foreground">
              © {new Date().getFullYear()} Էջմիածնի Երիտասարդական Տուն
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
            <Link
              to="/opportunities"
              className="inline-flex items-center min-h-[44px] px-3 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              Հնարավորություններ
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center min-h-[44px] px-3 rounded-lg hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              Մուտք
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
