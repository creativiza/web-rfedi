"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliverableType } from "@prisma/client";
import { uploadDeliverable } from "./actions";

const TYPES: { value: DeliverableType; label: string }[] = [
  { value: "PROCESS_MAP", label: "Mapa de procesos" },
  { value: "USER_JOURNEY", label: "User journey" },
  { value: "DAFO", label: "DAFO" },
  { value: "ARCHITECTURE", label: "Arquitectura" },
  { value: "PROTOTYPE", label: "Prototipo" },
  { value: "REPORT", label: "Informe" },
  { value: "OTHER", label: "Otro" },
];

export function UploadForm() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DeliverableType>("PROCESS_MAP");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!file) {
      setError("Selecciona un archivo .html.");
      return;
    }
    if (!/\.html?$/i.test(file.name)) {
      setError("El archivo debe ser .html o .htm.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo supera los 5 MB.");
      return;
    }

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("type", type);
    fd.set("description", description.trim());
    fd.set("file", file);
    fd.set("publish", publish ? "1" : "0");

    startTransition(async () => {
      const result = await uploadDeliverable(fd);
      if (result?.error) {
        setError(result.error);
      } else if (result?.deliverableId) {
        router.push(`/deliverables/${result.deliverableId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      )}

      <Field label="Título">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
          placeholder="Mapa de procesos · Auditorías"
          className="w-full rounded-xl border border-border-input bg-bg px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50"
        />
      </Field>

      <Field label="Tipo">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DeliverableType)}
          disabled={pending}
          className="w-full rounded-xl border border-border-input bg-bg px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Descripción" optional>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder="Breve nota para el cliente sobre qué va a encontrar."
          className="w-full rounded-xl border border-border-input bg-bg px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50 resize-y"
        />
      </Field>

      <Field label="Archivo HTML">
        <label className="flex items-center gap-4 cursor-pointer rounded-xl border border-dashed border-border-input bg-bg-muted px-4 py-4 hover:border-primary transition-colors">
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="hidden"
          />
          <span className="text-2xl text-primary" aria-hidden>
            ⬆
          </span>
          <span className="flex-1">
            {file ? (
              <>
                <span className="block text-sm font-medium text-fg">
                  {file.name}
                </span>
                <span className="block text-xs text-fg-subtle">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </>
            ) : (
              <>
                <span className="block text-sm font-medium text-fg">
                  Selecciona o arrastra un .html
                </span>
                <span className="block text-xs text-fg-subtle">
                  Máximo 5 MB · se sanitiza al subir
                </span>
              </>
            )}
          </span>
        </label>
      </Field>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 accent-[color:var(--color-primary)]"
        />
        <span className="text-sm text-fg-body">
          Publicar inmediatamente (si no, queda como borrador).
        </span>
      </label>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-fg-inverse shadow-md transition-all hover:bg-primary-dark hover:shadow-lg disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Subiendo…" : "Subir entregable"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="t-mono text-xs text-fg-subtle mb-2 inline-block uppercase tracking-widest">
        {label}
        {optional && (
          <span className="ml-1 normal-case tracking-normal text-fg-subtle/70">
            (opcional)
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
