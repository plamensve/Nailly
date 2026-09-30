"""Presentation of cosine scores. Percentages are not calibrated probabilities."""
import math


def rank_matches(rows: list[dict]) -> list[dict]:
    matches = {}
    for row in rows:
        similarity = float(row['similarity'])
        if not math.isfinite(similarity):
            raise ValueError('Non-finite similarity returned by the database')
        match = {
            'look_id': row['look_id'],
            'similarity': similarity,
            'match_percent': round(max(0.0, min(1.0, similarity)) * 100, 1),
        }
        previous = matches.get(match['look_id'])
        if previous is None or previous['similarity'] < similarity:
            matches[match['look_id']] = match
    return sorted(matches.values(), key=lambda row: row['similarity'], reverse=True)
