import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a one-use magic link for the given email.
 *
 * Mirrors what NextAuth's email flow does internally:
 *   - random 32-char token in the URL
 *   - sha256(token + AUTH_SECRET) stored in VerificationToken
 *   - URL points to /api/auth/callback/<provider-id>?token=...&email=...
 *
 * The admin copies the returned URL and sends it to the user manually.
 */
export async function generateAccessLink({
  email,
  origin,
  callbackUrl = "/dashboard",
  maxAgeMs = ONE_DAY_MS,
}: {
  email: string;
  origin: string;
  callbackUrl?: string;
  maxAgeMs?: number;
}): Promise<{ url: string; expiresAt: Date }> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET not set");
  }
  const normalizedEmail = email.toLowerCase().trim();

  // Make sure the user exists — invite-only enforcement.
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No existe ningún usuario con email ${normalizedEmail}.`);
  }

  // 32 chars hex == 16 random bytes
  const token = randomBytes(16).toString("hex");
  const tokenHash = createHash("sha256")
    .update(`${token}${secret}`)
    .digest("hex");
  const expires = new Date(Date.now() + maxAgeMs);

  // Clean up previous unused tokens for this identifier — keep one valid link
  await prisma.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token: tokenHash,
      expires,
    },
  });

  const params = new URLSearchParams({
    token,
    email: normalizedEmail,
    callbackUrl,
  });
  // Point to the interstitial page rather than the NextAuth callback
  // directly. The interstitial is a static-looking HTML page that does NOT
  // consume the token on a plain GET — only a real human click triggers
  // the actual login. This prevents email/messenger link-preview bots
  // (WhatsApp, Slack, iMessage, Outlook safe-links…) from burning the
  // one-shot token before the user opens the link.
  const url = `${origin.replace(/\/$/, "")}/login/confirm?${params}`;

  return { url, expiresAt: expires };
}
