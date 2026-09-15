import { expect, it } from 'vitest';
import { parseRoute } from './router';
it('parses home and album routes', () => {
  expect(parseRoute('')).toEqual({ kind: 'home' });
  expect(parseRoute('#/')).toEqual({ kind: 'home' });
  expect(parseRoute('#/albums/summer')).toEqual({ kind: 'album', id: 'summer' });
});
it('rejects malformed and unknown routes without throwing', () => {
  for (const route of ['#/albums/%E0%A4%A', '#/other', '#/albums/', '#/albums/a/b', '#/albums/a?x=1']) {
    expect(parseRoute(route)).toEqual({ kind: 'not-found' });
  }
});
