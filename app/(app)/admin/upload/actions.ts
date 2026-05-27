"use server";

import { z } from "zod";
import { put } from "@vercel/blob";
import { DeliverableType, DeliverableStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sanitizeHtml } from "@/lib/upload/sanitize";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  title: z.string().min(1, "El título es obligatorio.").max(200),
  type: z.nativeEnum(DeliverableType),
  description: z.string().max(500).optional(),
  publish: z.enum(["0", "1"]).default("1"),
});

export type UploadResult =
  | { error: string; deliverableId?: undefined }
  | { error?: undefined; deliverableId: string };

export async function uploadDeliverable(
  formData: FormData,
): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Solo los admin pueden subir entregables." };
  }

  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    description: formData.get("description") || undefined,
    publish: formData.get("publish") ?? "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Falta el archivo HTML." };
  }
  if (file.size === 0) return { error: "El archivo está vacío." };
  if (file.size > MAX_BYTES) return { error: "El archivo supera los 5 MB." };

  let rawHtml: string;
  try {
    rawHtml = await file.text();
  } catch {
    return { error: "No pude leer el archivo." };
  }

  let cleaned;
  try {
    cleaned = sanitizeHtml(rawHtml);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Fallo al sanitizar el HTML.",
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      error:
        "BLOB_READ_WRITE_TOKEN no está configurado. Añádelo en .env.local o en Vercel.",
    };
  }

  // Slug — make it unique by appending a short suffix if it collides
  const baseSlug = slugify(parsed.data.title);
  const slug = await uniqueSlug(baseSlug);

  // Path inside blob store: deliverables/<slug>/v1.html
  const pathname = `deliverables/${slug}/v1.html`;

  let blob;
  try {
    blob = await put(pathname, cleaned.html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  } catch (e) {
    return {
      error:
        "No pude subir a Vercel Blob: " +
        (e instanceof Error ? e.message : "error desconocido"),
    };
  }

  const status =
    parsed.data.publish === "1"
      ? DeliverableStatus.PUBLISHED
      : DeliverableStatus.DRAFT;

  const deliverable = await prisma.deliverable.create({
    data: {
      title: parsed.data.title,
      slug,
      type: parsed.data.type,
      description: parsed.data.description,
      blobUrl: blob.url,
      blobPathname: pathname,
      documentVersion: 1,
      status,
      uploadedById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin/deliverables");

  return { deliverableId: deliverable.id };
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.deliverable.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  }
  // unlikely fallback
  return `${base}-${Date.now()}`;
}
