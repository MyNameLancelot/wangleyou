import type { Route } from '../shared';

export type { Route };
export function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/') return { kind: 'home' };
  if (hash === '#/browse') return { kind: 'browse' };
  if (hash === '#/albums') return { kind: 'albums' };
  try {
    const match = /^#\/albums\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(decodeURIComponent(hash));
    return match ? { kind: 'album', id: match[1] } : { kind: 'not-found' };
  } catch { return { kind: 'not-found' }; }
}
