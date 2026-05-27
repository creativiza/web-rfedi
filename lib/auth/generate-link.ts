import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const PROVIDER_ID = "link"; // must match ManualLinkProvider.id in auth.ts
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
    callbackUrl,
    token,
    email: normalizedEmail,
  });
  const url = `${origin.replace(/\/$/, "")}/api/auth/callback/${PROVIDER_ID}?${params}`;

  return { url, expiresAt: expires };
}
