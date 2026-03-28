import { useEffect, useState } from "react";
import { api } from "../lib/api";

type FlowStep = {
  id: string;
  condition: string;
  action: string;
  detail: string;
};

type FlowMail = {
  id: string;
  name: string;
  enabled: boolean;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  preview?: string;
  greeting?: string;
  bodyIntro?: string;
  steps: FlowStep[];
  closing?: string;
  tag?: string;
};

function renderIntro(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-zinc-900 font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function FlowsPage() {
  const [flows, setFlows] = useState<FlowMail[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .flows()
      .then((r) => {
        setFlows(r.flows as FlowMail[]);
        setErr(null);
      })
      .catch(() => setErr("Start the server to load flows."));
  }, []);

  return (
    <div className="flex flex-col gap-8 min-h-0 pb-4">
      <header className="shrink-0">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">NeuroFlows</h2>
        <p className="text-zinc-400 mt-2 max-w-2xl text-sm sm:text-base leading-relaxed">
          Automations arrive like messages — read the full playbook: when something happens, what we do, and why it matters.
        </p>
      </header>
      {err && <p className="text-sm text-red-300/90 shrink-0">{err}</p>}

      <div className="flex flex-col gap-6 max-w-4xl w-full">
        {flows.map((f) => (
          <article
            key={f.id}
            className={`rounded-xl border overflow-hidden shadow-lg shadow-black/20 ${
              f.enabled ? "border-zinc-600 ring-1 ring-cyan-500/15" : "border-zinc-800 opacity-75"
            }`}
          >
            {/* Email chrome */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                    f.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {f.tag ?? (f.enabled ? "Active" : "Off")}
                </span>
                <span className="text-xs text-zinc-500 font-mono truncate max-w-[50%]">{f.date}</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-white leading-snug pr-4">{f.subject ?? f.name}</h3>
              <div className="mt-3 space-y-1 text-xs sm:text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500 w-12 inline-block">From</span>
                  <span className="text-zinc-200 font-mono text-[11px] sm:text-xs break-all">{f.from ?? "NeuroFocus"}</span>
                </p>
                <p>
                  <span className="text-zinc-500 w-12 inline-block">To</span>
                  <span className="text-zinc-300">{f.to ?? "You"}</span>
                </p>
                {f.preview && (
                  <p className="text-zinc-500 mt-2 italic border-l-2 border-zinc-700 pl-3 leading-relaxed">{f.preview}</p>
                )}
              </div>
            </div>

            {/* Message body — paper */}
            <div className="bg-[#ececef] text-zinc-900 px-5 py-6 sm:px-8 sm:py-8 font-serif text-[15px] leading-[1.65]">
              <p className="text-zinc-800">{f.greeting ?? "Hi,"}</p>
              {f.bodyIntro && <p className="mt-4 text-zinc-800">{renderIntro(f.bodyIntro)}</p>}

              <div className="mt-8 space-y-8">
                {f.steps.map((s, i) => (
                  <div
                    key={s.id}
                    className="border-l-[3px] border-cyan-600/70 pl-4 sm:pl-5 -ml-px"
                  >
                    <p className="text-xs font-sans font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Step {i + 1}
                    </p>
                    <p className="font-sans text-sm font-semibold text-zinc-900">
                      When <span className="text-cyan-800">{s.condition}</span>
                    </p>
                    <p className="font-sans text-sm text-zinc-800 mt-1">
                      then <span className="font-medium text-zinc-900">{s.action}</span>
                    </p>
                    <p className="mt-3 text-zinc-700 text-[14px] leading-relaxed">{s.detail ?? `${s.action}.`}</p>
                  </div>
                ))}
              </div>

              {f.closing && (
                <p className="mt-10 text-sm text-zinc-600 border-t border-zinc-300/80 pt-6 leading-relaxed">{f.closing}</p>
              )}

              <p className="mt-8 text-xs text-zinc-500 font-sans">
                — NeuroFocus · Flow ID: <span className="font-mono">{f.id}</span> · {f.name}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
