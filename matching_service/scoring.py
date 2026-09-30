"""Rank OpenCLIP retrieval results and convert cosine similarity to a conservative UI score.

The UI score is deliberately calibrated: raw CLIP cosine similarity is useful for ranking,
but it is not a probability and must not be shown directly as a percentage.
"""
import math

MIN_COSINE = 0.58
STRONG_COSINE = 0.90
MIN_DISPLAY_PERCENT = 35.0
MAX_DISPLAY_PERCENT = 99.0

def calibrated_percent(similarity: float) -> float:
    if similarity <= MIN_COSINE:
        return 0.0
    if similarity >= STRONG_COSINE:
        return MAX_DISPLAY_PERCENT
    position = (similarity - MIN_COSINE) / (STRONG_COSINE - MIN_COSINE)
    # Quadratic calibration suppresses mediocre generic CLIP matches.
    return round(MIN_DISPLAY_PERCENT + (MAX_DISPLAY_PERCENT - MIN_DISPLAY_PERCENT) * (position ** 2), 1)

def rank_matches(rows: list[dict]) -> list[dict]:
    matches = {}
    for row in rows:
        similarity = float(row['similarity'])
        if not math.isfinite(similarity):
            raise ValueError('Non-finite similarity returned by the database')
        percent = calibrated_percent(similarity)
        if percent <= 0:
            continue
        match = {'look_id': row['look_id'], 'similarity': similarity, 'match_percent': percent}
        previous = matches.get(match['look_id'])
        if previous is None or previous['similarity'] < similarity:
            matches[match['look_id']] = match
    return sorted(matches.values(), key=lambda row: row['similarity'], reverse=True)[:20]
