import unittest
from scoring import rank_matches


class ScoringTests(unittest.TestCase):
    def test_ranking_and_deduplication(self):
        result = rank_matches([{'look_id': 'a', 'similarity': 0.4}, {'look_id': 'b', 'similarity': 0.8274}, {'look_id': 'a', 'similarity': 0.5}])
        self.assertEqual([row['look_id'] for row in result], ['b', 'a'])
        self.assertEqual(result[0]['match_percent'], 82.7)
        self.assertEqual(result[1]['similarity'], 0.5)

    def test_bounds_and_empty(self):
        for value, expected in [(1.0001, 100), (1, 100), (0, 0), (-1, 0)]:
            self.assertEqual(rank_matches([{'look_id': 'x', 'similarity': value}])[0]['match_percent'], expected)
        self.assertEqual(rank_matches([]), [])

    def test_nonfinite_rejected(self):
        for value in [float('nan'), float('inf')]:
            with self.assertRaises(ValueError):
                rank_matches([{'look_id': 'x', 'similarity': value}])
