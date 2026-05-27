import { readFileSync } from "node:fs";
import { join } from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Read bridge.js once at module load — Node will keep it in memory across requests.
const BRIDGE_JS = readFileSync(
  join(process.cwd(), "public", "bridge.js"),
  "utf8",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      blobUrl: true,
      documentVersion: true,
    },
  });

  if (!deliverable) {
    return new Response("Not found", { status: 404 });
  }

  // Clients can only see PUBLISHED deliverables
  if (
    deliverable.status !== "PUBLISHED" &&
    session.user.role !== "ADMIN"
  ) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch the raw HTML from Blob. Append ?v={documentVersion} to break the
  // CDN cache after an in-app edit overwrites the same pathname.
  let html: string;
  try {
    const blobUrl = new URL(deliverable.blobUrl);
    blobUrl.searchParams.set("v", String(deliverable.documentVersion));
    const r = await fetch(blobUrl.toString(), { cache: "no-store" });
    if (!r.ok) {
      return new Response("Upstream error fetching HTML", { status: 502 });
    }
    html = await r.text();
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  // Inline the bridge — inlined (not <script src>) to keep working under
  // the strict iframe sandbox we apply on the parent side.
  // data-rfedi-injected lets serializeClean() in the bridge identify and
  // strip these scripts before sending the edited HTML back to the server.
  const injection =
    `<script data-rfedi-injected="1">window.__deliverable=${JSON.stringify({
      id: deliverable.id,
      version: deliverable.documentVersion,
    })};</script>` +
    `<script data-rfedi-injected="1">${BRIDGE_JS}</script>`;

  const injected = html.includes("</body>")
    ? html.replace("</body>", `${injection}</body>`)
    : html + injection;

  return new Response(injected, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      // Defense in depth — restrict what the inner doc can load.
      "Content-Security-Policy":
        "default-src 'self' data: blob: https:; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https:; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data: https:; " +
        "frame-ancestors 'self';",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
