// Password encoding shared by server, browser and CLI. Uses WebCrypto only.
//
// Encoded format (what you store in ADMIN_PASSWORD_HASH):
//   pbkdf2_sha256$<iterations>$<salt base64url>$<hash base64url>
//
// The plain password is never stored. At sign-in the library reads the algorithm,
// iterations and salt from the stored value, hashes the typed password the same way,
// and compares the two results in constant time.

export const DEFAULT_ITERATIONS = 100_000; // highest value Cloudflare Workers allow
const KEY_BYTES = 32;
const enc = new TextEncoder();

export const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8,
  );
  return toB64url(new Uint8Array(bits));
}

/** Encode a password for storage in ADMIN_PASSWORD_HASH. */
export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2_sha256$${iterations}$${toB64url(salt)}$${await pbkdf2(password, salt, iterations)}`;
}

export type HashInfo = { algorithm: string; iterations: number; valid: boolean };

/** Describe a stored value without revealing it. */
export function describeHash(encoded: string): HashInfo {
  const [algorithm = "unknown", it, salt, hash] = encoded.split("$");
  const iterations = Number(it);
  const valid = algorithm === "pbkdf2_sha256" && iterations > 0 && !!salt && !!hash;
  return { algorithm, iterations: valid ? iterations : 0, valid };
}

/** Hash `password` with the stored parameters and compare in constant time. */
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, it, salt, expected] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha256" || !salt || !expected) return false;
  const iterations = Math.min(Number(it) || 0, DEFAULT_ITERATIONS);
  if (iterations <= 0) return false;
  return timingSafeEqual(await pbkdf2(password, fromB64url(salt), iterations), expected);
}
