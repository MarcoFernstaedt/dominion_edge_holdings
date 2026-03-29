import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center space-y-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">Page not found</div>
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">Wrong door.</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          The page you asked for does not exist in the QLA operating system.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/command-center" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
            Command Center
          </Link>
          <Link href="/playbook/today" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
            Today&apos;s Actions
          </Link>
        </div>
      </div>
    </div>
  );
}
