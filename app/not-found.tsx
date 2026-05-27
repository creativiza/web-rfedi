import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-muted px-4">
      <div className="bg-bg rounded-2xl border border-border-card shadow-md p-10 max-w-md text-center">
        <div className="t-overline mb-3">— Error 404</div>
        <h1 className="t-h2 mb-3">No encontramos esta página.</h1>
        <p className="text-fg-muted mb-6">
          Es posible que el entregable se haya eliminado, que la URL esté mal o
          que aún no esté publicado.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-fg-inverse hover:bg-primary-dark transition-colors"
        >
          Volver al dashboard
        </Link>
      </div>
    </div>
  );
}
