import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import { google } from "googleapis";

const DATA_DIR = path.join(process.cwd(), ".data");
const TOKENS_PATH = path.join(DATA_DIR, "google-tokens.json");

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
];

function trimEnv(v) {
  if (v == null || typeof v !== "string") return "";
  let s = v.replace(/^\uFEFF/, "").trim().replace(/\r$/, "").replace(/\/+$/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const OAUTH_CALLBACK_PATH = "/api/google/oauth-callback";
const DEV_FALLBACK_ORIGIN = "http://localhost:5173";

function isLoopbackDevHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Best-effort browser origin for this request (Vite proxy, Origin, or Referer).
 * Fixes redirect_uri_mismatch when .env says localhost but the user opened 127.0.0.1 (or the reverse).
 */
export function getBrowserOriginFromRequest(req) {
  if (!req) return null;
  const xfHost = trimEnv(req.get("x-forwarded-host"));
  const xfProto = trimEnv(req.get("x-forwarded-proto")) || "http";
  if (xfHost) return `${xfProto}://${xfHost}`;

  const origin = trimEnv(req.get("origin"));
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      /* ignore */
    }
  }
  const ref = req.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Default redirect URI (env override, else localhost:5173). Used for oauth-debug and OAuth2Client when no per-request URI is needed.
 */
export function getRedirectUri() {
  const fromEnv = trimEnv(process.env.GOOGLE_REDIRECT_URI);
  if (fromEnv) return fromEnv;
  return `${DEV_FALLBACK_ORIGIN}${OAUTH_CALLBACK_PATH}`;
}

/**
 * redirect_uri for authorize + token exchange. Aligns with the browser origin when possible.
 */
export function getRedirectUriForRequest(req) {
  const fromEnv = trimEnv(process.env.GOOGLE_REDIRECT_URI);
  const requestOrigin = req ? getBrowserOriginFromRequest(req) : null;

  if (fromEnv && requestOrigin) {
    try {
      const envUrl = new URL(fromEnv);
      const reqUrl = new URL(requestOrigin);
      if (
        isLoopbackDevHost(envUrl.hostname) &&
        isLoopbackDevHost(reqUrl.hostname) &&
        envUrl.hostname !== reqUrl.hostname
      ) {
        return `${requestOrigin.replace(/\/+$/, "")}${OAUTH_CALLBACK_PATH}`;
      }
    } catch {
      /* ignore */
    }
  }

  if (fromEnv) return fromEnv;
  if (requestOrigin) return `${requestOrigin.replace(/\/+$/, "")}${OAUTH_CALLBACK_PATH}`;
  return getRedirectUri();
}

/** True when redirect URI is fixed by server/.env (not derived from the browser host). */
export function isGoogleRedirectUriLockedByEnv() {
  return Boolean(trimEnv(process.env.GOOGLE_REDIRECT_URI));
}

/** Post-login browser origin (matches Vite when FRONTEND_URL is unset). */
export function getFrontendOriginForRequest(req) {
  const fromEnv = trimEnv(process.env.FRONTEND_URL);
  const requestOrigin = req ? getBrowserOriginFromRequest(req) : null;

  if (fromEnv && requestOrigin) {
    try {
      const e = new URL(fromEnv);
      const r = new URL(requestOrigin);
      if (
        isLoopbackDevHost(e.hostname) &&
        isLoopbackDevHost(r.hostname) &&
        e.hostname !== r.hostname
      ) {
        return requestOrigin.replace(/\/+$/, "");
      }
    } catch {
      /* ignore */
    }
  }

  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (requestOrigin) return requestOrigin.replace(/\/+$/, "");
  return DEV_FALLBACK_ORIGIN;
}

export function getGoogleClientId() {
  return trimEnv(process.env.GOOGLE_CLIENT_ID);
}

export function getGoogleClientSecret() {
  return trimEnv(process.env.GOOGLE_CLIENT_SECRET);
}

export function googleOAuthConfigured() {
  return Boolean(getGoogleClientId()) && Boolean(getGoogleClientSecret());
}

export function createOAuthClient(redirectUri) {
  const uri = redirectUri ?? getRedirectUri();
  return new OAuth2Client(getGoogleClientId(), getGoogleClientSecret(), uri);
}

export function loadTokens() {
  try {
    if (!fs.existsSync(TOKENS_PATH)) return null;
    return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function saveTokens(tokens) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");
}

export function clearTokens() {
  if (fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
}

/**
 * google-auth-library treats missing expiry_date as "not expiring" and may reuse a stale access_token.
 * Force a refresh by dropping the access token when we still have a refresh token.
 */
function normalizeLoadedTokens(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const tokens = { ...raw };
  if (tokens.refresh_token && tokens.access_token && tokens.expiry_date == null) {
    delete tokens.access_token;
    delete tokens.expires_in;
  }
  return tokens;
}

export async function getOAuthClientWithRefresh() {
  const raw = loadTokens();
  if (!raw) return null;
  const stripStaleAccess =
    Boolean(raw.refresh_token && raw.access_token && raw.expiry_date == null);
  const tokens = normalizeLoadedTokens(raw);
  if (stripStaleAccess) saveTokens(tokens);
  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (t) => {
    const merged = { ...normalizeLoadedTokens(loadTokens()), ...t };
    saveTokens(merged);
  });
  try {
    const { token } = await client.getAccessToken();
    if (!token) return null;
  } catch {
    return null;
  }
  return client;
}

export async function getEmailFromClient(client) {
  const oauth2 = google.oauth2({ version: "v2" });
  const { data } = await oauth2.userinfo.get({ auth: client });
  return data.email || null;
}

export async function getConnectedEmail() {
  try {
    const c = await getOAuthClientWithRefresh();
    if (!c) return null;
    return await getEmailFromClient(c);
  } catch (e) {
    console.warn("[google] getConnectedEmail:", e?.message || e);
    return null;
  }
}

export async function verifyAllowedEmail(client) {
  const allowed = process.env.GOOGLE_ALLOWED_EMAIL?.trim();
  if (!allowed) return;
  const email = await getEmailFromClient(client);
  if (!email || email.toLowerCase() !== allowed.toLowerCase()) {
    clearTokens();
    throw new Error(`Use Google account ${allowed}`);
  }
}
