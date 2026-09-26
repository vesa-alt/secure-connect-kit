# Secure Connect Kit

Build a reusable auth library and interactive showcase based on the attached specification:

Option A: Reusable auth guard package with both server middleware and React client primitives:
1. Client components:
- Non-Intrusive Banner Overlay (<AuthBanner />): Floating sticky bar across viewport with inline username, password, and sign-in button for public read-only pages with protected actions.
- Full-Page Auth Guard Modal (<FullPageGuard />): Centered modal card intercepting protected routes with dimmed backdrop, error messages, and 'Remember Me'.
- useAuth() hook and AuthProvider to manage authentication state across components.
2. Server & Security:
- Stateless HMAC session tokens signed with SESSION_SECRET stored in secure, HttpOnly, SameSite cookies.
- Server-side route handlers / middleware (/api/auth/login, /api/auth/logout, /api/auth/session).
- Timing-attack safe password comparison and rate-limiting brute force protection.
3. Interactive playground & docs:
- Interactive live demo switching between Banner mode, Full-Page Guard mode, and API-only guard mode.
- Complete documentation tab explaining how to drop the library into any new project in two steps.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d93eb5d1-6149-404a-90a5-691d8dd616d5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
