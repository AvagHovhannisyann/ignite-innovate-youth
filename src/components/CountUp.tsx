import { useEffect, useRef, useState } from "react";

/** Number that counts up from 0 once it scrolls into view (or immediately if `eager`). */
export function CountUp({
  to,
  suffix = "",
  eager = false,
}: {
  to: number;
  suffix?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const run = () => {
      const start = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (eager) {
      run();
      return;
    }

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        run();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, eager]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
