// Server-only core: HMAC tokens, hashed credentials, rate limiting, cookies.
import { defaultAuthConfig, type AuthConfig, type SessionUser } from "./config";

const enc = new TextEncoder();

// Default demo identity (password "admin123"), overridable per app via env:
// ADMIN_USERNAME, ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_HASH (hex sha256 of `${salt}:${password}`).
const DEFAULT_CREDS = {
  username: "admin",
  salt: "sharedenv-salt",
  hash: "41580e02e52e39e012ce70006294115f86e6125b55002bf2607e5eb848c26434",
};

function getCreds() {
  return {
    username: process.env["ADMIN_USERNAME"] || DEFAULT_CREDS.username,
    salt: process.env["ADMIN_PASSWORD_SALT"] || DEFAULT_CREDS.salt,
    hash: process.env["ADMIN_PASSWORD_HASH"] || DEFAULT_CREDS.hash,
  };
}

function getSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return s;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function sha256Hex(input: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison: always walks full length.
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function hmac(data: string) {
  // Secret includes password hash so rotating either revokes all sessions.
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret() + getCreds().hash),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signToken(username: string, cfg: AuthConfig = defaultAuthConfig) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionUser = { username, iat: now, exp: now + cfg.sessionTtlSeconds };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionUser;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

export async function checkCredentials(username: string, password: string) {
  const c = getCreds();
  const hash = await sha256Hex(`${c.salt}:${password}`);
  const userOk = timingSafeEqual(username, c.username);
  const passOk = timingSafeEqual(hash, c.hash);
  return userOk && passOk;
}

// In-memory brute-force limiter (per server instance).
const attempts = new Map<string, { count: number; lockedUntil: number }>();
export function rateLimitStatus(ip: string, cfg: AuthConfig = defaultAuthConfig) {
  const e = attempts.get(ip);
  const now = Date.now();
  if (e && e.lockedUntil > now) return { locked: true, retryAfter: Math.ceil((e.lockedUntil - now) / 1000) };
  return { locked: false, retryAfter: 0, remaining: cfg.maxAttempts - (e?.count ?? 0) };
}
export function recordFailure(ip: string, cfg: AuthConfig = defaultAuthConfig) {
  const e = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  e.count += 1;
  if (e.count >= cfg.maxAttempts) {
    e.lockedUntil = Date.now() + cfg.lockoutSeconds * 1000;
    e.count = 0;
  }
  attempts.set(ip, e);
  return cfg.maxAttempts - e.count;
}
export const recordSuccess = (ip: string) => attempts.delete(ip);

export function getIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, remember: boolean, cfg: AuthConfig = defaultAuthConfig) {
  const maxAge = remember ? `; Max-Age=${cfg.sessionTtlSeconds}` : "";
  return `${cfg.cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax${maxAge}`;
}
export const clearCookie = (cfg: AuthConfig = defaultAuthConfig) =>
  `${cfg.cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

/** Reads session and applies sliding renewal. Returns user + optional refreshed cookie. */
export async function getSession(request: Request, cfg: AuthConfig = defaultAuthConfig) {
  const user = await verifyToken(readCookie(request, cfg.cookieName));
  if (!user) return { user: null, setCookie: undefined as string | undefined };
  const remaining = user.exp - Math.floor(Date.now() / 1000);
  let setCookie: string | undefined;
  if (remaining < cfg.sessionTtlSeconds / 2) setCookie = sessionCookie(await signToken(user.username, cfg), true, cfg);
  return { user, setCookie };
}

/** API route guard: returns a 401 Response, or the session user. */
export async function requireAdmin(request: Request, cfg: AuthConfig = defaultAuthConfig) {
  if (!cfg.enabled) return { user: { username: "anonymous", iat: 0, exp: 0 }, response: null };
  const { user, setCookie } = await getSession(request, cfg);
  if (!user) return { user: null, response: json({ error: "unauthorized", login: "/api/auth/login" }, 401) };
  return { user, response: null, setCookie };
}

export { json };
