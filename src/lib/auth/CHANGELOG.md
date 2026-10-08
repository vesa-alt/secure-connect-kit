# Changelog

## 1.0.0
- Username + PBKDF2-SHA256 encoded password login, HMAC-signed HttpOnly session cookie.
- React client: AuthProvider, useAuth, AuthBanner, FullPageGuard, LoginCard, AdminPanel, HashTool.
- Server: createAuthHandler, requireAuth/requireAdmin, getSession; Vite plugin; Node/Express adapter.
- Brute-force lockout, sliding sessions, cross-site POST protection, config validation, production warnings.
