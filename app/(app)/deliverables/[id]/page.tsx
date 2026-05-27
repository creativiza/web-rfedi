import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toCommentDto } from "@/lib/types";
import { Viewer } from "./Viewer";

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

const TYPE_LABELS: Record<string, string> = {
  PROCESS_MAP: "Mapa de procesos",
  USER_JOURNEY: "User journey",
  DAFO: "DAFO",
  ARCHITECTURE: "Arquitectura",
  PROTOTYPE: "Prototipo",
  REPORT: "Informe",
  OTHER: "Entregable",
};

export default async function DeliverablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const deliverable = await prisma.deliverable.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      status: true,
      documentVersion: true,
      createdAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  if (!deliverable) notFound();
  if (
    deliverable.status !== "PUBLISHED" &&
    session.user.role !== "ADMIN"
  ) {
    notFound();
  }

  const rawComments = await prisma.comment.findMany({
    where: { deliverableId: id },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });

  let pinIdx = 0;
  const comments = rawComments.map((c) => {
    const dto = toCommentDto(c);
    dto.number = c.anchorKind === "PINNED" ? ++pinIdx : null;
    return dto;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-border-card bg-bg">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/dashboard"
                className="text-xs text-fg-subtle hover:text-primary transition-colors"
              >
                ← Entregables
              </Link>
              <span className="text-xs text-fg-subtle">/</span>
              <span className="text-xs uppercase tracking-widest font-mono text-fg-subtle">
                {TYPE_LABELS[deliverable.type] ?? deliverable.type}
              </span>
              {deliverable.status === "DRAFT" && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  Borrador
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-fg truncate font-display">
              {deliverable.title}
            </h1>
            {deliverable.description && (
              <p className="text-sm text-fg-muted mt-1 truncate max-w-3xl">
                {deliverable.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <Viewer
        deliverable={{
          id: deliverable.id,
          title: deliverable.title,
          documentVersion: deliverable.documentVersion,
        }}
        initialComments={comments}
        currentUser={{
          id: session.user.id,
          role: session.user.role,
          email: session.user.email ?? "",
          name: session.user.name ?? null,
        }}
      />
    </div>
  );
}
