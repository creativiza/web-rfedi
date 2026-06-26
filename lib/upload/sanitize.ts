import { parse, HTMLElement } from "node-html-parser";

/**
 * Sanitize HTML uploaded by an admin before storing it in Blob.
 *
 * Trust model: admins are trusted but defense-in-depth applies.
 * The iframe that renders this HTML uses `sandbox="allow-scripts"` (no
 * `allow-same-origin`), which already neutralizes most XSS risk against
 * the parent app. This pass strips the remaining tricky vectors:
 *   - <base> rewrites relative URLs inside the iframe (could break bridge)
 *   - <object>/<embed>/<applet>/<frame> can frame third parties / leak
 *   - <meta http-equiv="refresh"> causes navigation loops
 *   - inline event handlers (onclick, onerror, …) — replaced by <script> if needed
 *   - javascript: / data:text/html URLs in href/src/action
 *
 * Nested <iframe> is allowed only via `srcdoc` (inline content, no network):
 * any `src` attribute is stripped, and a `sandbox` without `allow-same-origin`
 * is forced. Used by index-style deliverables that embed sub-prototypes.
 *
 * <script> and <style> tags are kept on purpose: interactive prototypes
 * (process maps, user journeys) often rely on small JS for animations.
 */

const DANGEROUS_TAGS = new Set([
  "base",
  "object",
  "embed",
  "applet",
  "frame",
  "frameset",
]);

const IFRAME_SAFE_SANDBOX = "allow-scripts";

const URL_ATTRS = new Set(["href", "src", "action", "formaction"]);

function isDangerousUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("javascript:") ||
    v.startsWith("vbscript:") ||
    v.startsWith("data:text/html")
  );
}

function clean(node: HTMLElement): void {
  // Recurse over a snapshot of children since we mutate during traversal
  for (const child of [...node.childNodes]) {
    if (!(child instanceof HTMLElement)) continue;

    const tag = child.tagName?.toLowerCase();

    if (tag && DANGEROUS_TAGS.has(tag)) {
      child.remove();
      continue;
    }

    if (tag === "iframe") {
      // Allow nested iframes only with `srcdoc` (inline). No external loads.
      child.removeAttribute("src");
      child.setAttribute("sandbox", IFRAME_SAFE_SANDBOX);
      if (!child.getAttribute("srcdoc")) {
        // No inline content → nothing to render, drop it.
        child.remove();
        continue;
      }
    }

    if (tag === "meta") {
      const httpEquiv = child.getAttribute("http-equiv")?.toLowerCase();
      if (httpEquiv === "refresh") {
        child.remove();
        continue;
      }
    }

    // Strip inline event handlers (any attr starting with "on")
    // and dangerous URLs.
    const attrs = child.attributes;
    for (const name of Object.keys(attrs)) {
      const lower = name.toLowerCase();
      if (lower.startsWith("on")) {
        child.removeAttribute(name);
        continue;
      }
      if (URL_ATTRS.has(lower)) {
        const val = attrs[name];
        if (val && isDangerousUrl(val)) {
          child.removeAttribute(name);
        }
      }
    }

    clean(child);
  }
}

export type SanitizeResult = {
  html: string;
  sizeBytes: number;
  removed: { dangerousTags: number };
};

export function sanitizeHtml(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("HTML vacío.");
  }

  const root = parse(trimmed, {
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true,
    },
  });

  // Count to be removed (best-effort, before mutation)
  const dangerous = root.querySelectorAll(
    [...DANGEROUS_TAGS].join(","),
  ).length;

  clean(root);

  // Normalize: ensure there is an <html><head><body> shell.
  // node-html-parser preserves whatever was parsed, so if the upload was
  // a fragment we wrap it minimally. Otherwise we leave structure alone.
  let html = root.toString();
  if (!/<html[\s>]/i.test(html)) {
    html = `<!doctype html>\n<html lang="es">\n<head><meta charset="utf-8"></head>\n<body>\n${html}\n</body>\n</html>`;
  } else if (!/<!doctype/i.test(html)) {
    html = `<!doctype html>\n${html}`;
  }

  return {
    html,
    sizeBytes: Buffer.byteLength(html, "utf8"),
    removed: { dangerousTags: dangerous },
  };
}
