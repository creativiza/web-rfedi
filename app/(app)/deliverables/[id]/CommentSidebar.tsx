"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CommentCategory } from "@prisma/client";
import type { CommentDto } from "@/lib/types";
import { CommentCard } from "./CommentCard";

type StatusFilter = "all" | "OPEN" | "RESOLVED";
type KindFilter = "all" | "PINNED" | "SIDE";
type CategoryFilter = "all" | CommentCategory;

export function CommentSidebar({
  comments,
  activeId,
  currentUser,
  onFocusPin,
  onAddGeneral,
  onUpdated,
  onDeleted,
}: {
  comments: CommentDto[];
  activeId: string | null;
  currentUser: {
    id: string;
    role: "ADMIN" | "CLIENT";
    email: string;
    name: string | null;
  };
  onFocusPin: (id: string) => void;
  onAddGeneral: () => void;
  onUpdated: (c: CommentDto) => void;
  onDeleted: (id: string) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [kind, setKind] = useState<KindFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return comments.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (kind !== "all" && c.anchorKind !== kind) return false;
      if (category !== "all" && c.category !== category) return false;
      return true;
    });
  }, [comments, status, kind, category]);

  // Scroll active comment into view
  useEffect(() => {
    if (!activeId) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-comment-id="${activeId}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId]);

  const openCount = comments.filter((c) => c.status === "OPEN").length;
  const resolvedCount = comments.length - openCount;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-border-card">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-fg-subtle">
            Comentarios
          </h2>
          <span className="text-xs text-fg-subtle">
            {openCount} abierto{openCount === 1 ? "" : "s"} · {resolvedCount} resuelto
            {resolvedCount === 1 ? "" : "s"}
          </span>
        </div>

        <button
          type="button"
          onClick={onAddGeneral}
          className="w-full rounded-xl border border-dashed border-border-input bg-bg-muted hover:border-primary hover:bg-primary-ultralight transition-colors px-4 py-3 text-sm text-fg-muted hover:text-primary text-left flex items-center gap-3"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Añadir comentario general</span>
        </button>

        <div className="mt-3 grid grid-cols-3 gap-1">
          <FilterChip
            label="Abiertos"
            active={status === "OPEN"}
            onClick={() => setStatus("OPEN")}
          />
          <FilterChip
            label="Resueltos"
            active={status === "RESOLVED"}
            onClick={() => setStatus("RESOLVED")}
          />
          <FilterChip
            label="Todos"
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
        </div>

        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-fg-subtle font-mono hover:text-primary transition-colors list-none flex items-center gap-2">
            <span className="group-open:rotate-90 inline-block transition-transform">›</span>
            Filtros avanzados
          </summary>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-1">
              <FilterChip label="Todo" active={kind === "all"} onClick={() => setKind("all")} />
              <FilterChip label="Anclados" active={kind === "PINNED"} onClick={() => setKind("PINNED")} />
              <FilterChip label="Generales" active={kind === "SIDE"} onClick={() => setKind("SIDE")} />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="w-full text-xs rounded-lg border border-border-input bg-bg px-3 py-2"
            >
              <option value="all">Todas las categorías</option>
              <option value="QUESTION">Preguntas</option>
              <option value="CHANGE">Cambios</option>
              <option value="APPROVED">OK / Aprobado</option>
              <option value="NOTE">Notas</option>
            </select>
          </div>
        </details>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
      >
        {filtered.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            {comments.length === 0
              ? "Aún no hay comentarios. Sé el primero."
              : "Nada con los filtros actuales."}
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              ref={c.id === activeId ? activeRef : undefined}
              data-comment-id={c.id}
            >
              <CommentCard
                comment={c}
                isActive={c.id === activeId}
                currentUser={currentUser}
                onFocusPin={onFocusPin}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold rounded-full px-2.5 py-1.5 transition-colors ${
        active
          ? "bg-fg text-fg-inverse"
          : "bg-bg-muted text-fg-muted hover:bg-bg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
