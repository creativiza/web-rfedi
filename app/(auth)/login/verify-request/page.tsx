import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="bg-bg rounded-2xl border border-border-card shadow-md p-8 sm:p-10 text-center">
      <div className="t-overline mb-4">— Email enviado</div>
      <div className="mx-auto mb-6 grid place-items-center h-14 w-14 rounded-full bg-primary-ultralight text-primary">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4h16v16H4z" />
          <path d="m4 4 8 8 8-8" />
        </svg>
      </div>
      <h1 className="t-h2 mb-3">Revisa tu email.</h1>
      <p className="t-lead">
        Te hemos mandado un enlace de un solo uso. Ábrelo en este mismo
        navegador para entrar.
      </p>
      <p className="mt-6 text-sm text-fg-subtle">
        ¿No lo ves? Mira en spam o{" "}
        <Link href="/login" className="text-primary hover:underline">
          pide otro enlace
        </Link>
        .
      </p>
    </div>
  );
}
