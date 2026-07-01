import { createFileRoute, Link } from "@tanstack/react-router";
import { AGENT_CAPABILITIES } from "@/lib/agent-prompts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Wrench, Palette, Shield, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/capabilities")({
  head: () => ({
    meta: [
      { title: "AI մենթորի հնարավորությունները — EYH" },
      { name: "description", content: "Ի՞նչ կարող է անել քո անհատական AI մենթորը՝ հմտություններ, գործիքներ, ոճ և անվտանգություն։" },
    ],
  }),
  component: CapabilitiesPage,
});

function CapabilitiesPage() {
  return (
    <div className="p-3 sm:p-6 pb-24 md:pb-6 max-w-5xl mx-auto space-y-8 min-w-0 overflow-x-hidden">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> EYH Mentor
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Քո AI մենթորի հնարավորությունները</h1>
          <p className="text-muted-foreground max-w-2xl">
            Ամեն ուսանող ունի անհատական AI մենթոր՝ EYH Mentor։ Ստորև՝ ինչ կարող է անել, ինչ գործիքների է տիրապետում, ինչպես է խոսում քեզ հետ, և ինչ սահմաններ ունի։
          </p>
          <div className="flex gap-2 pt-2">
            <Button asChild>
              <Link to="/agent"><MessageSquare className="w-4 h-4 mr-2" /> Բացել AI մենթորը</Link>
            </Button>
          </div>
        </header>

        <Section icon={<Sparkles className="w-5 h-5" />} title="Հմտություններ" subtitle="9 հիմնական ուղղություն, որոնցով կարող ես օգտվել">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENT_CAPABILITIES.skills.map((s) => (
              <Card key={s.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section icon={<Wrench className="w-5 h-5" />} title="Գործիքներ" subtitle="Իրական ակցիաներ, որ AI-ն կարող է կատարել քո հաշվում">
          <div className="grid sm:grid-cols-2 gap-3">
            {AGENT_CAPABILITIES.tools.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <Badge variant={t.autonomy === "auto" ? "secondary" : "default"} className="text-[10px]">
                    {t.autonomy === "auto" ? "ինքնավար" : "հաստատումով"}
                  </Badge>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div>{t.desc}</div>
                  <code className="text-[11px] text-muted-foreground/70">{t.id}</code>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            «Ինքնավար» գործիքները AI-ն օգտագործում է առանց հաստատման։ XP ծախսել, գրառում հրապարակել, նախագիծ ուղարկել — այս գործողությունները միշտ պահանջում են քո «այո»-ն։
          </p>
        </Section>

        <Section icon={<Palette className="w-5 h-5" />} title="Հաղորդակցման ոճեր" subtitle="AI-ն ադապտացվում է քեզ">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENT_CAPABILITIES.styles.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section icon={<Shield className="w-5 h-5" />} title="Անվտանգություն և սահմաններ" subtitle="Ինչ AI-ն չի անի՝ քո ու մյուսների պաշտպանության համար">
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                {AGENT_CAPABILITIES.safety.map((line, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary mt-0.5">•</span><span>{line}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>

        <Section icon={<MessageSquare className="w-5 h-5" />} title="Օրինակ հարցեր" subtitle="Ինչպես սկսել">
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              "Կազմիր ինձ ուսման պլան մաթեմատիկայի օլիմպիադայի համար, 6 շաբաթ։",
              "Ի՞նչ նախագիծ առաջարկում ես իմ XP-ի մակարդակին։",
              "Ավելացրու իմ օրակարգում վաղը 18։00 — անգլերենի պարապմունք։",
              "Ի՞նչ քվեսթեր ունեմ այս շաբաթ և ի՞նչ ապացույց է պետք։",
              "Հարցրու ադմինին՝ կարո՞ղ եմ արդյոք ուշանալ վաղվա հանդիպումից։",
              "Ո՞ր հնարավորությունները կհամապատասխանեն ինձ՝ ծրագրավորման ուղղությամբ։",
            ].map((q, i) => (
              <Card key={i} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-4 pb-4 text-sm">"{q}"</CardContent>
              </Card>
            ))}
          </div>
        </Section>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
