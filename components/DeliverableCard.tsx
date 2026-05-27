import Link from "next/link";
import type { DeliverableStatus, DeliverableType } from "@prisma/client";

const TYPE_META: Record<DeliverableType, { label: string; icon: string }> = {
  PROCESS_MAP: { label: "Mapa de procesos", icon: "⟶" },
  USER_JOURNEY: { label: "User journey", icon: "🚶" },
  DAFO: { label: "DAFO", icon: "⊞" },
  ARCHITECTURE: { label: "Arquitectura", icon: "◰" },
  PROTOTYPE: { label: "Prototipo", icon: "✱" },
  REPORT: { label: "Informe", icon: "▤" },
  OTHER: { label: "Entregable", icon: "·" },
};

const STATUS_META: Record<DeliverableStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Borrador", cls: "bg-warning/10 text-warning" },
  PUBLISHED: { label: "Publicado", cls: "bg-success/10 text-success" },
  ARCHIVED: { label: "Archivado", cls: "bg-bg-muted text-fg-subtle" },
};

export function DeliverableCard({
  deliverable,
  showStatus,
}: {
  deliverable: {
    id: string;
    title: string;
    type: DeliverableType;
    description: string | null;
    status: DeliverableStatus;
    createdAt: string;
    openComments: number;
  };
  showStatus: boolean;
}) {
  const type = TYPE_META[deliverable.type];
  const status = STATUS_META[deliverable.status];
  return (
    <Link
      href={`/deliverables/${deliverable.id}`}
      className="group rounded-2xl border border-border-card bg-bg p-5 hover:border-primary hover:shadow-md transition-all flex flex-col"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary-ultralight text-primary text-lg shrink-0">
          {type.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              {type.label}
            </span>
            {showStatus && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${status.cls}`}
              >
                {status.label}
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-lg leading-tight text-fg mt-1 group-hover:text-primary transition-colors line-clamp-2">
            {deliverable.title}
          </h3>
        </div>
      </div>

      {deliverable.description && (
        <p className="text-sm text-fg-muted line-clamp-2 mb-4">
          {deliverable.description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-border-card text-xs text-fg-subtle">
        <span>{formatDate(deliverable.createdAt)}</span>
        {deliverable.openComments > 0 ? (
          <span className="inline-flex items-center gap-1 text-primary font-semibold">
            <span className="grid place-items-center h-5 w-5 rounded-full bg-primary text-fg-inverse text-[10px]">
              {deliverable.openComments}
            </span>
            comentarios abiertos
          </span>
        ) : (
          <span className="text-fg-subtle">Sin comentarios</span>
        )}
      </div>
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
