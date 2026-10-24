import { useEffect, useState } from 'react';

function parse(): string[] {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0].split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [parts, setParts] = useState<string[]>(parse());
  useEffect(() => {
    const onChange = () => {
      setParts(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
