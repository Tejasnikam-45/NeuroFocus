import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#signals", label: "Signals" },
  { href: "#cta", label: "Get started" },
];

const KEYFRAMES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }
`;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

type Star = {
  x: number;
  y: number;
  r: number;
  base: number;
  twinkleSpeed: number;
  twinkleAmp: number;
  phase: number;
  color: string;
};
type Nebula = {
  bx: number;
  by: number;
  rx: number;
  ry: number;
  c: string;
  o: number;
  p: number;
  sp: number;
};
type Aurora = {
  y: number;
  amp: number;
  freq: number;
  speed: number;
  phase: number;
  color: string;
  thickness: number;
  opacity: number;
  waveOffset: number;
};
type Dust = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  opacity: number;
  phase: number;
  speed: number;
};
type Shoot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  decay: number;
  color: string;
};

function useSpaceCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvasMaybe = canvasRef.current;
    if (!canvasMaybe) return;
    const ctxMaybe = canvasMaybe.getContext("2d");
    if (!ctxMaybe) return;

    const canvas: HTMLCanvasElement = canvasMaybe;
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    let animId: number;
    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let nebulae: Nebula[] = [];
    let auroras: Aurora[] = [];
    let dust: Dust[] = [];
    let shoots: Shoot[] = [];

    function setup() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;

      stars = Array.from({ length: 320 }, () => ({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.15, 1.4),
        base: rand(0.2, 0.85),
        twinkleSpeed: rand(0.004, 0.018),
        twinkleAmp: rand(0.1, 0.45),
        phase: rand(0, Math.PI * 2),
        color:
          Math.random() < 0.08
            ? "255," + String(~~rand(200, 230)) + ",180"
            : Math.random() < 0.05
              ? "180,210,255"
              : "255,255,255",
      }));

      nebulae = [
        { bx: 0.5, by: 0.18, rx: 560, ry: 300, c: "45,212,191", o: 0.1, p: 0, sp: 0.0012 },
        { bx: 0.82, by: 0.6, rx: 420, ry: 240, c: "139,92,246", o: 0.09, p: 1.8, sp: 0.0009 },
        { bx: 0.12, by: 0.72, rx: 340, ry: 200, c: "99,102,241", o: 0.07, p: 3.5, sp: 0.0011 },
        { bx: 0.65, by: 0.88, rx: 300, ry: 160, c: "45,212,191", o: 0.055, p: 5.2, sp: 0.0008 },
        { bx: 0.28, by: 0.38, rx: 260, ry: 150, c: "168,85,247", o: 0.05, p: 2.1, sp: 0.0013 },
      ];

      auroras = Array.from({ length: 3 }, (_, i) => ({
        y: rand(0.05, 0.45),
        amp: rand(60, 130),
        freq: rand(0.0008, 0.002),
        speed: rand(0.0003, 0.0008),
        phase: rand(0, Math.PI * 2),
        color: i === 0 ? "45,212,191" : i === 1 ? "139,92,246" : "99,102,241",
        thickness: rand(60, 110),
        opacity: rand(0.022, 0.05),
        waveOffset: rand(0, 1000),
      }));

      dust = Array.from({ length: 80 }, () => ({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.4, 1.8),
        vx: rand(-0.04, 0.04),
        vy: rand(-0.025, 0.025),
        opacity: rand(0.04, 0.18),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.003, 0.01),
      }));

      shoots = [];
    }

    function spawnShoot() {
      if (shoots.length < 4 && Math.random() < 0.004) {
        const angle = rand(Math.PI * 0.1, Math.PI * 0.45);
        const speed = rand(6, 14);
        shoots.push({
          x: rand(W * 0.1, W * 0.9),
          y: rand(0, H * 0.4),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          len: rand(80, 200),
          life: 1,
          decay: rand(0.018, 0.04),
          color:
            Math.random() < 0.3 ? "45,212,191" : Math.random() < 0.5 ? "139,92,246" : "255,255,255",
        });
      }
    }

    function drawNebulae() {
      nebulae.forEach((n) => {
        n.p += n.sp;
        const nx = n.bx * W + Math.sin(n.p * 0.7) * W * 0.035;
        const ny = n.by * H + Math.cos(n.p * 0.53) * H * 0.028;
        const pulse = n.o + Math.sin(n.p * 1.2) * 0.018;
        const maxR = Math.max(n.rx, n.ry);
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, maxR);
        g.addColorStop(0, "rgba(" + n.c + "," + String(Math.min(pulse * 1.6, 0.22)) + ")");
        g.addColorStop(0.35, "rgba(" + n.c + "," + String(pulse) + ")");
        g.addColorStop(0.7, "rgba(" + n.c + "," + String(pulse * 0.3) + ")");
        g.addColorStop(1, "rgba(" + n.c + ",0)");
        ctx.save();
        ctx.translate(nx, ny);
        ctx.scale(n.rx / maxR, n.ry / maxR);
        ctx.beginPath();
        ctx.arc(0, 0, maxR, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      });
    }

    function drawAuroras() {
      auroras.forEach((a) => {
        a.phase += a.speed;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= W; i += 4) {
          const wave =
            Math.sin(i * a.freq + a.phase + a.waveOffset) * a.amp +
            Math.sin(i * a.freq * 2.3 + a.phase * 0.7) * a.amp * 0.3;
          const yPos = a.y * H + wave;
          if (i === 0) {
            ctx.moveTo(i, yPos);
          } else {
            ctx.lineTo(i, yPos);
          }
        }
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(" + a.color + ",0)");
        grad.addColorStop(0.5, "rgba(" + a.color + "," + String(a.opacity) + ")");
        grad.addColorStop(1, "rgba(" + a.color + ",0)");
        ctx.lineWidth = a.thickness;
        ctx.strokeStyle = grad;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      });
    }

    function drawStars() {
      stars.forEach((s) => {
        s.phase += s.twinkleSpeed;
        const op = Math.max(0.05, s.base + Math.sin(s.phase) * s.twinkleAmp);
        const r = Math.max(0.1, s.r + Math.sin(s.phase * 1.4) * 0.2);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.color + "," + String(Math.min(1, op)) + ")";
        ctx.fill();
        if (s.r > 0.9 && op > 0.6) {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
          g.addColorStop(0, "rgba(" + s.color + "," + String(op * 0.3) + ")");
          g.addColorStop(1, "rgba(" + s.color + ",0)");
          ctx.beginPath();
          ctx.arc(s.x, s.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
      });
    }

    function drawDust() {
      dust.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        d.phase += d.speed;
        if (d.x < 0) d.x = W;
        if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H;
        if (d.y > H) d.y = 0;
        const op = d.opacity + Math.sin(d.phase) * 0.06;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200,220,255," + String(Math.max(0, op)) + ")";
        ctx.fill();
      });
    }

    function drawShoots() {
      spawnShoot();
      shoots = shoots.filter((s) => s.life > 0);
      shoots.forEach((s) => {
        const mag = Math.hypot(s.vx, s.vy);
        const tx = s.x - s.vx * (s.len / mag);
        const ty = s.y - s.vy * (s.len / mag);
        const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
        g.addColorStop(0, "rgba(" + s.color + ",0)");
        g.addColorStop(0.6, "rgba(" + s.color + "," + String(s.life * 0.5) + ")");
        g.addColorStop(1, "rgba(255,255,255," + String(s.life * 0.9) + ")");
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = s.life * 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.life * 2.5);
        glow.addColorStop(0, "rgba(255,255,255," + String(s.life * 0.8) + ")");
        glow.addColorStop(1, "rgba(" + s.color + ",0)");
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.life * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;
      });
    }

    function frame() {
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, W, H);
      drawNebulae();
      drawAuroras();
      drawDust();
      drawStars();
      drawShoots();
      animId = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", setup);
    setup();
    frame();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", setup);
    };
  }, [canvasRef]);
}

function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className +
        " opacity-0 animate-[fadeUp_0.75s_cubic-bezier(0.16,1,0.3,1)_forwards]"
      }
    >
      {children}
    </div>
  );
}

const featureItems = [
  {
    name: "NeuroScore",
    desc: "Real-time cognitive load measurement that tells you when to push and when to rest.",
    accent: "teal",
  },
  {
    name: "NeuroAgent",
    desc: "Your AI co-pilot that filters, prioritizes, and executes so your brain never context-switches.",
    accent: "violet",
  },
  {
    name: "Focus Firewall",
    desc: "Blocks distraction at the source — apps, tabs, notifications — with smart intent detection.",
    accent: "indigo",
  },
];

const statItems = [
  { label: "Focus sessions", value: "2.4M+" },
  { label: "Noise blocked", value: "98.7%" },
  { label: "Avg deep work gain", value: "+3.2h" },
];

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useSpaceCanvas(canvasRef);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div
        className="fixed top-0 left-0 z-[999] h-[2px] bg-gradient-to-r from-teal-400 to-violet-500 transition-all duration-100"
        style={{ width: String(progress) + "%" }}
      />

      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
        aria-hidden
      />

      <header
        className={
          "fixed left-0 right-0 top-0 z-50 transition-all duration-500 " +
          (scrolled
            ? "border-b border-zinc-800/60 bg-[#050507]/70 backdrop-blur-2xl"
            : "bg-transparent")
        }
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            to="/landing"
            className="shrink-0 bg-gradient-to-r from-teal-300 to-violet-400 bg-clip-text text-lg font-bold tracking-tight text-transparent"
          >
            NeuroFocus
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition-colors duration-200 hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900/50 hover:text-white sm:inline-flex"
            >
              Command
            </Link>
            <Link
              to="/"
              className="hidden rounded-full bg-gradient-to-r from-teal-400 to-teal-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 sm:inline-flex"
            >
              Open app
            </Link>
            <button
              type="button"
              aria-label="Toggle menu"
              className="inline-flex rounded-xl border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800/60 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-zinc-800/80 bg-[#050507]/95 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/70"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/"
                className="mt-2 rounded-xl border border-zinc-700 px-4 py-3 text-center text-sm font-medium text-zinc-200"
                onClick={() => setMenuOpen(false)}
              >
                Command center
              </Link>
            </div>
          </div>
        )}
      </header>

      <section id="hero" className="relative z-10 px-6 pb-24 pt-40 text-center">
        <div style={{ animation: "float 6s ease-in-out infinite" }}>
          <Reveal>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-teal-400">
              AI attention layer
            </p>
          </Reveal>

          <Reveal>
            <h1 className="text-6xl font-bold leading-tight tracking-tight md:text-7xl">
              Shape focus
              <br />
              <span
                className="bg-[length:200%_auto] bg-gradient-to-r from-teal-300 via-cyan-200 to-violet-400 bg-clip-text text-transparent"
                style={{ animation: "shimmer 4s linear infinite" }}
              >
                before the noise wins
              </span>
            </h1>
          </Reveal>

          <Reveal className="mt-6">
            <p className="mx-auto max-w-lg text-lg leading-relaxed text-zinc-400">
              NeuroFocus is your AI attention layer — cutting through distraction before it cuts through you.
            </p>
          </Reveal>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/"
              className="inline-block rounded-full bg-gradient-to-r from-teal-400 to-teal-500 px-8 py-3.5 font-semibold text-black transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_rgba(45,212,191,0.4)] active:scale-95"
            >
              Enter Command
            </Link>
            <a
              href="#features"
              className="inline-block rounded-full border border-zinc-700 px-8 py-3.5 font-medium text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:bg-zinc-900/50 hover:text-white"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-6">
          {statItems.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-3 text-center backdrop-blur-sm"
              style={{ animation: "pulseGlow 4s ease-in-out infinite" }}
            >
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mb-16 text-center">
          <h2 className="text-4xl font-bold">Built for deep work</h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-500">Three weapons. One mission.</p>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {featureItems.map((item) => (
            <div
              key={item.name}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7 transition-all duration-300 hover:-translate-y-2 hover:border-zinc-600 hover:bg-zinc-900/70 hover:shadow-2xl"
            >
              <div
                className={
                  "absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 " +
                  (item.accent === "teal"
                    ? "from-teal-500/5"
                    : item.accent === "violet"
                      ? "from-violet-500/5"
                      : "from-indigo-500/5")
                }
              />
              <div
                className={
                  "mb-4 h-8 w-8 rounded-lg " +
                  (item.accent === "teal"
                    ? "bg-teal-500/20 ring-1 ring-teal-500/30"
                    : item.accent === "violet"
                      ? "bg-violet-500/20 ring-1 ring-violet-500/30"
                      : "bg-indigo-500/20 ring-1 ring-indigo-500/30")
                }
              />
              <h3 className="mb-2 text-lg font-semibold text-white">{item.name}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="signals" className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="mb-4 text-4xl font-bold">
            Your brain has signals.
            <br />
            We read them.
          </h2>
          <p className="mx-auto max-w-md text-zinc-500">
            NeuroFocus learns your cognitive patterns and adapts in real time — protecting peak hours, surfacing insights,
            and keeping you in flow.
          </p>
        </Reveal>
      </section>

      <section id="cta" className="relative z-10 px-6 py-32 text-center">
        <Reveal>
          <h2 className="mb-6 text-5xl font-bold">Ready to focus?</h2>
          <p className="mx-auto mb-10 max-w-sm text-zinc-500">Join thousands who chose signal over noise.</p>
          <Link
            to="/"
            className="inline-block rounded-full bg-gradient-to-r from-teal-400 to-violet-500 px-10 py-4 text-lg font-bold text-black transition-all duration-200 hover:scale-105 hover:shadow-[0_0_50px_rgba(139,92,246,0.4)] active:scale-95"
          >
            Enter Command
          </Link>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-zinc-900 py-10 text-center text-sm text-zinc-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <span>
            © {new Date().getFullYear()} NeuroFocus. All rights reserved.
          </span>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/agent" className="transition hover:text-zinc-400">
              Agent
            </Link>
            <Link to="/flows" className="transition hover:text-zinc-400">
              Flows
            </Link>
            <Link to="/notifications" className="transition hover:text-zinc-400">
              Notifications
            </Link>
            <Link to="/neuro-command-layer" className="transition hover:text-zinc-400">
              NeuroCommand Layer
            </Link>
            <Link to="/analytics" className="transition hover:text-zinc-400">
              Analytics
            </Link>
            <a href="#features" className="transition hover:text-zinc-400">
              Top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
