"use client";

import { useState, useTransition } from "react";
import type { CommentCategory } from "@prisma/client";
import type { CommentDto } from "@/lib/types";

const CATEGORY_STYLES: Record<
  CommentCategory,
  { label: string; bg: string; fg: string }
> = {
  QUESTION: { label: "Pregunta", bg: "bg-info/10", fg: "text-info" },
  CHANGE: { label: "Cambio", bg: "bg-warning/10", fg: "text-warning" },
  APPROVED: { label: "OK", bg: "bg-success/10", fg: "text-success" },
  NOTE: { label: "Nota", bg: "bg-bg-muted", fg: "text-fg-muted" },
};

export function CommentCard({
  comment,
  isActive,
  currentUser,
  onFocusPin,
  onUpdated,
  onDeleted,
}: {
  comment: CommentDto;
  isActive: boolean;
  currentUser: {
    id: string;
    role: "ADMIN" | "CLIENT";
    email: string;
    name: string | null;
  };
  onFocusPin: (id: string) => void;
  onUpdated: (c: CommentDto) => void;
  onDeleted: (id: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState(comment.reply ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "ADMIN";
  const isAuthor = comment.author.id === currentUser.id;
  const isResolved = comment.status === "RESOLVED";
  const cat = CATEGORY_STYLES[comment.category];
  const authorName = comment.author.name ?? comment.author.email.split("@")[0];
  const initials = authorName.slice(0, 2).toUpperCase();

  async function patch(body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      setError("No pude guardar: " + (t || r.statusText));
      return;
    }
    const json = await r.json();
    onUpdated(json.comment);
  }

  function handleResolve() {
    startTransition(() => {
      patch({ status: isResolved ? "OPEN" : "RESOLVED" });
    });
  }

  function handleSaveReply() {
    startTransition(() => {
      patch({ reply: replyDraft.trim() || null }).then(() => setReplying(false));
    });
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este comentario? No se puede deshacer.")) return;
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
      if (!r.ok) {
        setError("No pude eliminar.");
        return;
      }
      onDeleted(comment.id);
    });
  }

  return (
    <article
      className={`rounded-xl border bg-bg p-4 transition-all ${
        isActive
          ? "border-primary shadow-md ring-1 ring-primary"
          : "border-border-card"
      } ${isResolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {comment.anchorKind === "PINNED" && comment.number !== null ? (
          <button
            type="button"
            onClick={() => onFocusPin(comment.id)}
            className="grid place-items-center h-6 w-6 rounded-full bg-primary text-fg-inverse text-[11px] font-bold hover:bg-primary-dark transition-colors"
            title="Ir al punto anclado"
          >
            {comment.number}
          </button>
        ) : (
          <span
            className="grid place-items-center h-6 w-6 rounded-full bg-bg-muted text-fg-subtle text-xs"
            title="Comentario general"
          >
            ⌘
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${cat.bg} ${cat.fg}`}
        >
          {cat.label}
        </span>
        {isResolved && (
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-success/10 text-success">
            Resuelto
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-full bg-primary-ultralight text-primary text-[10px] font-semibold grid place-items-center"
            title={comment.author.email}
          >
            {initials}
          </div>
        </div>
      </div>

      <p className="text-sm text-fg-body whitespace-pre-wrap break-words leading-relaxed">
        {comment.body}
      </p>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-fg-subtle">
        <span>{authorName}</span>
        <span>·</span>
        <time dateTime={comment.createdAt}>
          {formatDate(comment.createdAt)}
        </time>
      </div>

      {comment.reply && (
        <div className="mt-3 pl-3 border-l-2 border-primary">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
            Respuesta del equipo
          </div>
          <p className="text-sm text-fg-body whitespace-pre-wrap break-words leading-relaxed">
            {comment.reply}
          </p>
          {comment.replyBy && (
            <div className="mt-1 text-[11px] text-fg-subtle">
              {comment.replyBy.name ?? comment.replyBy.email}
              {comment.replyAt && (
                <>
                  {" · "}
                  <time dateTime={comment.replyAt}>
                    {formatDate(comment.replyAt)}
                  </time>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && replying && (
        <div className="mt-3 space-y-2">
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            rows={3}
            placeholder="Responde como equipo…"
            className="w-full text-sm rounded-lg border border-border-input bg-bg px-3 py-2 outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveReply}
              disabled={pending}
              className="text-xs rounded-full bg-primary text-fg-inverse px-3 py-1.5 font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {comment.reply ? "Actualizar" : "Responder"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReplying(false);
                setReplyDraft(comment.reply ?? "");
              }}
              className="text-xs rounded-full bg-bg-muted text-fg-muted px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {isAdmin && !replying && (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="text-xs text-primary hover:underline"
          >
            {comment.reply ? "Editar respuesta" : "Responder"}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={handleResolve}
            disabled={pending}
            className="text-xs text-fg-muted hover:text-fg disabled:opacity-50"
          >
            {isResolved ? "Reabrir" : "Marcar resuelto"}
          </button>
        )}
        {(isAdmin || isAuthor) && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-xs text-fg-subtle hover:text-error disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      )}
    </article>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
