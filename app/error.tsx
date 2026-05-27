"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-muted px-4">
      <div className="bg-bg rounded-2xl border border-border-card shadow-md p-10 max-w-md text-center">
        <div className="t-overline mb-3 text-error">— Algo ha fallado</div>
        <h1 className="t-h2 mb-3">No hemos podido cargar esto.</h1>
        <p className="text-fg-muted mb-6 text-sm">
          {error.message || "Error inesperado del servidor."}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse hover:bg-primary-dark transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="rounded-full bg-bg-muted text-fg-muted px-5 py-2.5 text-sm hover:text-fg"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
