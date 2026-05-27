import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeliverableRow } from "./DeliverableRow";

export const dynamic = "force-dynamic";

export default async function AdminDeliverablesPage() {
  const items = await prisma.deliverable.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      status: true,
      order: true,
      createdAt: true,
      documentVersion: true,
      _count: { select: { comments: true } },
    },
  });

  return (
    <section className="max-w-5xl mx-auto w-full px-6 py-12">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <div className="t-overline mb-2">— Admin · Entregables</div>
          <h1 className="t-h1">Gestionar entregables.</h1>
        </div>
        <Link
          href="/admin/upload"
          className="rounded-full bg-primary text-fg-inverse px-5 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors whitespace-nowrap"
        >
          + Nuevo
        </Link>
      </div>
      <p className="t-lead mb-10 max-w-2xl">
        Publica, archiva o elimina. El orden del listado se controla con el
        campo &ldquo;Orden&rdquo; — menor número = más arriba.
      </p>

      <div className="bg-bg rounded-2xl border border-border-card shadow-md divide-y divide-border-card">
        {items.length === 0 && (
          <div className="px-6 py-12 text-center text-fg-subtle">
            Aún no has subido nada.
          </div>
        )}
        {items.map((d) => (
          <DeliverableRow
            key={d.id}
            item={{
              id: d.id,
              title: d.title,
              slug: d.slug,
              type: d.type,
              description: d.description,
              status: d.status,
              order: d.order,
              version: d.documentVersion,
              commentCount: d._count.comments,
              createdAt: d.createdAt.toISOString(),
            }}
          />
        ))}
      </div>
    </section>
  );
}
