import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DeliverableCard } from "@/components/DeliverableCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const deliverables = await prisma.deliverable.findMany({
    where: isAdmin
      ? { status: { not: "ARCHIVED" } }
      : { status: "PUBLISHED" },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          comments: {
            where: { status: "OPEN" },
          },
        },
      },
    },
  });

  const total = deliverables.length;
  const openComments = deliverables.reduce(
    (sum, d) => sum + d._count.comments,
    0,
  );

  return (
    <section className="max-w-7xl mx-auto w-full px-6 py-12">
      <div className="t-overline mb-4">— Entregables</div>
      <div className="flex items-end justify-between gap-6 flex-wrap mb-3">
        <h1 className="t-h1">
          Repositorio de la <span className="accent-word">propuesta</span>.
        </h1>
        {isAdmin && (
          <Link
            href="/admin/upload"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse hover:bg-primary-dark transition-colors shadow-md whitespace-nowrap"
          >
            + Subir entregable
          </Link>
        )}
      </div>
      <p className="t-lead max-w-2xl mb-10">
        Mapas de procesos, user journeys, DAFOs, arquitectura y casos de uso.
        Comenta directo sobre cada entregable.
      </p>

      <div className="flex items-center gap-8 mb-10 text-sm">
        <Metric label="Entregables" value={total} />
        <Metric label="Comentarios abiertos" value={openComments} />
      </div>

      {deliverables.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={{
                id: d.id,
                title: d.title,
                type: d.type,
                description: d.description,
                status: d.status,
                createdAt: d.createdAt.toISOString(),
                openComments: d._count.comments,
              }}
              showStatus={isAdmin}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="t-metric">{value}</div>
      <div className="t-metric-label mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-card bg-bg p-12 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary-ultralight grid place-items-center text-primary text-xl">
        ⌘
      </div>
      <h2 className="t-h3 mb-2">Aún no hay entregables.</h2>
      <p className="text-fg-muted mb-6 max-w-md mx-auto">
        {isAdmin
          ? "Sube el primer entregable HTML para arrancar la entrega."
          : "El equipo aún no ha publicado nada. Te avisamos cuando haya."}
      </p>
      {isAdmin && (
        <Link
          href="/admin/upload"
          className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse hover:bg-primary-dark transition-colors"
        >
          Subir el primero
        </Link>
      )}
    </div>
  );
}
