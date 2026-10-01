import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parsePhotoMatches } from '../src/similarity.ts';

test('match percentages are bounded without altering raw similarity', () => {
  assert.deepEqual(parsePhotoMatches([
    { look_id: 'perfect', similarity: 1, match_percent: 100 },
    { look_id: 'high', similarity: 0.8274, match_percent: 82.7 },
    { look_id: 'negative', similarity: -0.4, match_percent: -40 },
    { look_id: 'overflow', similarity: 1.001, match_percent: 100.1 },
  ]), [
    { look_id: 'overflow', similarity: 1.001, match_percent: 100 },
    { look_id: 'perfect', similarity: 1, match_percent: 100 },
    { look_id: 'high', similarity: 0.8274, match_percent: 82.7 },
    { look_id: 'negative', similarity: -0.4, match_percent: 0 },
  ]);
});

test('results retain IDs and backend scores, sort by raw similarity and deduplicate', () => {
  assert.deepEqual(parsePhotoMatches([
    { look_id: 'low', similarity: 0.4, match_percent: 40 },
    { look_id: 'high', similarity: 0.91, match_percent: 91 },
    { look_id: 'low', similarity: 0.5, match_percent: 50 },
  ]), [
    { look_id: 'high', similarity: 0.91, match_percent: 91 },
    { look_id: 'low', similarity: 0.5, match_percent: 50 },
  ]);
  assert.deepEqual(parsePhotoMatches([]), []);
});

test('malformed responses cannot generate fabricated match scores', () => {
  for (const value of [
    null,
    {},
    [{look_id:'x'}],
    [{look_id:'x', similarity:0.9}],
    [{look_id:'x', similarity:NaN, match_percent:90}],
    [{look_id:'x', similarity:'0.9', match_percent:90}],
    [{look_id:'x', similarity:0.9, match_percent:'90'}],
  ]) {
    assert.throws(() => parsePhotoMatches(value));
  }
});
