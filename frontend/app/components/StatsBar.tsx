"use client";

import { useEffect, useRef, useState } from "react";

interface StatProps {
  end: number;
  suffix?: string;
  label: string;
}

function AnimatedStat({ end, suffix = "+", label }: StatProps) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1800;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * end));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [visible, end]);

  return (
    <div className="stat-item" ref={ref}>
      <div className="stat-number">
        {count}
        <span>{suffix}</span>
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const stats = [
  { end: 35, suffix: "", label: "Members" },
  { end: 10, suffix: "+", label: "Events Conducted" },
  { end: 200, suffix: "+", label: "Projects Submitted" },
  { end: 2500, suffix: "+", label: "Certificates Issued" },
];

export default function StatsBar() {
  return (
    <section className="stats-bar" id="stats">
      {stats.map((stat) => (
        <AnimatedStat
          key={stat.label}
          end={stat.end}
          suffix={stat.suffix}
          label={stat.label}
        />
      ))}
    </section>
  );
}
