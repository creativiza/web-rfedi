import type {
  AnchorKind,
  CommentCategory,
  CommentStatus,
  Role,
} from "@prisma/client";

export type CommentDto = {
  id: string;
  body: string;
  category: CommentCategory;
  status: CommentStatus;
  anchorKind: AnchorKind;
  number: number | null; // 1-based ordinal for pinned comments
  selectorPath: string | null;
  offsetXPct: number | null;
  offsetYPct: number | null;
  anchorText: string | null;
  fallbackXPct: number | null;
  fallbackYPct: number | null;
  documentVersion: number | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
  };
  reply: string | null;
  replyBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  replyAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PinPayload = {
  id: string;
  number: number | null;
  selectorPath: string | null;
  offsetXPct: number | null;
  offsetYPct: number | null;
  anchorText: string | null;
  fallbackXPct: number | null;
  fallbackYPct: number | null;
  status: CommentStatus;
  title?: string;
};

export function toCommentDto(c: {
  id: string;
  body: string;
  category: CommentCategory;
  status: CommentStatus;
  anchorKind: AnchorKind;
  selectorPath: string | null;
  offsetXPct: number | null;
  offsetYPct: number | null;
  anchorText: string | null;
  fallbackXPct: number | null;
  fallbackYPct: number | null;
  documentVersion: number | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
  };
  reply: string | null;
  replyBy: { id: string; name: string | null; email: string } | null;
  replyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CommentDto {
  return {
    ...c,
    number: null,
    reply: c.reply,
    replyBy: c.replyBy,
    replyAt: c.replyAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toPinPayload(c: CommentDto): PinPayload {
  return {
    id: c.id,
    number: c.number,
    selectorPath: c.selectorPath,
    offsetXPct: c.offsetXPct,
    offsetYPct: c.offsetYPct,
    anchorText: c.anchorText,
    fallbackXPct: c.fallbackXPct,
    fallbackYPct: c.fallbackYPct,
    status: c.status,
    title: c.body.slice(0, 60),
  };
}
