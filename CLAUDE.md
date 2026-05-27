@AGENTS.md

# RFEDI Delivery — project notes

Entrega de la propuesta de consultoría Creativiza × RFEDI (abril 2026). App donde los admins suben entregables HTML (mapas de procesos, user journeys, DAFOs, etc.) y el cliente comenta sobre ellos. Plan completo en `/Users/albertosanchez/.claude/plans/hola-voy-a-dise-ar-iterative-pinwheel.md`.

## Stack

- Next.js **16.2.6** (App Router) + React 19.2.4 — ¡no es el Next 14/15 de tu training! Lee `node_modules/next/dist/docs/` antes de tocar APIs.
- Tailwind CSS v4 (config en `app/globals.css` con `@theme inline`, no `tailwind.config.ts`)
- NextAuth v5 (5.0.0-beta.31), magic link **sin envío automático** (admin genera + comparte manualmente)
- Prisma 6 + Neon Postgres
- Vercel Blob para HTML subidos
- Zod, isomorphic-dompurify, node-html-parser

## Breaking changes a recordar (Next 16)

- `params` y `searchParams` son **Promise** en pages y route handlers. Hay que `await params`.
- `cookies()`, `headers()` de `next/headers` son async.
- Route handler signature: `export async function GET(req, { params }: { params: Promise<{ id: string }> })`

## Idioma

Toda la UI en **español castellano**. Tono del PDF de propuesta (directo, sin jerga, frases cortas). Ejemplos: "Lo que nos contó Paco", "4 líneas que se alimentan entre sí".

## Marca

- Magenta `#e51568` (acento clave)
- Fondo claro, fuentes: Montserrat (display), Inter (body), JetBrains Mono (mono)
- Tokens en `app/globals.css` expuestos a Tailwind via `@theme inline`. Usar `bg-primary`, `text-fg`, `font-display`, etc.

## Decisión técnica clave — iframe + comentarios anclados

- HTML servido por proxy **same-origin** en `app/api/deliverables/[id]/render/route.ts` (no Blob directo)
- Bridge inyectado en **render-time** (`<script src="/bridge.js">` antes de `</body>`)
- Sanitización en **upload-time** con DOMPurify + node-html-parser
- Anchor cascada: `selectorPath + offset` → `anchorText` match → `fallbackXPct/YPct` → orphan
- Pin overlay vive **dentro del iframe** (cero sincronización de coords entre frames)
- `postMessage` validado con Zod + `event.source === iframeRef.contentWindow`
- Sandbox: `sandbox="allow-scripts"` sin `allow-same-origin`

## Modelo de roles

- **ADMIN** (2 personas): sube entregables, invita usuarios, responde y resuelve comentarios
- **CLIENT** (N personas): lee entregables, comenta (lateral o anclado)

## Auth — flujo de enlaces manuales

- El admin genera enlaces de acceso desde `/admin/users` (botón "Generar enlace") o creando un usuario nuevo. La app devuelve la URL → admin la copia y la manda por WhatsApp/email/lo que sea.
- Internamente, `lib/auth/generate-link.ts` clona la lógica de NextAuth: crea token aleatorio, almacena `sha256(token + AUTH_SECRET)` en `VerificationToken`, y devuelve `/api/auth/callback/link?token=...&email=...&callbackUrl=...`.
- El provider en `auth.ts` se llama `"link"` y su `sendVerificationRequest` es no-op (solo logea en dev).
- **Bootstrap / emergencia**: `npm run admin:link -- <email>` imprime un enlace fresco en la terminal. Útil si el único admin pierde el acceso.

## Comandos útiles

```bash
npm run dev                              # dev server
npx prisma migrate dev --name <nombre>   # nueva migración
npx prisma studio                        # GUI de la DB
npx prisma db seed                       # sembrar admins iniciales
npm run admin:link -- <email>            # imprime enlace de acceso en consola
```
