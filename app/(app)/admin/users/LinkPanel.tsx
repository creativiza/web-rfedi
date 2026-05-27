"use client";

import { useState } from "react";

export function LinkPanel({
  email,
  link,
  expiresAt,
  tone = "neutral",
  onDismiss,
}: {
  email: string;
  link: string;
  expiresAt: string;
  tone?: "neutral" | "success";
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
      const el = document.getElementById("link-text");
      if (el instanceof HTMLInputElement) {
        el.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  const wa =
    `https://wa.me/?text=` +
    encodeURIComponent(
      `Tu enlace de acceso a RFEDI Delivery (válido 24h, un solo uso):\n${link}`,
    );
  const mailto =
    `mailto:${encodeURIComponent(email)}?subject=` +
    encodeURIComponent("Tu enlace de acceso a RFEDI Delivery") +
    `&body=` +
    encodeURIComponent(
      `Hola,\n\nAquí tienes tu enlace de acceso (válido 24h, un solo uso):\n\n${link}\n\n— Creativiza × RFEDI`,
    );

  const ring =
    tone === "success" ? "ring-success/40 bg-success/5" : "ring-border-card bg-bg-muted";

  return (
    <div className={`rounded-xl ring-1 ${ring} p-4 space-y-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          Enlace para {email}
        </div>
        <span className="text-[11px] text-fg-subtle">
          caduca {new Date(expiresAt).toLocaleString("es-ES")}
        </span>
      </div>

      <input
        id="link-text"
        type="text"
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full text-xs font-mono rounded-lg border border-border-input bg-bg px-3 py-2"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-primary text-fg-inverse px-4 py-2 text-xs font-semibold hover:bg-primary-dark transition-colors"
        >
          {copied ? "✓ Copiado" : "Copiar enlace"}
        </button>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-bg-muted text-fg-body px-4 py-2 text-xs font-semibold hover:bg-bg-muted hover:text-primary transition-colors border border-border-input"
        >
          Compartir por WhatsApp
        </a>
        <a
          href={mailto}
          className="rounded-full bg-bg-muted text-fg-body px-4 py-2 text-xs font-semibold hover:bg-bg-muted hover:text-primary transition-colors border border-border-input"
        >
          Enviar por email
        </a>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto rounded-full text-xs text-fg-subtle hover:text-fg px-2"
          >
            Cerrar
          </button>
        )}
      </div>

      <p className="text-[11px] text-fg-subtle">
        Un solo uso · No se manda automáticamente. Compártelo por el canal que
        prefieras.
      </p>
    </div>
  );
}
