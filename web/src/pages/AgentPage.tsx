import { useCallback, useEffect, useState } from "react";
import { EmailAutomationPanel } from "../components/EmailAutomationPanel";
import { MeetingSchedulerPanel } from "../components/MeetingSchedulerPanel";
import { api } from "../lib/api";

type OauthHelp = "test_users" | "invalid_client" | "redirect_mismatch" | null;

export function AgentPage() {
  const [google, setGoogle] = useState<{
    configured: boolean;
    connected: boolean;
    email: string | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [oauthHelp, setOauthHelp] = useState<OauthHelp>(null);

  const loadGoogle = useCallback(() => {
    api
      .googleStatus()
      .then((s) => setGoogle(s))
      .catch(() => setGoogle({ configured: false, connected: false, email: null }));
  }, []);

  useEffect(() => {
    loadGoogle();
  }, [loadGoogle]);

  useEffect(() => {
    const u = new URL(window.location.href);
    const g = u.searchParams.get("google");
    const oauthErr = u.searchParams.get("google_oauth_error");
    const oauthDesc = u.searchParams.get("google_oauth_desc");

    const cleanParams = () => {
      u.searchParams.delete("google");
      u.searchParams.delete("google_oauth_error");
      u.searchParams.delete("google_oauth_desc");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    };

    if (oauthErr === "access_denied" || g === "denied") {
      setOauthHelp("test_users");
      setErr(null);
      cleanParams();
      return;
    }

    if (oauthErr === "invalid_client") {
      setOauthHelp("invalid_client");
      setErr(oauthDesc ? decodeURIComponent(oauthDesc) : null);
      cleanParams();
      return;
    }

    if (oauthErr === "redirect_uri_mismatch") {
      setOauthHelp("redirect_mismatch");
      setErr(oauthDesc ? decodeURIComponent(oauthDesc) : null);
      cleanParams();
      return;
    }

    if (oauthErr) {
      setOauthHelp(null);
      setErr(
        `${decodeURIComponent(oauthErr)}${oauthDesc ? ` — ${decodeURIComponent(oauthDesc)}` : ""}`
      );
      cleanParams();
      return;
    }

    if (g === "connected") {
      setOauthHelp(null);
      loadGoogle();
      u.searchParams.delete("google");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    } else if (g && g !== "badstate") {
      const decoded = decodeURIComponent(g);
      if (decoded === "invalid_client" || decoded.toLowerCase().includes("invalid_client")) {
        setOauthHelp("invalid_client");
        setErr(null);
      } else if (
        decoded === "redirect_uri_mismatch" ||
        decoded.toLowerCase().includes("redirect_uri")
      ) {
        setOauthHelp("redirect_mismatch");
        setErr(null);
      } else {
        setOauthHelp(null);
        setErr(`Google: ${decoded}`);
      }
      u.searchParams.delete("google");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    } else if (g === "badstate") {
      setOauthHelp(null);
      setErr("OAuth state expired — try Connect Google again.");
      u.searchParams.delete("google");
      window.history.replaceState({}, "", `${u.pathname}${u.search}`);
    }
  }, [loadGoogle]);

  function connectGoogle() {
    window.location.href = "/api/google/auth";
  }

  async function disconnectGoogle() {
    try {
      await api.googleDisconnect();
      loadGoogle();
    } catch {
      setErr("Could not disconnect Google.");
    }
  }

  return (
    <div className="space-y-10 pb-8">
      <header>
        <h2 className="page-title">Agent</h2>
        <p className="page-sub">
          Email automation: read Gmail, extract tasks with AI, preview replies with confidence, then approve — human-in-the-loop
          with fail-safe on low confidence.
        </p>
      </header>

      <section className="surface p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-white">Google account</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-xl">
              Required for Gmail. Callback path is always{" "}
              <code className="text-zinc-400">/api/google/oauth-callback</code> on your dev origin (e.g.{" "}
              <code className="text-zinc-400">http://localhost:5173</code> or{" "}
              <code className="text-zinc-400">http://127.0.0.1:5173</code>). Register that full URL in Google Cloud.{" "}
              If the app is in <strong className="text-zinc-400">Testing</strong>, add your Gmail under OAuth consent screen →{" "}
              <strong className="text-zinc-400">Test users</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {google?.configured && google.connected ? (
              <>
                <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-1.5 text-xs text-teal-200">
                  {google.email ?? "Connected"}
                </span>
                <button
                  type="button"
                  onClick={disconnectGoogle}
                  className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={connectGoogle}
                disabled={google?.configured === false}
                className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-40"
              >
                Connect Google
              </button>
            )}
          </div>
        </div>
        {google?.configured === false && (
          <p className="text-xs text-amber-200/90">
            Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the API server .env
          </p>
        )}
        {google?.configured && (
          <p className="text-xs text-zinc-500">
            Seeing{" "}
            <span className="text-zinc-400">redirect_uri_mismatch</span>? Open{" "}
            <a href="/api/google/oauth-debug" target="_blank" rel="noreferrer" className="text-teal-400 underline">
              OAuth debug
            </a>{" "}
            and add <strong>every</strong> <code className="text-zinc-400">redirectUri</code> listed there to the{" "}
            <strong>same</strong> OAuth client (Client ID in server/.env).
          </p>
        )}
      </section>

      {oauthHelp === "redirect_mismatch" && (
        <div className="rounded-2xl border border-orange-500/45 bg-orange-950/30 px-5 py-4 space-y-3 text-sm text-orange-100/95">
          <p className="font-display font-semibold text-orange-50">Fix redirect_uri_mismatch (400)</p>
          <p className="text-orange-100/85 leading-relaxed">
            Google only allows the exact <code className="text-orange-200/90">redirect_uri</code> that is listed under your{" "}
            <strong>OAuth 2.0 Web client</strong> (same Client ID as <code className="text-orange-200/90">server/.env</code>
            ).
          </p>
          <ol className="list-decimal list-inside space-y-2 text-orange-100/85 leading-relaxed">
            <li>
              Open{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-teal-300 underline"
              >
                Google Cloud → APIs &amp; Services → Credentials
              </a>{" "}
              → your OAuth client → <strong>Authorized redirect URIs</strong>.
            </li>
            <li>
              Add <strong>both</strong> (dev uses the same host as your address bar):
              <ul className="list-disc list-inside mt-1 ml-3 text-orange-100/80">
                <li>
                  <code className="text-orange-200/90">http://localhost:5173/api/google/oauth-callback</code>
                </li>
                <li>
                  <code className="text-orange-200/90">http://127.0.0.1:5173/api/google/oauth-callback</code>
                </li>
              </ul>
            </li>
            <li>
              Under <strong>Authorized JavaScript origins</strong>, add{" "}
              <code className="text-orange-200/90">http://localhost:5173</code> and{" "}
              <code className="text-orange-200/90">http://127.0.0.1:5173</code>.
            </li>
            <li>Save, wait a minute, then try <strong>Connect Google</strong> again from the same host you added.</li>
          </ol>
          <p className="text-xs text-orange-200/75">
            Open <a href="/api/google/oauth-debug" className="text-teal-300 underline">OAuth debug</a> for the full URI list.
          </p>
          {err && (
            <p className="text-xs text-orange-200/80 border-t border-orange-500/25 pt-3 mt-1">Google: {err}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setOauthHelp(null);
              setErr(null);
            }}
            className="text-xs text-orange-200/80 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {oauthHelp === "invalid_client" && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/30 px-5 py-4 space-y-3 text-sm text-rose-100/95">
          <p className="font-display font-semibold text-rose-50">Fix invalid_client (OAuth credentials)</p>
          <p className="text-rose-100/85 leading-relaxed">
            <code className="text-rose-200/90">invalid_client</code> is returned by Google when the{" "}
            <strong>Client ID</strong> and <strong>Client secret</strong> you send do not match any enabled OAuth client (or
            the secret is wrong).
          </p>
          <ol className="list-decimal list-inside space-y-2 text-rose-100/85 leading-relaxed">
            <li>
              Open{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-teal-300 underline"
              >
                Google Cloud → APIs &amp; Services → Credentials
              </a>
              .
            </li>
            <li>
              Under <strong>OAuth 2.0 Client IDs</strong>, open your client (or create <strong>Web application</strong>).
            </li>
            <li>
              Copy <strong>Client ID</strong> and <strong>Client secret</strong> from that <em>same</em> row — do not mix ID
              from one client and secret from another.
            </li>
            <li>
              Put them in <code className="text-rose-200/90">server/.env</code> as <code className="text-rose-200/90">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-rose-200/90">GOOGLE_CLIENT_SECRET</code> with no extra quotes or spaces. Restart the API
              server.
            </li>
            <li>
              If unsure, click <strong>Reset secret</strong> in the console, update <code className="text-rose-200/90">.env</code>, and try again.
            </li>
          </ol>
          <p className="text-xs text-rose-200/70">
            Open <a href="/api/google/oauth-debug" className="text-teal-300 underline">OAuth debug</a> —{" "}
            <code className="text-rose-200/80">clientIdLooksLikeOAuthWebClient</code> should be true and you should have a
            non‑zero <code className="text-rose-200/80">clientSecretCharCount</code>.
          </p>
          {err && (
            <p className="text-xs text-rose-200/80 border-t border-rose-500/25 pt-3 mt-1">Google: {err}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setOauthHelp(null);
              setErr(null);
            }}
            className="text-xs text-rose-200/80 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {oauthHelp === "test_users" && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/35 px-5 py-4 space-y-3 text-sm text-amber-100/95">
          <p className="font-display font-semibold text-amber-50">Google blocked sign-in (403 / app not verified)</p>
          <p className="text-amber-100/85 leading-relaxed">
            Your OAuth app is in <strong>Testing</strong>. Only accounts listed as <strong>Test users</strong> can sign in until
            the app is published and verified.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-amber-100/85 leading-relaxed">
            <li>
              Open{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials/consent"
                target="_blank"
                rel="noreferrer"
                className="text-teal-300 underline"
              >
                Google Cloud → OAuth consent screen
              </a>{" "}
              (same project as your Client ID).
            </li>
            <li>
              Scroll to <strong>Test users</strong> → <strong>Add users</strong>.
            </li>
            <li>
              Add the <strong>exact</strong> Gmail you use when clicking “Connect Google” (e.g. the one Google showed on the error
              page).
            </li>
            <li>Save, wait a few seconds, then try <strong>Connect Google</strong> again.</li>
          </ol>
          <button
            type="button"
            onClick={() => setOauthHelp(null)}
            className="text-xs text-amber-200/80 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {err && oauthHelp !== "invalid_client" && oauthHelp !== "redirect_mismatch" && (
        <p className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200/90">{err}</p>
      )}

      <MeetingSchedulerPanel googleConnected={Boolean(google?.configured && google?.connected)} />

      <EmailAutomationPanel />
    </div>
  );
}
