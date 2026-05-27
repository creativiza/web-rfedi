# RFEDI Delivery

App para entregar la propuesta de consultoría Creativiza × RFEDI: los admins suben entregables HTML (mapas de procesos, user journeys, DAFOs, arquitecturas, prototipos) y el cliente los revisa y comenta sobre ellos en línea.

- **Comentarios anclados**: activa "Modo comentario" y haz clic sobre cualquier punto del documento para dejar un pin. El comentario queda anclado al elemento concreto.
- **Comentarios generales**: en el panel lateral, sin anclar a un punto.
- **Categorías + estado**: cada comentario lleva categoría (pregunta / cambio / OK / nota) y estado (abierto / resuelto). El admin responde en línea.
- **Solo invitación, enlaces manuales**: no hay signups públicos ni envío automático de emails. El admin genera un enlace de un solo uso desde `/admin/users` y lo manda por WhatsApp, email, lo que prefiera.

---

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- NextAuth v5 (provider de email custom, sin envío automático)
- Prisma 6 + Neon Postgres
- Vercel Blob (almacena los HTML)
- Tailwind v4 (tokens Creativiza en `app/globals.css`)

---

## Setup local (~5 minutos)

### 1. Servicios externos

Necesitas cuentas en:

- **Neon** ([console.neon.tech](https://console.neon.tech/)): crea un proyecto Postgres. Copia las dos URLs:
  - *Pooled* connection string → `DATABASE_URL`
  - *Direct* (unpooled) → `DIRECT_URL`
- **Vercel** ([vercel.com](https://vercel.com)): crea un proyecto y añade un **Blob Store** (Storage → Blob → Create). Copia el `BLOB_READ_WRITE_TOKEN`.

### 2. Variables de entorno

Copia y rellena `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
# luego edita .env.local con tus claves
```

Las claves obligatorias son:
- `DATABASE_URL` y `DIRECT_URL` (Neon)
- `AUTH_SECRET` (ya viene generado; si no, `openssl rand -base64 32`)
- `AUTH_URL` (`http://localhost:3000` en dev; tu dominio real en prod — se usa para construir los enlaces)
- `BLOB_READ_WRITE_TOKEN`
- `SEED_ADMIN_EMAILS` — uno o más emails (separados por coma) que recibirán rol ADMIN al sembrar

### 3. Base de datos

```bash
npm install
npx prisma db push          # crea las tablas en Neon
npm run db:seed             # crea los admins listados en SEED_ADMIN_EMAILS
```

### 4. Genera tu enlace de admin y entra

```bash
npm run admin:link -- alberto@gridfy.ai
```

Pega el enlace que sale en el navegador → estás dentro.

```bash
npm run dev
```

---

## Cómo dar acceso a un nuevo usuario

1. Entra a [/admin/users](http://localhost:3000/admin/users)
2. Rellena email, nombre opcional y rol (Cliente / Admin) → "Crear usuario + generar enlace"
3. Copia el enlace que aparece (o usa los botones "Compartir por WhatsApp" / "Enviar por email" que abren el cliente del sistema con el texto pre-rellenado)
4. El usuario hace clic en el enlace → entra. El enlace es de un solo uso y caduca a las 24h.

Para regenerar un enlace cuando uno caduca, pulsa "Generar enlace" junto al usuario en la lista.

**Emergencia / locked-out admin:** si tú mismo te quedas fuera, usa el CLI:

```bash
npm run admin:link -- tu@email.com
# en producción con AUTH_URL ya configurado, sale el enlace de prod
# si no, pasa el origin como segundo argumento:
npm run admin:link -- tu@email.com https://rfedi.creativiza.es
```

---

## Flujo de uso

1. **Admin** entra → genera enlace para el cliente en `/admin/users` → lo manda por WhatsApp
2. **Cliente** abre el enlace → ya está dentro, ve el dashboard
3. **Admin** sube un `.html` (autocontenido) en `/admin/upload`
4. **Cliente** abre el entregable → activa "Modo comentario" → clic sobre un punto → escribe → guarda
5. **Admin** ve el pin numerado, responde, marca como resuelto

---

## Arquitectura técnica clave: el bridge del iframe

El HTML del cliente se renderiza en un `<iframe sandbox="allow-scripts">`. El servidor (`app/api/deliverables/[id]/render/route.ts`) proxea el contenido desde Vercel Blob e **inyecta `public/bridge.js`** justo antes del `</body>`.

El bridge:
- Escucha clics en el documento y, en modo comentario, envía al padre via `postMessage` la posición (`selectorPath + offsetXPct/YPct`) más fallbacks (`anchorText`, coords %).
- Recibe del padre la lista de pins y los pinta como círculos numerados absolutos sobre el body.
- Maneja pins **stale** (selector ok pero el texto cambió) y **orphan** (selector roto) con colores distintos para que sea visible cuándo el HTML ha cambiado bajo un comentario.

Los mensajes del iframe se validan con **Zod** y se filtran por `event.source === iframeRef.contentWindow` en el padre.

---

## Despliegue en Vercel

1. Conecta el repo a Vercel (`vercel link` o desde el dashboard).
2. **Storage** → añade Neon Postgres + Blob Store al proyecto. Las variables `DATABASE_URL`, `DIRECT_URL`, `BLOB_READ_WRITE_TOKEN` se inyectan solas.
3. Añade manualmente: `AUTH_SECRET`, `AUTH_URL` (tu dominio prod), `SEED_ADMIN_EMAILS`.
4. Primera vez: en local con `vercel env pull`, sincroniza el `.env.local` con prod y ejecuta:
   ```bash
   npx prisma db push
   npm run db:seed
   npm run admin:link -- tu@email.com   # te imprime el primer enlace de prod
   ```

El `postinstall` ya corre `prisma generate` automáticamente en cada build.

---

## Comandos útiles

```bash
npm run dev               # dev server
npm run build             # producción
npm run lint              # eslint
npm run db:push           # sincroniza schema sin migraciones formales
npm run db:migrate        # crea migración formal (recomendado para prod)
npm run db:seed           # crea admins desde SEED_ADMIN_EMAILS
npm run db:studio         # GUI de Prisma
npm run admin:link -- <email>   # genera un enlace de acceso para ese email
```

---

## Estructura

```
app/
├── (auth)/login/...              # info de acceso + error pages
├── (app)/
│   ├── layout.tsx                 # auth guard
│   ├── dashboard/                 # índice público (autenticado)
│   ├── deliverables/[id]/         # visor con iframe + sidebar de comentarios
│   └── admin/
│       ├── layout.tsx             # role guard
│       ├── upload/                # subir nuevo HTML
│       ├── users/                 # generar enlaces / gestionar usuarios
│       └── deliverables/          # publicar / archivar / eliminar
├── api/
│   ├── auth/[...nextauth]/        # NextAuth route (callback consume el token)
│   ├── deliverables/[id]/render/  # proxy + inyección del bridge
│   └── comments/                  # CRUD de comentarios
components/                        # UI compartida
lib/                               # auth/, upload/, db.ts, types.ts, slug.ts
prisma/                            # schema.prisma + seed.ts
public/bridge.js                   # script inyectado en cada iframe
scripts/admin-link.ts              # CLI de bootstrap
auth.ts                            # NextAuth config (provider manual, sin envío)
```

---

## Roadmap (no en MVP)

- Real-time (Pusher / WebSockets) para colaboración en vivo
- Versionado diff visual entre subidas de un mismo entregable
- Export de comentarios a CSV
- Búsqueda full-text de comentarios
- Hilos de replies (hoy solo una reply de admin por comentario)
