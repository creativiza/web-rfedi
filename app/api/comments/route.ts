import { z } from "zod";
import {
  AnchorKind,
  CommentCategory,
} from "@prisma/client";
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
  author: {
    select: { id: true, name: true, email: true, role: true },
  },
  replyBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

// GET /api/comments?deliverableId=xxx
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const deliverableId = url.searchParams.get("deliverableId");
  if (!deliverableId) {
    return new Response("Missing deliverableId", { status: 400 });
  }

  // Confirm the deliverable exists and the user can see it.
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { status: true },
  });
  if (!d) return new Response("Not found", { status: 404 });
  if (d.status !== "PUBLISHED" && session.user.role !== "ADMIN") {
    return new Response("Not found", { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { deliverableId },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });

  // Number pinned comments in creation order
  let pinIdx = 0;
  const dto = comments.map((c) => {
    const d = toCommentDto(c);
    d.number = c.anchorKind === "PINNED" ? ++pinIdx : null;
    return d;
  });

  return Response.json({ comments: dto });
}

const createSchema = z.discriminatedUnion("anchorKind", [
  z.object({
    deliverableId: z.string().min(1),
    body: z.string().min(1).max(2000),
    category: z.nativeEnum(CommentCategory).default(CommentCategory.NOTE),
    anchorKind: z.literal(AnchorKind.SIDE),
  }),
  z.object({
    deliverableId: z.string().min(1),
    body: z.string().min(1).max(2000),
    category: z.nativeEnum(CommentCategory).default(CommentCategory.NOTE),
    anchorKind: z.literal(AnchorKind.PINNED),
    selectorPath: z.string().min(1).max(500),
    offsetXPct: z.number().min(-2).max(2),
    offsetYPct: z.number().min(-2).max(2),
    anchorText: z.string().max(200).optional(),
    fallbackXPct: z.number().min(-2).max(2),
    fallbackYPct: z.number().min(-2).max(2),
    documentVersion: z.number().int().nonnegative().default(1),
  }),
]);

// POST /api/comments
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Confirm deliverable + visibility
  const d = await prisma.deliverable.findUnique({
    where: { id: data.deliverableId },
    select: { status: true, documentVersion: true },
  });
  if (!d) return new Response("Not found", { status: 404 });
  if (d.status !== "PUBLISHED" && session.user.role !== "ADMIN") {
    return new Response("Not found", { status: 404 });
  }

  const created = await prisma.comment.create({
    data: {
      deliverableId: data.deliverableId,
      authorId: session.user.id,
      body: data.body.trim(),
      category: data.category,
      anchorKind: data.anchorKind,
      selectorPath:
        data.anchorKind === "PINNED" ? data.selectorPath : null,
      offsetXPct: data.anchorKind === "PINNED" ? data.offsetXPct : null,
      offsetYPct: data.anchorKind === "PINNED" ? data.offsetYPct : null,
      anchorText:
        data.anchorKind === "PINNED" ? data.anchorText ?? null : null,
      fallbackXPct:
        data.anchorKind === "PINNED" ? data.fallbackXPct : null,
      fallbackYPct:
        data.anchorKind === "PINNED" ? data.fallbackYPct : null,
      documentVersion:
        data.anchorKind === "PINNED"
          ? data.documentVersion ?? d.documentVersion
          : null,
    },
    select: commentSelect,
  });

  return Response.json({ comment: toCommentDto(created) }, { status: 201 });
}
