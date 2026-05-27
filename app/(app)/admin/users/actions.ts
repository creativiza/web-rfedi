"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateAccessLink } from "@/lib/auth/generate-link";
import { revalidatePath } from "next/cache";

async function getOrigin(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const createUserSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  role: z.nativeEnum(Role),
});

/**
 * Create a user (if new) and generate a one-use access link.
 * The link is returned so the admin can copy & share it manually.
 */
export async function inviteAndGenerateLink(formData: FormData): Promise<
  | { error: string; link?: undefined; email?: undefined; expiresAt?: undefined }
  | { error?: undefined; link: string; email: string; expiresAt: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Solo admin." };
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: (formData.get("name") as string | null) || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== parsed.data.role) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: parsed.data.role },
      });
    }
  } else {
    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name || null,
        role: parsed.data.role,
        emailVerified: new Date(),
      },
    });
  }

  let link;
  try {
    link = await generateAccessLink({ email, origin: await getOrigin() });
  } catch (e) {
    return {
      error:
        "Usuario creado, pero no pude generar el enlace: " +
        (e instanceof Error ? e.message : "error desconocido"),
    };
  }

  revalidatePath("/admin/users");
  return {
    link: link.url,
    email,
    expiresAt: link.expiresAt.toISOString(),
  };
}

/**
 * Regenerate a fresh access link for an existing user (any role).
 * Invalidates previous unused tokens for the same email.
 */
export async function regenerateLink(
  formData: FormData,
): Promise<
  | { error: string; link?: undefined; expiresAt?: undefined }
  | { error?: undefined; link: string; expiresAt: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Solo admin." };
  }
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Falta userId." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return { error: "El usuario ya no existe." };

  try {
    const link = await generateAccessLink({
      email: user.email,
      origin: await getOrigin(),
    });
    return { link: link.url, expiresAt: link.expiresAt.toISOString() };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error generando enlace.",
    };
  }
}

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
});

export async function updateUserRole(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Solo admin." };
  }
  const parsed = updateSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Datos inválidos." };

  if (parsed.data.userId === session.user.id && parsed.data.role === "CLIENT") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { error: "No puedes dejar el equipo sin admin." };
    }
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Solo admin." };
  }
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Falta userId." };

  if (userId === session.user.id) {
    return { error: "No te puedes borrar a ti mismo." };
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}
