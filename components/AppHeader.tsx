import Link from "next/link";
import type { Role } from "@prisma/client";
import { signOut } from "@/auth";

export function AppHeader({
  user,
}: {
  user: { email: string; name: string | null; role: Role };
}) {
  const isAdmin = user.role === "ADMIN";
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-border-card bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-fg"
        >
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-fg-inverse text-sm">
            ✦
          </span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-fg-subtle">
              Creativiza × RFEDI
            </span>
            <span className="text-sm font-bold">Delivery</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/dashboard">Entregables</NavLink>
          {isAdmin && (
            <>
              <NavLink href="/admin/upload">Subir</NavLink>
              <NavLink href="/admin/deliverables">Gestionar</NavLink>
              <NavLink href="/admin/users">Usuarios</NavLink>
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-fg">
              {user.name ?? user.email.split("@")[0]}
            </span>
            <span className="text-[11px] font-mono tracking-wider uppercase text-fg-subtle">
              {user.role === "ADMIN" ? "Admin" : "Cliente"}
            </span>
          </div>
          <div className="grid place-items-center h-9 w-9 rounded-full bg-primary-ultralight text-primary text-xs font-semibold">
            {initials}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-fg-subtle hover:text-primary transition-colors px-2 py-1"
              aria-label="Cerrar sesión"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors"
    >
      {children}
    </Link>
  );
}
