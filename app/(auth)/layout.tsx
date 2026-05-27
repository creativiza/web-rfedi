import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-muted">
      <header className="border-b border-border-card bg-bg">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="t-overline">
            <span className="text-fg">Creativiza</span>
            <span className="text-fg-subtle"> × RFEDI</span>
          </Link>
          <span className="t-mono text-fg-subtle hidden sm:inline">
            Delivery 2026
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border-card bg-bg">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-xs text-fg-subtle">
          <span>Creativiza Creative Lab × RFEDI · 2026</span>
          <span>
            <a
              href="mailto:hola@creativiza.es"
              className="hover:text-primary transition-colors"
            >
              hola@creativiza.es
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
