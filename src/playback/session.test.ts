import { describe, expect, it } from 'vitest';
import { openSession, stepSession } from './session';
import type { Photo } from '../content';
const photos: Photo[] = ['one', 'two', 'three'].map(id => ({ id, type: 'photo', src: `${id}.jpg` }));
describe('photo session', () => {
  it('opens the selected photo without mutating the queue', () => {
    const session = openSession(photos, 'two');
    expect(session?.index).toBe(1);
    expect(stepSession(session, 1)?.index).toBe(2);
    expect(session?.index).toBe(1);
  });
  it('rejects missing photos and empty queues', () => {
    expect(openSession([], 'one')).toBeNull();
    expect(openSession(photos, 'absent')).toBeNull();
  });
  it('does not wrap at the boundaries or move a single photo', () => {
    const first = openSession(photos, 'one');
    expect(stepSession(first, -1)).toBe(first);
    const last = openSession(photos, 'three');
    expect(stepSession(last, 1)).toBe(last);
    expect(stepSession(openSession([photos[0]], 'one'), 1)?.index).toBe(0);
    expect(stepSession(null, 1)).toBeNull();
  });
  it('processes sequential rapid navigation and invalid deltas safely', () => {
    let session = openSession(photos, 'one');
    for (let i = 0; i < 20; i++) session = stepSession(session, 1);
    expect(session?.index).toBe(2);
    expect(stepSession(session, Number.NaN)).toBe(session);
  });
});
