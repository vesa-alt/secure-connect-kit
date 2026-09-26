// Shared, client-safe configuration for the auth library.
export type AuthConfig = {
  enabled: boolean;
  cookieName: string;
  sessionTtlSeconds: number;
  maxAttempts: number;
  lockoutSeconds: number;
};

export const defaultAuthConfig: AuthConfig = {
  enabled: true,
  cookieName: "sharedenv_session",
  sessionTtlSeconds: 60 * 60 * 24, // 24h, sliding
  maxAttempts: 5,
  lockoutSeconds: 15 * 60,
};

export type SessionUser = { username: string; iat: number; exp: number };
