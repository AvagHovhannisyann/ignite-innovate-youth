import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
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
} from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    links: [{ rel: "preload", as: "image", href: logo, fetchpriority: "high" } as any],
  }),
});

function Feature({ icon: Icon, title, desc, index }: any) {
  return (
    <div
      className="group relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 glass hover-lift animate-rise overflow-hidden min-w-0"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-warm grid place-items-center text-accent-foreground mb-4 sm:mb-6 shadow-soft transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
        <Icon className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <h3 className="font-display text-xl sm:text-2xl text-foreground mb-2 sm:mb-3 leading-tight break-words">{title}</h3>
      <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ n, t, d, index }: any) {
  return (
    <div
      className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 glass hover-lift animate-rise overflow-hidden min-w-0"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <span className="font-display text-4xl sm:text-5xl text-gradient leading-none">{n}</span>
        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center bg-primary/10 text-primary transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
      <div className="font-display text-lg sm:text-xl mb-1.5 sm:mb-2">{t}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{d}</p>
    </div>
  );
}


function Landing() {
  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 w-[420px] sm:w-[520px] h-[420px] sm:h-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 w-[460px] sm:w-[560px] h-[460px] sm:h-[560px] rounded-full bg-accent/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 pt-8 sm:pt-20 md:pt-32 pb-12 sm:pb-24 md:pb-40">
          <div className="grid lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-7 animate-rise">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full glass border border-white/40 text-[11px] sm:text-xs font-medium text-foreground/80 mb-5 sm:mb-8 shadow-soft max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">AI-ով աշխատող երիտասարդական հարթակ</span>
              </div>

              <h1 className="font-display text-[26px] min-[380px]:text-[31px] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[84px] leading-[1.08] text-foreground mb-5 sm:mb-8 break-words max-w-full">
                Տարածք
                <br />
                <span className="text-gradient italic font-medium">հետաքրքրա</span>
                <br className="sm:hidden" />
                <span className="text-gradient italic font-medium">սեր սերնդի համար։</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mb-7 sm:mb-12 break-words">
                Հետաքրքրություններից դեպի իրական հնարավորություններ և նախագծեր․ խելացի հարթակ,
                որտեղ Էջմիածնի երիտասարդները բացահայտում, ստեղծում և աճում են իրենց համայնքի հետ։
              </p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="group w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 pl-5 sm:pl-7 pr-2.5 sm:pr-3 py-3 rounded-full bg-foreground text-background font-medium shadow-elegant hover:shadow-lift transition-all duration-300 min-h-[52px] break-words"
                >
                  Միացիր հիմա
                  <span className="w-9 h-9 rounded-full bg-background/15 grid place-items-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:rotate-45">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  to="/opportunities"
                  className="group w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 rounded-full text-foreground font-medium border border-border/70 hover:border-foreground/30 hover:bg-card/60 backdrop-blur transition-all min-h-[52px] break-words"
                >
                  Բացահայտել հնարավորությունները
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 relative animate-rise overflow-hidden" style={{ animationDelay: "150ms" }}>
              <div className="relative aspect-square w-full max-w-[300px] sm:max-w-md mx-auto px-2 sm:px-0">
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-card glass shadow-elegant" />
                <div className="absolute inset-0 grid place-items-center">
                  <img
                    src={logo}
                    alt="Էջմիածնի Երիտասարդական Տուն"
                    className="w-2/3 h-2/3 object-contain animate-float drop-shadow-[0_20px_50px_rgba(43,168,224,0.35)]"
                  />
                </div>
                <div className="absolute -bottom-4 left-2 sm:-bottom-6 sm:-left-6 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl glass shadow-soft border border-white/40 max-w-[68%]">
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1">
                    Անհատականացված
                  </div>
                  <div className="font-display text-sm sm:text-base leading-tight">AI-ով քեզ համար</div>
                </div>
                <div className="absolute -top-4 right-2 sm:-top-6 sm:-right-6 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl glass shadow-soft border border-white/40 max-w-[68%]">
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1">
                    Ստեղծված է
                  </div>
                  <div className="font-display text-sm sm:text-base leading-tight">Էջմիածնի երիտասարդների համար</div>
                </div>
              </div>
            </div>
          </div>

          {/* Value strip */}
          <div className="mt-14 sm:mt-24 md:mt-36 grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4 gap-px rounded-2xl sm:rounded-3xl overflow-hidden bg-border/70 shadow-soft">
            {[
              { n: "AI", l: "Անհատական առաջարկներ" },
              { n: "1 հպում", l: "Մեկնարկիր նախագիծ" },
              { n: "Մակարդակներ", l: "Աճիր տեսանելի կերպով" },
              { n: "Անվճար", l: "Յուրաքանչյուր ուսանողի համար" },
            ].map((s) => (
              <div
                key={s.l}
                className="bg-card/90 backdrop-blur px-4 sm:px-6 py-6 sm:py-8 md:py-10 text-center transition-colors hover:bg-card"
              >
                <div className="font-display text-xl sm:text-2xl md:text-3xl text-gradient mb-1.5 sm:mb-2">{s.n}</div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] sm:tracking-[0.18em] text-muted-foreground">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* Features */}
      <section className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 py-16 sm:py-24 md:py-40">
        <div className="max-w-3xl mb-10 sm:mb-16 md:mb-20 min-w-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-primary mb-4 sm:mb-6">Էկոհամակարգ</div>
          <h2 className="font-display text-2xl min-[380px]:text-3xl sm:text-4xl md:text-6xl leading-tight mb-4 sm:mb-6 break-words">
            Ամբողջական երիտասարդական էկոհամակարգ՝
            <span className="italic text-muted-foreground"> կառուցված քո հետաքրքրությունների շուրջ։</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Դասեր, միջոցառումներ, նախագծեր և համախոհների համայնք՝ կապված AI-ի միջոցով, որը սովորում է
            քո հետաքրքրությունները և անաղմուկ բացում նոր դռներ։
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <Feature index={0} icon={Compass} title="Անհատականացված AI առաջարկներ" desc="Մեկ անգամ նշիր քո հետաքրքրությունները՝ և ակնթարթորեն ստացիր քեզ համար ընտրված դասեր, միջոցառումներ ու նախագծեր։" />
          <Feature index={1} icon={Lightbulb} title="AI-ով ստեղծված նախագծային գաղափարներ" desc="Իրական, կոնկրետ նախագծային գաղափարներ՝ համապատասխանեցված քո հետաքրքրություններին, առաջին քայլերի հետ միասին։" />
          <Feature index={2} icon={Rocket} title="Նախագծերի մեկնարկ մեկ հպումով" desc="Գործարկիր նախագիծ, հետևիր առաջընթացին և թիմակիցների հետ առաջ շարժվիր։" />
          <Feature index={3} icon={Trophy} title="Մակարդակներ և ձեռքբերումներ" desc="Վեց մակարդակ, ինը նշան․ աճը դառնում է տեսանելի՝ քո մասնակցության հետ։" />
          <Feature index={4} icon={Users} title="Կրթական հնարավորություններ" desc="Աշխատանոցներ, մաստեր-դասեր, ակումբներ և համայնքային միջոցառումներ՝ ընտրված երիտասարդների համար։" />
          <Feature index={5} icon={BarChart3} title="Վերլուծություններ և վիճակագրություն" desc="Կազմակերպիչները տեսնում են հետաքրքրությունների միտումներն ու AI-ով ստեղծված պատկերն՝ ավելի լավ պլանավորելու համար։" />
        </div>
      </section>

      {/* How it works */}
      <section className="relative max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 md:px-10 pb-24 sm:pb-28 md:pb-44">
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-12 mb-10 sm:mb-16 md:mb-20 items-end">
          <div className="lg:col-span-7">
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-primary mb-4 sm:mb-6">Ինչպես է աշխատում</div>
            <h2 className="font-display text-2xl min-[380px]:text-3xl sm:text-4xl md:text-6xl leading-tight break-words">
              Չորս հանգիստ քայլ՝
              <br />
              <span className="italic text-muted-foreground">մեկ պայծառ ճանապարհ։</span>
            </h2>
          </div>
          <p className="lg:col-span-5 text-muted-foreground text-base sm:text-lg leading-relaxed">
            Գրանցվիր, կիսվիր քո հետաքրքրություններով, և թող հարթակը անի մնացածը։ Քո հաջորդ նախագիծը
            կամ միջոցառումն ավելի մոտ է, քան մտածում ես։
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {[
            { n: "01", t: "Գրանցվել", d: "Ստեղծիր քո հաշիվը մի քանի վայրկյանում։" },
            { n: "02", t: "Սկսել", d: "Ընտրիր հետաքրքրությունները, հմտություններն ու անձնական նպատակը։" },
            { n: "03", t: "Ստանալ AI առաջարկներ", d: "Մենք առաջարկում ենք դասեր, միջոցառումներ և նախագծեր։" },
            { n: "04", t: "Սկսել նախագծեր", d: "Մեկնարկիր և աճիր ճանապարհին։" },
          ].map((s, i) => (
            <Step key={s.n} {...s} index={i} />
          ))}
        </div>

        {/* CTA card */}
        <div className="relative mt-16 sm:mt-24 md:mt-32 overflow-hidden rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] bg-gradient-hero shadow-elegant max-w-full">
          <div className="absolute -top-20 -right-20 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-white/15 blur-3xl" />
          <div className="relative px-4 min-[380px]:px-5 sm:px-10 md:px-16 py-7 min-[380px]:py-8 sm:py-16 md:py-24 grid md:grid-cols-12 gap-5 sm:gap-10 items-center text-primary-foreground min-w-0 overflow-hidden">
            <div className="md:col-span-8">
              <h3 className="font-display text-[20px] min-[380px]:text-[22px] sm:text-4xl md:text-5xl leading-tight mb-4 sm:mb-5 break-words max-w-full">
                Քո հետաքրքրու<wbr />թյունները արժանի են
                <br className="hidden min-[380px]:block" />
                <span className="italic">աճելու տարածքի։</span>
              </h3>
              <p className="text-primary-foreground/80 text-sm min-[380px]:text-base sm:text-lg max-w-xl break-words">
                Միացիր Էջմիածնի Երիտասարդական Տանը և քո սիրած զբաղմունքը դարձրու հաջորդ ձեռքբերումը։
              </p>
            </div>
            <div className="md:col-span-4 md:text-right">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 pl-5 sm:pl-7 pr-2.5 sm:pr-3 py-3 rounded-full bg-background text-foreground font-medium shadow-elegant hover:shadow-lift transition-all duration-300 min-h-[52px] min-w-0"
              >
                <span className="break-words min-w-0">Սկսել ճանապարհը</span>
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
          <div className="flex items-center gap-5 sm:gap-6 text-sm text-muted-foreground">
            <Link to="/opportunities" className="hover:text-foreground transition-colors">
              Հնարավորություններ
            </Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Մուտք
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
