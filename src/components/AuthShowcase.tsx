import { lazy, Suspense, useEffect, useState } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useAutoplayGuard } from "@/components/remotion-autoplay";
import logo from "@/assets/logo.png";

const Player = lazy(() => import("@remotion/player").then((m) => ({ default: m.Player })));

const FPS = 30;
const DURATION = 280; // ~9.3s loop, three scenes

const W = 480;
const H = 620;

const font = '"Inter", "Noto Sans Armenian", sans-serif';
const display = '"Fraunces", "Noto Serif Armenian", Georgia, serif';

/** Scene window helper: returns 0→1 spring-in and a 0→1 fade-out near the end. */
function useScene(from: number, to: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - from;
  const active = frame >= from && frame < to;
  const enter = spring({ frame: local, fps, config: { damping: 14, stiffness: 120 } });
  const exit = interpolate(frame, [to - 14, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { local, active, enter, exit };
}

/* Scene 1 — a quest card completes and pays out XP. */
function QuestScene() {
  const { fps } = useVideoConfig();
  const { local, active, enter, exit } = useScene(0, 95);
  if (!active) return null;

  const barPct = interpolate(local, [15, 50], [42, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const check = spring({ frame: local - 52, fps, config: { damping: 11, stiffness: 190 } });
  const chip = spring({ frame: local - 60, fps, config: { damping: 10, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
      <div
        style={{
          width: 340,
          borderRadius: 24,
          padding: 24,
          background: "oklch(1 0 0 / 0.10)",
          border: "1px solid oklch(1 0 0 / 0.18)",
          backdropFilter: "blur(10px)",
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.9 + enter * 0.1})`,
          opacity: enter,
          fontFamily: font,
          color: "oklch(0.98 0.01 250)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, oklch(0.68 0.14 235), oklch(0.78 0.12 230))",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Օրվա քվեստ</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Միացիր միջոցառման</div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              transform: `scale(${check})`,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "oklch(0.72 0.2 150)",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
        </div>
        <div
          style={{
            marginTop: 20,
            height: 12,
            borderRadius: 999,
            background: "oklch(1 0 0 / 0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barPct}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, oklch(0.68 0.14 235), oklch(0.76 0.16 60))",
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: "27%",
          right: "13%",
          transform: `scale(${chip}) rotate(${(1 - chip) * 20}deg)`,
          opacity: chip,
          background: "linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.75 0.17 55))",
          color: "oklch(0.25 0.1 60)",
          fontFamily: font,
          fontWeight: 800,
          fontSize: 22,
          padding: "10px 20px",
          borderRadius: 999,
          boxShadow: "0 12px 40px oklch(0.75 0.17 55 / 0.45)",
        }}
      >
        +35 XP
      </div>
    </AbsoluteFill>
  );
}

/* Scene 2 — the XP ring fills and the level flips 3 → 4. */
function LevelScene() {
  const { fps } = useVideoConfig();
  const { local, active, enter, exit } = useScene(95, 190);
  if (!active) return null;

  const pct = interpolate(local, [10, 60], [45, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xp = Math.round(
    interpolate(local, [10, 60], [240, 350], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const levelUp = spring({ frame: local - 62, fps, config: { damping: 10, stiffness: 150 } });
  const level = local < 62 ? 3 : 4;
  const r = 74;
  const c = 2 * Math.PI * r;

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: exit, fontFamily: font }}
    >
      <div
        style={{
          position: "relative",
          transform: `scale(${0.85 + enter * 0.15})`,
          opacity: enter,
        }}
      >
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle
            cx="110"
            cy="110"
            r={r}
            fill="none"
            stroke="oklch(1 0 0 / 0.14)"
            strokeWidth="14"
          />
          <circle
            cx="110"
            cy="110"
            r={r}
            fill="none"
            stroke="url(#showcase-ring)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform="rotate(-90 110 110)"
          />
          <defs>
            <linearGradient id="showcase-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.68 0.14 235)" />
              <stop offset="100%" stopColor="oklch(0.76 0.16 60)" />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "oklch(0.98 0.01 250)",
          }}
        >
          <div style={{ textAlign: "center", transform: `scale(${1 + levelUp * 0.15})` }}>
            <div style={{ fontFamily: display, fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
              {level}
            </div>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.8 }}>ՄԱԿԱՐԴԱԿ</div>
          </div>
        </div>
        {/* level-up glow pulse */}
        <div
          style={{
            position: "absolute",
            inset: -18,
            borderRadius: "50%",
            border: "2px solid oklch(0.85 0.14 70)",
            opacity: levelUp > 0 ? Math.max(0, 0.8 - levelUp * 0.8) : 0,
            transform: `scale(${1 + levelUp * 0.35})`,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 26,
          color: "oklch(0.98 0.01 250)",
          fontWeight: 700,
          fontSize: 24,
          opacity: enter,
        }}
      >
        {xp} XP
      </div>
      <div
        style={{
          marginTop: 8,
          transform: `scale(${levelUp})`,
          opacity: levelUp,
          background: "linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.75 0.17 55))",
          color: "oklch(0.25 0.1 60)",
          fontWeight: 800,
          fontSize: 16,
          padding: "8px 18px",
          borderRadius: 999,
        }}
      >
        Նոր մակարդակ․ Նախագծի ստեղծող
      </div>
    </AbsoluteFill>
  );
}

/* Scene 3 — badges rain in around the logo with the closing tagline. */
function BadgeScene() {
  const { fps } = useVideoConfig();
  const { local, active, enter, exit } = useScene(190, DURATION);
  if (!active) return null;

  const BADGES = ["🏆", "🚀", "🎨", "🌱", "🤝"];
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: exit,
        fontFamily: font,
        color: "oklch(0.98 0.01 250)",
      }}
    >
      <img
        src={logo}
        alt=""
        style={{
          width: 96,
          height: 96,
          objectFit: "contain",
          transform: `scale(${enter})`,
          filter: "drop-shadow(0 20px 50px oklch(0.2 0.1 250 / 0.6))",
        }}
      />
      {BADGES.map((b, i) => {
        const s = spring({
          frame: local - 8 - i * 5,
          fps,
          config: { damping: 11, stiffness: 160 },
        });
        const angle = (i / BADGES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <div
            key={b}
            style={{
              position: "absolute",
              left: "50%",
              top: "44%",
              fontSize: 30,
              transform: `translate(-50%, -50%) translate(${Math.cos(angle) * 120 * s}px, ${Math.sin(angle) * 120 * s}px) scale(${s})`,
            }}
          >
            {b}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          bottom: 84,
          textAlign: "center",
          fontFamily: display,
          fontSize: 26,
          fontWeight: 700,
          opacity: interpolate(local, [30, 45], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Խաղա։ Սովորիր։ Աճիր։
      </div>
    </AbsoluteFill>
  );
}

/** Looping product-story composition shown beside the sign-in form. */
function ShowcaseComposition() {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, DURATION], [-25, 125]);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(130% 120% at 80% 0%, oklch(0.45 0.12 245) 0%, oklch(0.28 0.1 250) 55%, oklch(0.2 0.08 255) 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(160deg, transparent ${sweep - 15}%, oklch(0.9 0.06 60 / 0.14) ${sweep}%, transparent ${sweep + 15}%)`,
        }}
      />
      {/* drifting ambient dots (deterministic, no randomness between frames) */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = ((i * 97) % 100) / 100;
        const y = ((i * 41) % 100) / 100;
        const drift = Math.sin((frame / FPS) * 0.8 + i) * 10;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * W,
              top: y * H + drift,
              width: 4 + (i % 3) * 2,
              height: 4 + (i % 3) * 2,
              borderRadius: "50%",
              background: i % 2 ? "oklch(0.76 0.16 60 / 0.5)" : "oklch(0.78 0.12 230 / 0.5)",
            }}
          />
        );
      })}
      <QuestScene />
      <LevelScene />
      <BadgeScene />
      {/* scene progress dots */}
      <div
        style={{
          position: "absolute",
          bottom: 26,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {[0, 95, 190].map((from, i) => {
          const to = [95, 190, DURATION][i];
          const on = frame >= from && frame < to;
          return (
            <div
              key={from}
              style={{
                width: on ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: on ? "oklch(0.85 0.14 70)" : "oklch(1 0 0 / 0.3)",
                transition: "width 300ms",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Right-hand panel of the auth page on tablet/desktop (hidden on phones):
 * an animated tour of what the student gets — quests, XP, levels, badges.
 */
export function AuthShowcase() {
  const [mounted, setMounted] = useState(false);
  const playerRef = useAutoplayGuard(mounted);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className="relative h-full min-h-[560px] rounded-3xl overflow-hidden shadow-elegant border border-border/60"
      // Matches the composition's edge color so aspect-ratio letterboxing is invisible.
      style={{ background: "oklch(0.22 0.09 252)" }}
      aria-label="Հարթակի հնարավորությունների անիմացիա"
      onPointerDown={() => playerRef.current?.play()}
    >
      {mounted && (
        <Suspense
          fallback={<div className="absolute inset-0 bg-gradient-hero animate-pulse-soft" />}
        >
          <Player
            ref={playerRef}
            component={ShowcaseComposition}
            durationInFrames={DURATION}
            fps={FPS}
            compositionWidth={W}
            compositionHeight={H}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            autoPlay
            loop
            controls={false}
            clickToPlay={false}
            initiallyMuted
            errorFallback={() => (
              <div className="absolute inset-0 bg-gradient-hero" aria-hidden="true" />
            )}
          />
        </Suspense>
      )}
    </div>
  );
}
