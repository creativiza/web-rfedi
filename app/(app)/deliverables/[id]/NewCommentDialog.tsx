"use client";

import { useEffect, useState, useTransition } from "react";
import type { CommentCategory } from "@prisma/client";
import type { CommentDto } from "@/lib/types";
import type { PendingAnchor } from "./Viewer";

const CATEGORY_OPTIONS: { value: CommentCategory; label: string }[] = [
  { value: "NOTE", label: "Nota" },
  { value: "QUESTION", label: "Pregunta" },
  { value: "CHANGE", label: "Cambio" },
  { value: "APPROVED", label: "OK / Aprobado" },
];

export function NewCommentDialog({
  deliverableId,
  anchor,
  isSide,
  onClose,
  onCreated,
}: {
  deliverableId: string;
  anchor: PendingAnchor;
  isSide: boolean;
  onClose: () => void;
  onCreated: (c: CommentDto) => void;
}) {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<CommentCategory>("NOTE");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Escribe algo.");
      return;
    }

    const payload = isSide
      ? {
          deliverableId,
          body: trimmed,
          category,
          anchorKind: "SIDE" as const,
        }
      : {
          deliverableId,
          body: trimmed,
          category,
          anchorKind: "PINNED" as const,
          selectorPath: anchor.selectorPath,
          offsetXPct: anchor.offsetXPct,
          offsetYPct: anchor.offsetYPct,
          anchorText: anchor.anchorText,
          fallbackXPct: anchor.fallbackXPct,
          fallbackYPct: anchor.fallbackYPct,
          documentVersion: anchor.documentVersion,
        };

    startTransition(async () => {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error ?? "No pude crear el comentario.");
        return;
      }
      const json = await r.json();
      onCreated(json.comment);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="bg-bg rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div>
          <div className="t-overline mb-2">
            {isSide ? "— Comentario general" : "— Comentario anclado"}
          </div>
          <h2 className="t-h3">
            {isSide ? "Deja una nota general" : "Ancla un comentario aquí"}
          </h2>
          {!isSide && anchor.anchorText && (
            <p className="mt-2 text-xs text-fg-subtle italic line-clamp-2">
              “{anchor.anchorText}”
            </p>
          )}
        </div>

        <label className="block">
          <span className="t-mono text-xs uppercase tracking-widest text-fg-subtle mb-2 block">
            Categoría
          </span>
          <div className="grid grid-cols-4 gap-1">
            {CATEGORY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCategory(o.value)}
                className={`text-xs font-semibold rounded-full px-2 py-2 transition-colors ${
                  category === o.value
                    ? "bg-fg text-fg-inverse"
                    : "bg-bg-muted text-fg-muted hover:text-fg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="t-mono text-xs uppercase tracking-widest text-fg-subtle mb-2 block">
            Comentario
          </span>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Escribe el comentario…"
            disabled={pending}
            className="w-full text-sm rounded-xl border border-border-input bg-bg px-3 py-2 outline-none focus:border-primary disabled:opacity-50 resize-y"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-bg-muted text-fg-muted px-4 py-2 text-sm hover:text-fg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-primary text-fg-inverse px-5 py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
