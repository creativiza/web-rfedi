"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { CommentDto } from "@/lib/types";
import { toPinPayload } from "@/lib/types";
import { saveDeliverableContent } from "@/app/(app)/admin/deliverables/actions";
import { CommentSidebar } from "./CommentSidebar";
import { NewCommentDialog } from "./NewCommentDialog";

type Mode = "view" | "comment" | "edit";

const anchorSchema = z.object({
  selectorPath: z.string().min(1),
  offsetXPct: z.number(),
  offsetYPct: z.number(),
  anchorText: z.string().optional().default(""),
  fallbackXPct: z.number(),
  fallbackYPct: z.number(),
  documentVersion: z.number().int().nonnegative().default(1),
  viewportX: z.number().optional(),
  viewportY: z.number().optional(),
});

const incomingMsg = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("READY"),
    source: z.literal("rfedi-bridge"),
    documentVersion: z.number().optional(),
  }),
  z.object({
    type: z.literal("PIN_CREATE"),
    source: z.literal("rfedi-bridge"),
    anchor: anchorSchema,
  }),
  z.object({
    type: z.literal("PIN_CLICK"),
    source: z.literal("rfedi-bridge"),
    pinId: z.string(),
  }),
  z.object({
    type: z.literal("EDIT_SAVE"),
    source: z.literal("rfedi-bridge"),
    html: z.string(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal("EDIT_DIRTY"),
    source: z.literal("rfedi-bridge"),
    dirty: z.boolean(),
  }),
]);

export type PendingAnchor = z.infer<typeof anchorSchema>;

export function Viewer({
  deliverable,
  initialComments,
  currentUser,
}: {
  deliverable: { id: string; title: string; documentVersion: number };
  initialComments: CommentDto[];
  currentUser: {
    id: string;
    role: "ADMIN" | "CLIENT";
    email: string;
    name: string | null;
  };
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<CommentDto[]>(initialComments);
  const [mode, setMode] = useState<Mode>("view");
  const [pending, setPending] = useState<PendingAnchor | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isAdmin = currentUser.role === "ADMIN";

  const togglePresent = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsPresenting(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Warn before unload if there are unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Renumber pinned comments
  const numberedComments = useMemo(() => {
    let i = 0;
    return comments.map((c) => ({
      ...c,
      number: c.anchorKind === "PINNED" ? ++i : null,
    }));
  }, [comments]);

  const postToIframe = useCallback(
    (msg: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({ source: "rfedi-parent", ...msg }, "*");
    },
    [],
  );

  // Push current pins to iframe — but not while editing
  useEffect(() => {
    if (!bridgeReady) return;
    if (mode === "edit") return;
    const pins = numberedComments
      .filter((c) => c.anchorKind === "PINNED")
      .map(toPinPayload);
    postToIframe({ type: "SET_PINS", pins });
  }, [numberedComments, bridgeReady, postToIframe, mode]);

  // Push current mode to iframe
  useEffect(() => {
    if (!bridgeReady) return;
    postToIframe({ type: "SET_MODE", mode });
  }, [mode, bridgeReady, postToIframe]);

  const handleSaveResult = useCallback(
    (html: string) => {
      const fd = new FormData();
      fd.set("id", deliverable.id);
      fd.set("html", html);
      fd.set("expectedVersion", String(deliverable.documentVersion));
      startTransition(async () => {
        const res = await saveDeliverableContent(fd);
        if ("error" in res && res.error) {
          setSaveError(res.error);
          postToIframe({ type: "SAVE_RESULT", ok: false, error: res.error });
          setIsSaving(false);
          return;
        }
        if ("ok" in res && res.ok) {
          postToIframe({
            type: "SAVE_RESULT",
            ok: true,
            newVersion: res.newVersion,
          });
          setIsDirty(false);
          setIsSaving(false);
          if (res.sanitizeWarning) setSaveWarning(res.sanitizeWarning);
          setMode("view");
          router.refresh();
        }
      });
    },
    [deliverable.id, deliverable.documentVersion, postToIframe, router],
  );

  // Listen for messages from iframe
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      // Strict source validation — must come from our iframe
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const parsed = incomingMsg.safeParse(ev.data);
      if (!parsed.success) return;
      const m = parsed.data;

      if (m.type === "READY") {
        setBridgeReady(true);
        // Bridge restarted (e.g. iframe reloaded) — anything we thought was
        // dirty has been thrown away.
        setIsDirty(false);
        return;
      }
      if (m.type === "PIN_CREATE") {
        setPending(m.anchor);
        return;
      }
      if (m.type === "PIN_CLICK") {
        setActive(m.pinId);
        return;
      }
      if (m.type === "EDIT_DIRTY") {
        setIsDirty(m.dirty);
        return;
      }
      if (m.type === "EDIT_SAVE") {
        if (m.error || !m.html) {
          setSaveError(m.error || "No pude serializar el documento.");
          setIsSaving(false);
          return;
        }
        handleSaveResult(m.html);
        return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleSaveResult]);

  // Toggle comment mode (only valid from view)
  const toggleCommentMode = useCallback(() => {
    setMode((m) => (m === "comment" ? "view" : "comment"));
  }, []);

  const handleToggleEdit = useCallback(() => {
    if (mode === "edit") {
      if (isDirty) {
        const ok = window.confirm(
          "Tienes cambios sin guardar. ¿Descartar y salir?",
        );
        if (!ok) return;
        // Reload iframe to discard in-place DOM mutations
        if (iframeRef.current) {
          const src = iframeRef.current.src;
          iframeRef.current.src = src;
        }
        setIsDirty(false);
      }
      setMode("view");
      setSaveError(null);
    } else {
      setMode("edit");
      setSaveError(null);
      setSaveWarning(null);
    }
  }, [mode, isDirty]);

  const handleSave = useCallback(() => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    postToIframe({ type: "REQUEST_SAVE" });
  }, [isDirty, isSaving, postToIframe]);

  const handleCreated = useCallback((newComment: CommentDto) => {
    setComments((prev) => [...prev, newComment]);
    setPending(null);
    setMode("view");
    setActive(newComment.id);
  }, []);

  const handleUpdated = useCallback((updated: CommentDto) => {
    setComments((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...updated, number: c.number } : c)),
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setActive((curr) => (curr === id ? null : curr));
  }, []);

  const handleFocusPin = useCallback(
    (id: string) => {
      setActive(id);
      postToIframe({ type: "SCROLL_TO_PIN", pinId: id });
    },
    [postToIframe],
  );

  const openCount = comments.filter((c) => c.status === "OPEN").length;
  const editing = mode === "edit";

  return (
    <div className="flex-1 flex min-h-0">
      {/* Iframe + toolbar */}
      <div ref={stageRef} className="flex-1 flex flex-col min-w-0 bg-bg-muted">
        {!isPresenting && (
          <div className="border-b border-border-card bg-bg px-4 py-2 flex items-center justify-between gap-3">
            <div className="text-xs text-fg-subtle font-mono uppercase tracking-widest">
              v{deliverable.documentVersion} · {openCount} abierto
              {openCount === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  type="button"
                  onClick={togglePresent}
                  className="rounded-full px-4 py-1.5 text-sm font-semibold border border-border-input text-fg-body hover:border-primary transition-colors"
                  title="Ver a pantalla completa"
                >
                  ⛶ Presentar
                </button>
              )}
              {!editing && (
                <button
                  type="button"
                  onClick={toggleCommentMode}
                  disabled={!bridgeReady}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    mode === "comment"
                      ? "bg-primary text-fg-inverse hover:bg-primary-dark"
                      : "bg-bg-muted text-fg-body border border-border-input hover:border-primary"
                  }`}
                  title="Activa para clicar sobre el documento y dejar un comentario anclado"
                >
                  {mode === "comment" ? "✕ Salir del modo comentario" : "+ Comentar"}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleEdit}
                  disabled={!bridgeReady}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    editing
                      ? "bg-primary text-fg-inverse hover:bg-primary-dark"
                      : "bg-bg-muted text-fg-body border border-border-input hover:border-primary"
                  }`}
                  title="Editar el contenido del entregable"
                >
                  {editing ? "✕ Salir de edición" : "✎ Editar"}
                </button>
              )}
            </div>
          </div>
        )}

        {editing && !isPresenting && (
          <div className="border-b border-border-card bg-primary-ultralight px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono uppercase tracking-widest text-primary-dark">
                Edición activa
              </span>
              <span
                className={
                  isDirty ? "text-warning font-semibold" : "text-fg-subtle"
                }
              >
                {isDirty ? "● Cambios sin guardar" : "✓ Sin cambios"}
              </span>
              {saveError && (
                <span className="text-error font-semibold">{saveError}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleEdit}
                disabled={isSaving}
                className="rounded-full px-4 py-1.5 text-sm font-semibold border border-border-input text-fg-body hover:border-primary transition-colors disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="rounded-full px-4 py-1.5 text-sm font-semibold bg-primary text-fg-inverse hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {saveWarning && !editing && (
          <div className="border-b border-border-card bg-bg px-4 py-2 text-xs text-warning flex items-center justify-between gap-3">
            <span>{saveWarning}</span>
            <button
              type="button"
              onClick={() => setSaveWarning(null)}
              className="text-fg-subtle hover:text-fg"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            key={`${deliverable.id}-${deliverable.documentVersion}`}
            src={`/api/deliverables/${deliverable.id}/render`}
            sandbox="allow-scripts"
            className="absolute inset-0 w-full h-full bg-white"
            title={deliverable.title}
          />
          {mode === "comment" && !isPresenting && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary text-fg-inverse text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none z-10">
              Haz clic donde quieras anclar el comentario
            </div>
          )}
          {isPresenting && (
            <button
              type="button"
              onClick={togglePresent}
              className="absolute top-4 right-4 z-10 rounded-full bg-fg/80 text-fg-inverse text-xs font-semibold px-3 py-1.5 shadow-lg hover:bg-fg transition-colors"
              title="Salir de pantalla completa (Esc)"
            >
              ✕ Salir
            </button>
          )}
        </div>
      </div>

      {/* Sidebar — hidden while presenting or editing */}
      <aside
        className={`w-[380px] shrink-0 border-l border-border-card bg-bg flex flex-col min-h-0 ${
          isPresenting || editing ? "hidden" : ""
        }`}
      >
        <CommentSidebar
          comments={numberedComments}
          activeId={active}
          currentUser={currentUser}
          onFocusPin={handleFocusPin}
          onAddGeneral={() => {
            // SIDE comment — open dialog without an anchor
            setPending({
              selectorPath: "",
              offsetXPct: 0,
              offsetYPct: 0,
              anchorText: "",
              fallbackXPct: 0,
              fallbackYPct: 0,
              documentVersion: deliverable.documentVersion,
            });
          }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      </aside>

      {pending && (
        <NewCommentDialog
          deliverableId={deliverable.id}
          anchor={pending}
          isSide={pending.selectorPath === ""}
          onClose={() => {
            setPending(null);
            setMode("view");
          }}
          onCreated={(c) => startTransition(() => handleCreated(c))}
        />
      )}
    </div>
  );
}
