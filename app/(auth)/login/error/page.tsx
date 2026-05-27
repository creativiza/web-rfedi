import Link from "next/link";

type SearchParams = Promise<{ error?: string }>;

const reasons: Record<string, string> = {
  AccessDenied:
    "Tu email no está en la lista de invitados. Pídele al admin que te invite primero.",
  Verification:
    "El enlace ha caducado o ya se había usado. Pide otro abajo.",
  Configuration:
    "Hay un problema de configuración del servidor. Avisa al admin (puede ser una variable de entorno).",
  Default: "Algo no ha ido bien. Inténtalo de nuevo.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const msg = error ? reasons[error] ?? reasons.Default : reasons.Default;
  return (
    <div className="bg-bg rounded-2xl border border-border-card shadow-md p-8 sm:p-10">
      <div className="t-overline mb-4 text-error">— Error</div>
      <h1 className="t-h2 mb-3">No hemos podido entrar.</h1>
      <p className="t-lead mb-6">{msg}</p>
      <Link
        href="/login"
        className="inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-fg-inverse shadow-md hover:bg-primary-dark hover:shadow-lg transition-all"
      >
        Volver a intentarlo
      </Link>
    </div>
  );
}
