import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#signals", label: "Signals" },
  { href: "#cta", label: "Get started" },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
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
      {/* Ambient layers */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[min(120vw,900px)] -translate-x-1/2 rounded-full bg-gradient-to-b from-teal-500/20 via-violet-600/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-[-20%] h-[400px] w-[500px] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23ffffff%22%20stroke-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M0%20.5h40M.5%2040V0%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-80" />
      </div>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "border-b border-zinc-800/80 bg-[#050507]/85 backdrop-blur-xl shadow-lg shadow-black/20" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/landing" className="flex items-center gap-3 group shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-700/80 bg-gradient-to-br from-teal-400/25 to-cyan-500/10 transition group-hover:border-teal-400/40">
              <span className="font-display text-sm font-semibold text-teal-300">N</span>
            </div>
            <div className="leading-tight">
              <span className="font-display block text-base font-semibold text-white">NeuroFocus</span>
              <span className="hidden text-[11px] text-zinc-500 sm:block">Attention OS</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="hidden sm:inline-flex rounded-full border border-zinc-700/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/40"
            >
              Command
            </Link>
            <Link
              to="/"
              className="inline-flex rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Open app
            </Link>
            <button
              type="button"
              aria-label="Toggle menu"
              className="inline-flex md:hidden rounded-xl border border-zinc-700/80 p-2 text-zinc-300 hover:bg-zinc-800/60"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">Menu</span>
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
          <div className="md:hidden border-t border-zinc-800/80 bg-[#050507]/95 backdrop-blur-xl px-4 py-4">
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

      <main className="relative pt-24 sm:pt-28">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-teal-300/90">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
            Context-aware attention layer
          </div>
          <h1 className="mt-8 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Shape focus
            <br />
            <span className="bg-gradient-to-r from-teal-300 via-cyan-200 to-violet-400 bg-clip-text text-transparent">
              before the noise wins
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Tab signals, Deep Focus, and notification DNA — NeuroFocus is the brain-aware layer that sits between you and the
            chaotic web.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:shadow-teal-500/35"
            >
              Enter Command
              <svg
                className="h-4 w-4 transition group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-600/80 bg-zinc-900/40 px-6 py-3.5 text-sm font-medium text-zinc-200 backdrop-blur transition hover:border-zinc-500 hover:bg-zinc-800/50"
            >
              Explore
            </a>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "Modes", v: "Deep Focus" },
              { k: "Signals", v: "Tab + context" },
              { k: "Agent", v: "Natural language" },
              { k: "Analytics", v: "Attention arcs" },
            ].map((stat) => (
              <div
                key={stat.k}
                className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 transition hover:border-teal-500/30 hover:bg-zinc-900/50"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{stat.k}</p>
                <p className="mt-1 font-display text-sm font-semibold text-white">{stat.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-28 border-t border-zinc-800/60 bg-zinc-950/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Built for flow state</h2>
            <p className="mt-3 max-w-xl text-zinc-500">Interactive surfaces you already use — elevated with intent.</p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Command bar",
                  desc: "Voice and text commands that interpret what you mean, not just what you type.",
                  accent: "from-violet-500/20 to-fuchsia-500/10",
                },
                {
                  title: "Flows",
                  desc: "Chain context across tabs and tasks without losing the thread.",
                  accent: "from-teal-500/20 to-cyan-500/10",
                },
                {
                  title: "Notification DNA",
                  desc: "Surface patterns in pings so you can mute with precision, not guesswork.",
                  accent: "from-amber-500/15 to-rose-500/10",
                },
              ].map((card, i) => (
                <article
                  key={card.title}
                  className="group relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 transition duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/40"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${card.accent} blur-2xl opacity-60 transition group-hover:opacity-100`}
                  />
                  <h3 className="relative font-display text-lg font-semibold text-white">{card.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-zinc-400">{card.desc}</p>
                  <div className="relative mt-4 flex items-center gap-2 text-xs font-medium text-teal-400/90 opacity-0 transition group-hover:opacity-100">
                    <span>Learn in app</span>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Signals */}
        <section id="signals" className="scroll-mt-28 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Signals, not noise</h2>
                <p className="mt-4 text-zinc-400 leading-relaxed">
                  Every tab tells a story. NeuroFocus aggregates lightweight signals so your dashboard reflects reality —
                  not an idealized checklist.
                </p>
                <ul className="mt-8 space-y-4">
                  {["Active context from the browser extension", "Server API for commands and state", "Charts that respect your attention arcs"].map(
                    (line) => (
                      <li key={line} className="flex gap-3 text-sm text-zinc-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                        {line}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div className="relative rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 sm:p-8">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-500/5 via-transparent to-violet-500/10" />
                <div className="relative space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                      <div key={d + idx} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-teal-600/80 to-teal-400/40 transition hover:from-violet-500/80 hover:to-violet-400/40"
                          style={{ height: `${24 + ((idx * 7) % 5) * 12}px` }}
                        />
                        <span className="text-[10px] text-zinc-500">{d}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-xs text-zinc-500">Illustrative rhythm — open Analytics for live data.</p>
                  <Link
                    to="/analytics"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/80 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800/50"
                  >
                    View analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="scroll-mt-28 border-t border-zinc-800/60 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Ready when you are</h2>
            <p className="mx-auto mt-4 max-w-lg text-zinc-400">
              Jump into Command, try a natural-language prompt, and let the layer adapt.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                to="/"
                className="inline-flex rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Launch NeuroFocus
              </Link>
              <Link
                to="/agent"
                className="inline-flex rounded-full border border-zinc-600 px-8 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/50"
              >
                Open Agent
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-zinc-800/60 bg-[#030304]/90 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80">
              <span className="font-display text-xs font-semibold text-teal-400">N</span>
            </div>
            <span className="text-sm text-zinc-500">© {new Date().getFullYear()} NeuroFocus</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
            <Link to="/flows" className="transition hover:text-zinc-300">
              Flows
            </Link>
            <Link to="/notifications" className="transition hover:text-zinc-300">
              Notifications
            </Link>
            <a href="#features" className="transition hover:text-zinc-300">
              Top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
