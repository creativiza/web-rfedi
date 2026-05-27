import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ConfirmButton } from "./ConfirmButton";

type SearchParams = Promise<{
  token?: string;
  email?: string;
  callbackUrl?: string;
}>;

// This page exists so the magic-link URL we share is NOT a token-consuming
// endpoint. Email/messenger previews fetch the shared URL to build link
// cards — that would consume the one-shot token before the human ever
// clicks. Here we render a button whose action only fires from real
// human JS execution, so previews and link scanners don't burn the token.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token, email, callbackUrl } = await searchParams;

  if (!token || !email) {
    redirect("/login");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { name: true },
  });

  // We DO NOT touch the VerificationToken table here on purpose — looking
  // up the user is idempotent and safe to run from preview bots.

  const params = new URLSearchParams({
    token,
    email: normalizedEmail,
    callbackUrl: callbackUrl || "/dashboard",
  });
  const finalUrl = `/api/auth/callback/link?${params}`;

  const displayName = user?.name?.split(" ")[0] || "hola";

  return (
    <div className="bg-bg rounded-2xl border border-border-card shadow-md p-8 sm:p-10">
      <div className="t-overline mb-4">— Acceso</div>
      <h1 className="t-h2 mb-3">
        {displayName}, <span className="accent-word">pulsa para entrar</span>.
      </h1>
      <p className="t-lead mb-8">
        Vamos a abrir tu sesión en RFEDI Delivery. El enlace es de un solo uso,
        así que solo se gasta cuando pulses.
      </p>

      <ConfirmButton callbackUrl={finalUrl} />

      <noscript>
        <p className="mt-4 text-sm text-fg-muted">
          Si no se carga el botón:{" "}
          <a href={finalUrl} className="text-primary underline">
            entra desde este enlace
          </a>
          .
        </p>
      </noscript>

      <p className="mt-8 text-xs text-fg-subtle">
        Si no esperabas este acceso, simplemente ignora esta página.
      </p>
    </div>
  );
}
