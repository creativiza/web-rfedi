"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { deleteUser, regenerateLink, updateUserRole } from "./actions";
import { LinkPanel } from "./LinkPanel";

export function UserList({
  users,
  currentUserId,
}: {
  users: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    commentCount: number;
    createdAt: string;
  }[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<
    { userId: string; email: string; link: string; expiresAt: string } | null
  >(null);
  const router = useRouter();

  function toggleRole(id: string, current: Role) {
    const fd = new FormData();
    fd.set("userId", id);
    fd.set("role", current === "ADMIN" ? "CLIENT" : "ADMIN");
    startTransition(async () => {
      const r = await updateUserRole(fd);
      if (r?.error) alert(r.error);
      else router.refresh();
    });
  }

  function remove(id: string, email: string) {
    if (!confirm(`¿Eliminar ${email}? Se borrarán también sus comentarios.`))
      return;
    const fd = new FormData();
    fd.set("userId", id);
    startTransition(async () => {
      const r = await deleteUser(fd);
      if (r?.error) alert(r.error);
      else router.refresh();
    });
  }

  function regenerate(id: string, email: string) {
    setGenerated(null);
    const fd = new FormData();
    fd.set("userId", id);
    startTransition(async () => {
      const r = await regenerateLink(fd);
      if (r?.error) {
        alert(r.error);
        return;
      }
      if (r?.link) {
        setGenerated({ userId: id, email, link: r.link, expiresAt: r.expiresAt });
      }
    });
  }

  return (
    <div className="divide-y divide-border-card">
      {users.map((u) => {
        const isSelf = u.id === currentUserId;
        const initials = (u.name ?? u.email).slice(0, 2).toUpperCase();
        const showLink = generated?.userId === u.id;
        return (
          <div key={u.id} className="px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-primary-ultralight text-primary text-xs font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-fg">
                    {u.name ?? u.email.split("@")[0]}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      u.role === "ADMIN"
                        ? "bg-primary/10 text-primary"
                        : "bg-bg-muted text-fg-subtle"
                    }`}
                  >
                    {u.role === "ADMIN" ? "Admin" : "Cliente"}
                  </span>
                  {isSelf && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                      Tú
                    </span>
                  )}
                </div>
                <div className="text-xs text-fg-subtle mt-0.5 truncate">
                  {u.email} · {u.commentCount} comentario
                  {u.commentCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => regenerate(u.id, u.email)}
                  disabled={pending}
                  className="text-xs text-primary hover:underline disabled:opacity-50 font-semibold"
                  title="Generar un enlace de acceso nuevo y mostrarlo para copiar"
                >
                  Generar enlace
                </button>
                <button
                  type="button"
                  onClick={() => toggleRole(u.id, u.role)}
                  disabled={pending || isSelf}
                  className="text-xs text-fg-muted hover:text-primary disabled:opacity-30 disabled:hover:text-fg-muted"
                  title={
                    isSelf
                      ? "No puedes cambiar tu propio rol"
                      : `Pasar a ${u.role === "ADMIN" ? "cliente" : "admin"}`
                  }
                >
                  {u.role === "ADMIN" ? "Hacer cliente" : "Hacer admin"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(u.id, u.email)}
                  disabled={pending || isSelf}
                  className="text-xs text-fg-subtle hover:text-error disabled:opacity-30"
                  title={isSelf ? "No te puedes eliminar" : "Eliminar usuario"}
                >
                  Eliminar
                </button>
              </div>
            </div>
            {showLink && generated && (
              <div className="mt-3">
                <LinkPanel
                  email={generated.email}
                  link={generated.link}
                  expiresAt={generated.expiresAt}
                  onDismiss={() => setGenerated(null)}
                />
              </div>
            )}
          </div>
        );
      })}
      {users.length === 0 && (
        <div className="px-6 py-12 text-center text-fg-subtle">
          No hay usuarios todavía.
        </div>
      )}
    </div>
  );
}
