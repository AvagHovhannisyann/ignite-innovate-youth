import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  MessageSquare,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";

import { AGENT_CAPABILITIES } from "@/lib/agent-prompts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/capabilities")({
  head: () => ({
    meta: [
      { title: "AI մենթորի հնարավորությունները — EYH" },
      {
        name: "description",
        content:
          "Ի՞նչ կարող է անել քո անհատական AI մենթորը՝ հմտություններ, գործիքներ, ոճ և անվտանգություն։",
      },
    ],
  }),
  component: CapabilitiesPage,
});

const EXAMPLE_QUESTIONS = [
  "Կազմիր ինձ ուսման պլան մաթեմատիկայի օլիմպիադայի համար՝ 6 շաբաթով։",
  "Ի՞նչ նախագիծ կառաջարկես իմ XP-ի մակարդակին։",
  "Ավելացրու իմ օրակարգում վաղը՝ 18։00-ին, անգլերենի պարապմունք։",
  "Ի՞նչ քվեսթեր ունեմ այս շաբաթ, և ի՞նչ ապացույց է պետք։",
  "Հարցրու ադմինին՝ կարո՞ղ եմ ուշանալ վաղվա հանդիպումից։",
  "Ո՞ր հնարավորությունները կհամապատասխանեն ինձ ծրագրավորման ուղղությամբ։",
] as const;

function CapabilitiesPage() {
  return (
    <main className="min-h-dvh bg-gradient-soft">
      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-28 pt-5 sm:px-6 sm:pt-8 md:pb-12">
        <header className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-card p-6 shadow-elegant sm:p-9 lg:p-12">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-blue/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-brand-orange/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative max-w-3xl">
            <div className="chip inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              EYH Mentor
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
              Մենթոր, որը ոչ միայն պատասխանում է, այլև օգնում է գործել
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Քո անհատական AI մենթորը հասկանում է նպատակներդ, օգնում է պլանավորել և կարող է անվտանգ
              գործիքներով աշխատանք կատարել հենց քո հաշվում։ Վերջնական որոշումը միշտ քոնն է։
            </p>
            <Button asChild size="lg" className="mt-7 min-h-11 rounded-xl px-5 shadow-soft">
              <Link to="/agent">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Բացել AI մենթորը
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <dl className="relative mt-9 grid grid-cols-3 gap-2 border-t border-border pt-6 sm:max-w-xl sm:gap-4">
            <CapabilityStat value={AGENT_CAPABILITIES.skills.length} label="ուղղություն" />
            <CapabilityStat value={AGENT_CAPABILITIES.tools.length} label="գործիք" />
            <CapabilityStat value={AGENT_CAPABILITIES.styles.length} label="խոսքի ոճ" />
          </dl>
        </header>

        <Section
          id="mentor-skills"
          eyebrow="Ինչով կարող է օգնել"
          icon={<WandSparkles className="h-5 w-5" />}
          title="Հմտություններ"
          subtitle="Մեծ նպատակից մինչև հստակ հաջորդ քայլ՝ մենթորը հարմարեցնում է օգնությունը քո իրավիճակին։"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {AGENT_CAPABILITIES.skills.map((skill, index) => (
              <article key={skill.id} className="card-interactive group p-5" role="listitem">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Sparkles
                    className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-base font-semibold leading-6 text-foreground">{skill.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{skill.desc}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="mentor-tools"
          eyebrow="Գործողություններ հաշվում"
          icon={<Wrench className="h-5 w-5" />}
          title="Գործիքներ"
          subtitle="Մենթորը կարող է աշխատել քո օրակարգի, նախագծերի, քվեսթների և հնարավորությունների հետ։"
        >
          <div className="grid gap-3 sm:grid-cols-2" role="list">
            {AGENT_CAPABILITIES.tools.map((tool) => {
              const needsConfirmation = tool.autonomy !== "auto";
              return (
                <article
                  key={tool.id}
                  className="card-base flex items-start gap-4 p-5"
                  role="listitem"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      needsConfirmation ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {needsConfirmation ? (
                      <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Zap className="h-5 w-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold leading-6 text-foreground">{tool.title}</h3>
                      <Badge
                        variant={needsConfirmation ? "default" : "secondary"}
                        className="chip rounded-full px-2.5 py-1 text-[11px]"
                      >
                        {needsConfirmation ? "Քո հաստատումով" : "Ինքնավար"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{tool.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              «Քո հաստատումով» նշված գործողությունները կատարվում են միայն այն բանից հետո, երբ դու
              հստակ համաձայնություն ես տալիս։
            </p>
          </div>
        </Section>

        <Section
          id="mentor-styles"
          eyebrow="Քեզ հարմար լեզվով"
          icon={<Palette className="h-5 w-5" />}
          title="Հաղորդակցման ոճեր"
          subtitle="Կարճ պատասխան, մանրամասն բացատրություն կամ քայլ առ քայլ ուղեցույց՝ ըստ քո կարիքի։"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {AGENT_CAPABILITIES.styles.map((style) => (
              <article key={style.id} className="bento-tile p-5" role="listitem">
                <h3 className="font-semibold text-foreground">{style.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{style.desc}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="mentor-safety"
          eyebrow="Վստահելի օգտագործում"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Անվտանգություն և սահմաններ"
          subtitle="Հստակ սահմաններ՝ քո տվյալները, ընտրությունը և բարեկեցությունը պաշտպանելու համար։"
        >
          <div className="rounded-[1.5rem] border border-border bg-gradient-card p-5 shadow-soft sm:p-7">
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {AGENT_CAPABILITIES.safety.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm leading-6">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="mentor-examples"
          eyebrow="Սկսելու համար"
          icon={<MessageSquare className="h-5 w-5" />}
          title="Օրինակ հարցեր"
          subtitle="Կարող ես գրել բնական լեզվով․ հատուկ հրահանգներ կամ հրամաններ պետք չեն։"
        >
          <div className="grid gap-3 sm:grid-cols-2" role="list">
            {EXAMPLE_QUESTIONS.map((question) => (
              <article
                key={question}
                className="card-interactive flex items-start gap-3 p-5 text-sm leading-6"
                role="listitem"
              >
                <MessageSquare
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p>«{question}»</p>
              </article>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function CapabilityStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-foreground tabular-nums sm:text-2xl">{value}</dd>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5" aria-labelledby={id}>
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
          <h2 id={id} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
