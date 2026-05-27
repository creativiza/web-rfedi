import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { InviteForm } from "./InviteForm";
import { UserList } from "./UserList";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { comments: true } },
    },
  });

  return (
    <section className="max-w-4xl mx-auto w-full px-6 py-12">
      <div className="t-overline mb-4">— Admin · Usuarios</div>
      <h1 className="t-h1 mb-3">
        Da acceso a tu <span className="accent-word">equipo</span>.
      </h1>
      <p className="t-lead mb-10 max-w-2xl">
        Crea la cuenta y la app te devuelve un <strong>enlace de un solo uso</strong>{" "}
        (válido 24h). Lo copias y lo envías por el canal que prefieras —
        WhatsApp, email, lo que sea. Sin signups públicos.
      </p>

      <div className="bg-bg rounded-2xl border border-border-card shadow-md p-6 sm:p-8 mb-10">
        <h2 className="t-h3 mb-4">Nuevo usuario</h2>
        <InviteForm />
      </div>

      <div className="bg-bg rounded-2xl border border-border-card shadow-md">
        <div className="px-6 py-4 border-b border-border-card flex items-center justify-between">
          <h2 className="t-h3">Usuarios</h2>
          <span className="text-xs text-fg-subtle font-mono uppercase tracking-widest">
            {users.length} total
          </span>
        </div>
        <UserList
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            commentCount: u._count.comments,
            createdAt: u.createdAt.toISOString(),
          }))}
          currentUserId={session!.user.id}
        />
      </div>
    </section>
  );
}
