import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useArchitectureStream } from "../hooks/useArchitectureStream";
import { SystemArchitectureDiagram } from "../components/flows/SystemArchitectureDiagram";

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
      <strong key={i} className="font-semibold text-zinc-900">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function FlowsPage() {
  const { data: arch, err: archErr, connected } = useArchitectureStream();
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
    <div className="flex min-h-0 flex-col gap-8 pb-4">
      <header className="shrink-0">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">NeuroFlows</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Live system architecture shows how data moves from the extension through the API into NeuroScore, Notification DNA,
          and the agent. Automations below are written like playbooks — conditions, actions, and why they matter.
        </p>
      </header>

      {(archErr || err) && (
        <div className="shrink-0 space-y-1 text-sm text-amber-200/90">
          {archErr && <p>{archErr}</p>}
          {err && <p>{err}</p>}
        </div>
      )}

      <section className="surface shrink-0 rounded-2xl border border-zinc-800/80 p-4 sm:p-6">
        <h3 className="font-display mb-1 text-lg font-semibold text-white">Live architecture</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Each block shows a <span className="text-zinc-400">frame</span> timestamp from the server tick (synced every 2s) plus
          section-specific clocks (e.g. last browser ingest, Gmail sync).
        </p>
        <SystemArchitectureDiagram data={arch} connected={connected} />
      </section>

      <div className="flex w-full max-w-4xl flex-col gap-6">
        <h3 className="font-display text-base font-semibold text-zinc-300">Automation playbooks</h3>
        {flows.map((f) => (
          <article
            key={f.id}
            className={`overflow-hidden rounded-xl border shadow-lg shadow-black/20 ${
              f.enabled ? "border-zinc-600 ring-1 ring-cyan-500/15" : "border-zinc-800 opacity-75"
            }`}
          >
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    f.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {f.tag ?? (f.enabled ? "Active" : "Off")}
                </span>
                <span className="max-w-[50%] truncate font-mono text-xs text-zinc-500">{f.date}</span>
              </div>
              <h3 className="font-display pr-4 text-base font-semibold leading-snug text-white sm:text-lg">
                {f.subject ?? f.name}
              </h3>
              <div className="mt-3 space-y-1 text-xs text-zinc-400 sm:text-sm">
                <p>
                  <span className="inline-block w-12 text-zinc-500">From</span>
                  <span className="break-all font-mono text-[11px] text-zinc-200 sm:text-xs">{f.from ?? "NeuroFocus"}</span>
                </p>
                <p>
                  <span className="inline-block w-12 text-zinc-500">To</span>
                  <span className="text-zinc-300">{f.to ?? "You"}</span>
                </p>
                {f.preview && (
                  <p className="mt-2 border-l-2 border-zinc-700 pl-3 italic leading-relaxed text-zinc-500">{f.preview}</p>
                )}
              </div>
            </div>

            <div className="bg-[#ececef] px-5 py-6 font-serif text-[15px] leading-[1.65] text-zinc-900 sm:px-8 sm:py-8">
              <p className="text-zinc-800">{f.greeting ?? "Hi,"}</p>
              {f.bodyIntro && <p className="mt-4 text-zinc-800">{renderIntro(f.bodyIntro)}</p>}

              <div className="mt-8 space-y-8">
                {f.steps.map((s, i) => (
                  <div key={s.id} className="-ml-px border-l-[3px] border-cyan-600/70 pl-4 sm:pl-5">
                    <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      Step {i + 1}
                    </p>
                    <p className="font-sans text-sm font-semibold text-zinc-900">
                      When <span className="text-cyan-800">{s.condition}</span>
                    </p>
                    <p className="mt-1 font-sans text-sm text-zinc-800">
                      then <span className="font-medium text-zinc-900">{s.action}</span>
                    </p>
                    <p className="mt-3 text-[14px] leading-relaxed text-zinc-700">{s.detail ?? `${s.action}.`}</p>
                  </div>
                ))}
              </div>

              {f.closing && (
                <p className="mt-10 border-t border-zinc-300/80 pt-6 text-sm leading-relaxed text-zinc-600">{f.closing}</p>
              )}

              <p className="mt-8 font-sans text-xs text-zinc-500">
                — NeuroFocus · Flow ID: <span className="font-mono">{f.id}</span> · {f.name}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
