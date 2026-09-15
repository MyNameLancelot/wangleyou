import type { Photo } from '../content';
export type Session = { photos: Photo[]; index: number } | null;
export function openSession(photos: Photo[], id: string): Session {
  const index = photos.findIndex(photo => photo.id === id);
  return index === -1 ? null : { photos: [...photos], index };
}
export function stepSession(session: Session, delta: number): Session {
  if (!session || !Number.isInteger(delta)) return session;
  const index = session.index + delta;
  return index < 0 || index >= session.photos.length ? session : { ...session, index };
}
