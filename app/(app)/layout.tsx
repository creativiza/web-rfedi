import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col bg-bg-muted">
      <AppHeader
        user={{
          email: session.user.email ?? "",
          name: session.user.name ?? null,
          role: session.user.role,
        }}
      />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
