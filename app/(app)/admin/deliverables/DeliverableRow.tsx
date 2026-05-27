"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliverableStatus, DeliverableType } from "@prisma/client";
import { deleteDeliverable, updateDeliverable } from "./actions";

const TYPE_LABEL: Record<DeliverableType, string> = {
  PROCESS_MAP: "Mapa de procesos",
  USER_JOURNEY: "User journey",
  DAFO: "DAFO",
  ARCHITECTURE: "Arquitectura",
  PROTOTYPE: "Prototipo",
  REPORT: "Informe",
  OTHER: "Entregable",
};

const STATUS_CLS: Record<DeliverableStatus, string> = {
  DRAFT: "bg-warning/10 text-warning",
  PUBLISHED: "bg-success/10 text-success",
  ARCHIVED: "bg-bg-muted text-fg-subtle",
};

export function DeliverableRow({
  item,
}: {
  item: {
    id: string;
    title: string;
    slug: string;
    type: DeliverableType;
    description: string | null;
    status: DeliverableStatus;
    order: number;
    version: number;
    commentCount: number;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function patch(patch: Partial<{ status: DeliverableStatus; order: number }>) {
    const fd = new FormData();
    fd.set("id", item.id);
    if (patch.status) fd.set("status", patch.status);
    if (patch.order !== undefined) fd.set("order", String(patch.order));
    startTransition(async () => {
      const r = await updateDeliverable(fd);
      if (r?.error) alert(r.error);
      else router.refresh();
    });
  }

  function remove() {
    if (
      !confirm(
        `¿Eliminar "${item.title}"? Se borrarán también los ${item.commentCount} comentarios.`,
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(async () => {
      const r = await deleteDeliverable(fd);
      if (r?.error) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="px-6 py-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
      <input
        type="number"
        defaultValue={item.order}
        disabled={pending}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next) && next !== item.order) patch({ order: next });
        }}
        className="w-14 text-center text-sm rounded-lg border border-border-input bg-bg px-2 py-1"
        title="Orden (menor = más arriba)"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            {TYPE_LABEL[item.type]}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_CLS[item.status]}`}
          >
            {item.status === "DRAFT"
              ? "Borrador"
              : item.status === "PUBLISHED"
              ? "Publicado"
              : "Archivado"}
          </span>
          <span className="text-[10px] font-mono text-fg-subtle">v{item.version}</span>
        </div>
        <Link
          href={`/deliverables/${item.id}`}
          className="font-display font-bold text-fg hover:text-primary transition-colors"
        >
          {item.title}
        </Link>
        <div className="text-xs text-fg-subtle">
          {item.commentCount} comentario{item.commentCount === 1 ? "" : "s"} · {item.slug}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {item.status !== "PUBLISHED" && (
          <button
            type="button"
            onClick={() => patch({ status: "PUBLISHED" })}
            disabled={pending}
            className="text-xs text-success hover:underline disabled:opacity-50"
          >
            Publicar
          </button>
        )}
        {item.status === "PUBLISHED" && (
          <button
            type="button"
            onClick={() => patch({ status: "DRAFT" })}
            disabled={pending}
            className="text-xs text-fg-muted hover:text-warning disabled:opacity-50"
          >
            Despublicar
          </button>
        )}
        {item.status !== "ARCHIVED" && (
          <button
            type="button"
            onClick={() => patch({ status: "ARCHIVED" })}
            disabled={pending}
            className="text-xs text-fg-muted hover:text-fg-subtle disabled:opacity-50"
          >
            Archivar
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-xs text-fg-subtle hover:text-error disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
