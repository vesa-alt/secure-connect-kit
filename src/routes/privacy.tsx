import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — SharedEnv Auth" },
      { name: "description", content: "What this demo app stores and why: one session cookie, no tracking, no analytics, no personal data collection." },
      { property: "og:title", content: "Privacy Notice — SharedEnv Auth" },
      { property: "og:description", content: "One session cookie, no tracking, no analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">@sharedenv/login</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Privacy notice</h1>
          </div>
          <Link to="/" className="rounded-md border border-border px-4 py-1.5 font-mono text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <p className="text-sm text-muted-foreground">
          Last updated: October 2026. This notice explains what this demonstration app
          ("the app") does with data when you visit or sign in.
        </p>

        <Section title="What the app does">
          <p>
            The app is a live playground for a reusable sign-in library. It lets you try
            three protection modes (banner, full-page guard, API-only) with a single demo
            account, and view the active configuration on the Admin page after signing in.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            <strong className="text-foreground">Session cookie.</strong> When you sign in,
            the app sets one cookie containing a signed session token (your username and an
            expiry time, protected against tampering). It is <code className="font-mono text-primary">HttpOnly</code> and{" "}
            <code className="font-mono text-primary">SameSite</code>, so other sites and scripts cannot read it.
            It expires automatically (default: 24 hours of inactivity) or when you sign out.
          </p>
          <p>
            <strong className="text-foreground">Failed sign-in counter.</strong> To block
            brute-force attacks, the server keeps a temporary in-memory count of failed
            attempts per network address. It is never written to disk and disappears when
            the server restarts or the lockout window (15 minutes) passes.
          </p>
          <p>
            <strong className="text-foreground">Server logs.</strong> Like any website, the
            hosting platform may keep standard technical logs (IP address, browser type,
            pages requested) for security and troubleshooting.
          </p>
        </Section>

        <Section title="What we do not do">
          <ul className="list-disc space-y-1 pl-5">
            <li>No analytics, tracking pixels, or advertising.</li>
            <li>No third-party cookies.</li>
            <li>No sale or sharing of data with anyone.</li>
            <li>No user accounts database — the only credential is the demo login configured by the site operator.</li>
            <li>Your password is never stored in plain text; only an encoded (hashed) form exists in the server configuration.</li>
          </ul>
        </Section>

        <Section title="Legal basis and your rights (GDPR)">
          <p>
            The session cookie is strictly necessary to provide the sign-in feature you
            request, so it does not require consent under the ePrivacy rules. Any
            processing of technical data (such as the failed-attempt counter and server
            logs) is based on the legitimate interest of keeping the service secure.
          </p>
          <p>
            Because the app does not collect personal data beyond the demo session, there
            is generally nothing to access, correct, or delete — your session cookie
            expires on its own and can be removed at any time by signing out or clearing
            your browser cookies. If you have questions or want to exercise your rights
            (access, erasure, objection), contact the site operator.
          </p>
        </Section>

        <Section title="Using this library in your own project">
          <p>
            If you install the library in your own app, the same principles apply: one
            necessary session cookie, no tracking, passwords stored only as hashes. You are
            then the data controller for your own deployment and should adapt this notice
            to your app (your contact details, your hosting provider, any additional
            features you add).
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this notice? Reach the site operator via the repository or the
            contact channel listed on the project page.
          </p>
        </Section>
      </main>
    </div>
  );
}
