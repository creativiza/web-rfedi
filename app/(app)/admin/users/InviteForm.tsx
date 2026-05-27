"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { inviteAndGenerateLink } from "./actions";
import { LinkPanel } from "./LinkPanel";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { link: string; email: string; expiresAt: string } | null
  >(null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("email", email.trim().toLowerCase());
    fd.set("name", name.trim());
    fd.set("role", role);
    startTransition(async () => {
      const r = await inviteAndGenerateLink(fd);
      if (r?.error) {
        setError(r.error);
      } else if (r?.link) {
        setResult({ link: r.link, email: r.email, expiresAt: r.expiresAt });
        setEmail("");
        setName("");
        setRole("CLIENT");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="t-mono text-xs uppercase tracking-widest text-fg-subtle mb-2 block">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              placeholder="nombre@cliente.com"
              className="w-full rounded-xl border border-border-input bg-bg px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="t-mono text-xs uppercase tracking-widest text-fg-subtle mb-2 block">
              Nombre (opcional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              placeholder="Paco Vicente"
              className="w-full rounded-xl border border-border-input bg-bg px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
        </div>

        <label className="block">
          <span className="t-mono text-xs uppercase tracking-widest text-fg-subtle mb-2 block">
            Rol
          </span>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <RoleChip
              label="Cliente (lectura + comentar)"
              active={role === "CLIENT"}
              onClick={() => setRole("CLIENT")}
            />
            <RoleChip
              label="Admin (subir + gestionar)"
              active={role === "ADMIN"}
              onClick={() => setRole("ADMIN")}
            />
          </div>
        </label>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-primary text-fg-inverse px-6 py-3 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {pending ? "Generando…" : "Crear usuario + generar enlace"}
          </button>
        </div>
      </form>

      {result && (
        <LinkPanel
          email={result.email}
          link={result.link}
          expiresAt={result.expiresAt}
          tone="success"
        />
      )}
    </div>
  );
}

function RoleChip({
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
      className={`text-left text-sm rounded-xl px-4 py-3 transition-colors border ${
        active
          ? "bg-fg text-fg-inverse border-fg"
          : "bg-bg border-border-input text-fg-muted hover:text-fg hover:border-primary"
      }`}
    >
      {label}
    </button>
  );
}
