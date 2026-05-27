/**
 * Emergency bootstrap: print a fresh access link for an email.
 *
 *   npm run admin:link -- alberto@example.com
 *   npm run admin:link -- alberto@example.com https://rfedi.creativiza.es
 *
 * Use it when you've been locked out (e.g. seeded admin, expired session
 * and no other admin available to generate a link in the UI).
 *
 * The email MUST already exist in the User table — run `npm run db:seed`
 * first if needed.
 */
import { generateAccessLink } from "../lib/auth/generate-link";

async function main() {
  const email = process.argv[2];
  const origin = process.argv[3] ?? process.env.AUTH_URL ?? "http://localhost:3000";

  if (!email) {
    console.error("Usage: npm run admin:link -- <email> [origin]");
    process.exit(1);
  }

  try {
    const { url, expiresAt } = await generateAccessLink({ email, origin });
    console.log();
    console.log("✓ Link generado para:", email);
    console.log("  caduca:", expiresAt.toISOString());
    console.log();
    console.log(url);
    console.log();
    console.log("Pégalo en el navegador para entrar. Es de un solo uso.");
  } catch (e) {
    console.error(
      "✗ Error:",
      e instanceof Error ? e.message : "error desconocido",
    );
    process.exit(1);
  }
}

main();
