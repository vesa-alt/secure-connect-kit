import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthProvider, FullPageGuard } from "@/lib/auth/client";
import { AdminPanel } from "@/lib/auth/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — SharedEnv Auth" },
      { name: "description", content: "Signed-in admin view of the active login configuration." },
      { property: "og:title", content: "Admin — SharedEnv Auth" },
      { property: "og:description", content: "Signed-in admin view of the active login configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[960px] px-6 pt-6">
          <Link to="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">← Playground</Link>
        </div>
        <FullPageGuard>
          <AdminPanel />
        </FullPageGuard>
      </div>
    </AuthProvider>
  );
}
