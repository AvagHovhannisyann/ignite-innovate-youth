import { lazy, Suspense, useEffect, useState } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import logo from "@/assets/logo.png";

const Player = lazy(() => import("@remotion/player").then((m) => ({ default: m.Player })));

const FPS = 30;
const DURATION = 210; // 7s loop

const TAGLINE = ["Բացահայտիր։", "Ստեղծիր։", "Աճիր։"];

/** Remotion composition: animated brand moment for the landing page. */
function BrandComposition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const fadeOut = interpolate(frame, [durationInFrames - 24, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const sweep = interpolate(frame, [0, durationInFrames], [-30, 130]);
  const ringScale = 1 + 0.06 * Math.sin((frame / fps) * Math.PI);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 140% at 20% 0%, oklch(0.68 0.14 235) 0%, oklch(0.45 0.12 245) 55%, oklch(0.3 0.1 250) 100%)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* moving light sweep */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(115deg, transparent ${sweep - 18}%, oklch(0.95 0.05 60 / 0.22) ${sweep}%, transparent ${sweep + 18}%)`,
        }}
      />
      {/* pulsing rings */}
      {[220, 320, 430].map((size, i) => (
        <div
          key={size}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: "1.5px solid oklch(0.99 0 0 / 0.14)",
            transform: `scale(${ringScale + i * 0.02})`,
          }}
        />
      ))}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <img
          src={logo}
          alt=""
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            transform: `scale(${logoIn}) translateY(${(1 - logoIn) * 40}px)`,
            filter: "drop-shadow(0 24px 60px oklch(0.2 0.1 250 / 0.6))",
          }}
        />
        <div style={{ display: "flex", gap: 18 }}>
          {TAGLINE.map((word, i) => {
            const at = 20 + i * 16;
            const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 130 } });
            return (
              <span
                key={word}
                style={{
                  fontFamily: '"Fraunces", "Noto Serif Armenian", Georgia, serif',
                  fontSize: 44,
                  fontWeight: 700,
                  color: i === 2 ? "oklch(0.85 0.14 70)" : "oklch(0.99 0 0)",
                  opacity: s,
                  transform: `translateY(${(1 - s) * 26}px)`,
                  textShadow: "0 4px 24px oklch(0.2 0.1 250 / 0.5)",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        {(() => {
          const s = spring({ frame: frame - 78, fps, config: { damping: 12 } });
          return (
            <div
              style={{
                opacity: s,
                transform: `scale(${0.8 + 0.2 * s})`,
                background: "linear-gradient(135deg, oklch(0.82 0.16 80), oklch(0.75 0.17 55))",
                color: "oklch(0.25 0.1 60)",
                fontFamily: '"Inter", "Noto Sans Armenian", sans-serif',
                fontWeight: 700,
                fontSize: 20,
                padding: "10px 22px",
                borderRadius: 999,
                boxShadow: "0 12px 40px oklch(0.75 0.17 55 / 0.4)",
              }}
            >
              +25 XP · Մակարդակ 4
            </div>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Landing tile that hosts the Remotion player. Client-only (the player has no
 * SSR story), lazy-loaded so it costs nothing until the landing renders.
 */
export function BrandIntroTile() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="bento-tile min-[460px]:col-span-2 overflow-hidden"
      aria-label="Բրենդային անիմացիա"
    >
      <div className="aspect-[21/9] w-full">
        {mounted && (
          <Suspense
            fallback={<div className="w-full h-full bg-gradient-hero animate-pulse-soft" />}
          >
            <Player
              component={BrandComposition}
              durationInFrames={DURATION}
              fps={FPS}
              compositionWidth={840}
              compositionHeight={360}
              style={{ width: "100%", height: "100%" }}
              autoPlay
              loop
              controls={false}
              clickToPlay={false}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
