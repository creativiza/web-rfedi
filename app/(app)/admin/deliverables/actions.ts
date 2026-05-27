"use server";

import { z } from "zod";
import { del, put } from "@vercel/blob";
import { DeliverableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/upload/sanitize";

const MAX_BYTES = 5 * 1024 * 1024;

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(DeliverableStatus).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.coerce.number().int().optional(),
});

export async function updateDeliverable(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return { error: "Solo admin." };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status") || undefined,
    title: (formData.get("title") as string | null) || undefined,
    description:
      formData.get("description") === null
        ? undefined
        : (formData.get("description") as string),
    order: formData.get("order") ?? undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { id, ...rest } = parsed.data;
  await prisma.deliverable.update({
    where: { id },
    data: rest,
  });

  revalidatePath("/admin/deliverables");
  revalidatePath("/dashboard");
  revalidatePath(`/deliverables/${id}`);
  return { ok: true };
}

export async function deleteDeliverable(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return { error: "Solo admin." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta id." };

  const d = await prisma.deliverable.findUnique({
    where: { id },
    select: { blobUrl: true },
  });
  if (!d) return { error: "No existe." };

  try {
    await del(d.blobUrl);
  } catch {
    // ignore — DB delete still proceeds, blob can be orphaned and cleaned later
  }

  await prisma.deliverable.delete({ where: { id } });

  revalidatePath("/admin/deliverables");
  revalidatePath("/dashboard");
  return { ok: true };
}

const saveContentSchema = z.object({
  id: z.string().min(1),
  html: z.string().min(1),
  expectedVersion: z.coerce.number().int().nonnegative(),
});

export async function saveDeliverableContent(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return { error: "Solo admin." };

  const parsed = saveContentSchema.safeParse({
    id: formData.get("id"),
    html: formData.get("html"),
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { id, html, expectedVersion } = parsed.data;

  let cleaned;
  try {
    cleaned = sanitizeHtml(html);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fallo al sanitizar." };
  }
  if (cleaned.sizeBytes > MAX_BYTES) {
    return { error: "El contenido supera los 5 MB tras sanear." };
  }

  const current = await prisma.deliverable.findUnique({
    where: { id },
    select: { blobPathname: true, blobUrl: true, documentVersion: true },
  });
  if (!current) return { error: "No existe." };
  if (current.documentVersion !== expectedVersion) {
    return { error: "Otro admin editó este documento. Recarga la página." };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { error: "BLOB_READ_WRITE_TOKEN no configurado." };

  let blob;
  try {
    blob = await put(current.blobPathname, cleaned.html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    return {
      error:
        "No pude subir el HTML: " +
        (e instanceof Error ? e.message : "desconocido"),
    };
  }

  const updated = await prisma.deliverable
    .update({
      where: { id, documentVersion: expectedVersion },
      data: {
        documentVersion: { increment: 1 },
        ...(blob.url !== current.blobUrl ? { blobUrl: blob.url } : {}),
      },
      select: { documentVersion: true },
    })
    .catch(() => null);

  if (!updated) {
    return {
      error: "No pude actualizar la versión. Recarga e intenta de nuevo.",
    };
  }

  revalidatePath(`/deliverables/${id}`);
  revalidatePath("/admin/deliverables");

  return {
    ok: true as const,
    newVersion: updated.documentVersion,
    sanitizeWarning:
      cleaned.removed.dangerousTags > 0
        ? `Se eliminaron ${cleaned.removed.dangerousTags} elementos peligrosos al sanear.`
        : null,
  };
}
