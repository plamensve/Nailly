import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parsePhotoMatches, similarityPercent } from '../src/similarity.ts';

test('cosine scores produce bounded percentages without inflating similarity', () => {
  assert.equal(similarityPercent(1), 100);
  assert.equal(similarityPercent(0.8274), 82.7);
  assert.equal(similarityPercent(0), 0);
  assert.equal(similarityPercent(-0.4), 0);
  assert.equal(similarityPercent(1.001), 100);
});
test('results retain IDs and scores, sort by raw similarity and deduplicate', () => {
  assert.deepEqual(parsePhotoMatches([
    { look_id: 'low', similarity: 0.4 }, { look_id: 'high', similarity: 0.91 },
    { look_id: 'low', similarity: 0.5 },
  ]), [
    { look_id: 'high', similarity: 0.91, match_percent: 91 },
    { look_id: 'low', similarity: 0.5, match_percent: 50 },
  ]);
  assert.deepEqual(parsePhotoMatches([]), []);
});
test('malformed responses cannot generate fabricated match scores', () => {
  for (const value of [null, {}, [{look_id:'x'}], [{look_id:'x',similarity:NaN}], [{look_id:'x',similarity:'0.9'}]]) {
    assert.throws(() => parsePhotoMatches(value));
  }
});
