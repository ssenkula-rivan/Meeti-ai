'use client';

/* The dashboard layout now renders the persistent sidebar and top bar for every
   page, so AppShell is reduced to a plain content wrapper. */
export function AppShell({ children }: { children: React.ReactNode; userName?: string; userEmail?: string; search?: React.ReactNode }) {
  return <main className="flex-1 px-6 py-8">{children}</main>;
}
