import type { ReactNode } from 'react';

interface Props {
  title: string;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Layout({ title, back, right, children, footer }: Props) {
  return (
    <div className="app">
      <header className="topbar">
        {back ? (
          <a className="back" href={`#${back}`} aria-label="Voltar">
            ‹
          </a>
        ) : (
          <span className="back-spacer" />
        )}
        <h1>{title}</h1>
        <div className="topbar-right">{right}</div>
      </header>
      <main className="content">{children}</main>
      {footer && <div className="bottombar">{footer}</div>}
    </div>
  );
}
