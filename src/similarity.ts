export type PhotoMatch = { look_id: string; similarity: number; match_percent: number };

/** Cosine similarity displayed as 0–100; this is not a calibrated probability. */
export function similarityPercent(similarity: number): number {
  return Math.round(Math.max(0, Math.min(1, similarity)) * 1000) / 10;
}

export function parsePhotoMatches(value: unknown): PhotoMatch[] {
  if (!Array.isArray(value)) throw new Error('Invalid visual search response.');
  const matches = new Map<string, PhotoMatch>();
  for (const row of value) {
    if (!row || typeof row.look_id !== 'string' || !row.look_id ||
        typeof row.similarity !== 'number' || !Number.isFinite(row.similarity)) {
      throw new Error('Invalid visual search score.');
    }
    const match = { look_id: row.look_id, similarity: row.similarity, match_percent: similarityPercent(row.similarity) };
    if (!matches.has(row.look_id) || matches.get(row.look_id)!.similarity < match.similarity) matches.set(row.look_id, match);
  }
  return [...matches.values()].sort((a, b) => b.similarity - a.similarity);
}
