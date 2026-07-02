/** Cursor-tracked glow for `.bento-tile` elements (drives --glow-x/--glow-y). */
export function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--glow-x", `${((e.clientX - r.left) / r.width) * 100}%`);
  el.style.setProperty("--glow-y", `${((e.clientY - r.top) / r.height) * 100}%`);
}
