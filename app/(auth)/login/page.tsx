import Link from "next/link";

type SearchParams = Promise<{ error?: string; callbackUrl?: string }>;

const errorMessages: Record<string, string> = {
  AccessDenied:
    "Tu email no está en la lista de invitados, o el enlace que has usado ya no es válido.",
  Verification:
    "El enlace ha caducado o ya se usó. Pídele al admin uno nuevo.",
  Configuration:
    "Algo no está bien configurado en el servidor. Avisa al admin.",
  Default: "No ha sido posible iniciar sesión. Pídele al admin un enlace nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const message = error ? errorMessages[error] ?? errorMessages.Default : null;

  return (
    <div className="bg-bg rounded-2xl border border-border-card shadow-md p-8 sm:p-10">
      <div className="t-overline mb-4">— Acceso</div>
      <h1 className="t-h1 mb-3">
        Solo por <span className="accent-word">invitación</span>.
      </h1>
      <p className="t-lead mb-6">
        Esta app es privada. Para entrar, pídele al admin un enlace de acceso
        — te llegará por el canal que uséis (WhatsApp, email, lo que sea).
        Solo tienes que pincharlo.
      </p>

      {message && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {message}
        </div>
      )}

      <div className="rounded-xl border border-border-card bg-bg-muted px-4 py-3 text-sm text-fg-muted">
        <span className="font-semibold text-fg">¿Eres admin?</span> Para
        generar enlaces y gestionar usuarios entra a{" "}
        <Link href="/admin/users" className="text-primary hover:underline">
          /admin/users
        </Link>{" "}
        cuando ya hayas iniciado sesión.
      </div>

      <p className="mt-8 text-xs text-fg-subtle">
        Si has perdido el acceso, escríbenos a{" "}
        <Link
          href="mailto:hola@creativiza.es"
          className="text-primary hover:underline"
        >
          hola@creativiza.es
        </Link>
        .
      </p>
    </div>
  );
}
