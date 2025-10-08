import type { PropsWithChildren } from 'react';

type LayoutProps = PropsWithChildren<{ className?: string }>;

function mergeClassNames(base: string, extra?: string) {
  if (!extra) {
    return base;
  }

  return `${base} ${extra}`;
}

export function AppShell({ children, className }: LayoutProps) {
  return <div className={mergeClassNames('app-shell', className)}>{children}</div>;
}

export function AppShellHeader({ children, className }: LayoutProps) {
  return <header className={mergeClassNames('app-shell__header', className)}>{children}</header>;
}

export function AppShellSidebar({ children, className }: LayoutProps) {
  return <aside className={mergeClassNames('app-shell__sidebar', className)}>{children}</aside>;
}

export function AppShellBody({ children, className }: LayoutProps) {
  return <main className={mergeClassNames('app-shell__body', className)}>{children}</main>;
}


