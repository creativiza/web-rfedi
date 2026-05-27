import { z } from "zod";
import { CommentCategory, CommentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toCommentDto } from "@/lib/types";

const commentSelect = {
  id: true,
  body: true,
  category: true,
  status: true,
  anchorKind: true,
  selectorPath: true,
  offsetXPct: true,
  offsetYPct: true,
  anchorText: true,
  fallbackXPct: true,
  fallbackYPct: true,
  documentVersion: true,
  reply: true,
  replyAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true, role: true } },
  replyBy: { select: { id: true, name: true, email: true } },
} as const;

const patchSchema = z.object({
  body: z.string().min(1).max(2000).optional(),
  category: z.nativeEnum(CommentCategory).optional(),
  status: z.nativeEnum(CommentStatus).optional(),
  reply: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) return new Response("Not found", { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const isAuthor = existing.authorId === session.user.id;

  // Permission matrix:
  // - body / category: author or admin
  // - status (resolve/reopen): admin only
  // - reply: admin only
  const d = parsed.data;
  const update: Parameters<typeof prisma.comment.update>[0]["data"] = {};

  if (d.body !== undefined) {
    if (!isAuthor && !isAdmin)
      return new Response("Forbidden", { status: 403 });
    update.body = d.body.trim();
  }
  if (d.category !== undefined) {
    if (!isAuthor && !isAdmin)
      return new Response("Forbidden", { status: 403 });
    update.category = d.category;
  }
  if (d.status !== undefined) {
    if (!isAdmin) return new Response("Forbidden", { status: 403 });
    update.status = d.status;
  }
  if (d.reply !== undefined) {
    if (!isAdmin) return new Response("Forbidden", { status: 403 });
    if (d.reply === null || d.reply.trim() === "") {
      update.reply = null;
      update.replyById = null;
      update.replyAt = null;
    } else {
      update.reply = d.reply.trim();
      update.replyById = session.user.id;
      update.replyAt = new Date();
    }
  }

  if (Object.keys(update).length === 0) {
    return new Response("No fields to update", { status: 400 });
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: update,
    select: commentSelect,
  });

  return Response.json({ comment: toCommentDto(updated) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) return new Response("Not found", { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const isAuthor = existing.authorId === session.user.id;
  if (!isAdmin && !isAuthor) return new Response("Forbidden", { status: 403 });

  await prisma.comment.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
