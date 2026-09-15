export type Route = { kind: 'home' } | { kind: 'album'; id: string } | { kind: 'not-found' };
export function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/') return { kind: 'home' };
  try {
    const match = /^#\/albums\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(decodeURIComponent(hash));
    return match ? { kind: 'album', id: match[1] } : { kind: 'not-found' };
  } catch { return { kind: 'not-found' }; }
}
