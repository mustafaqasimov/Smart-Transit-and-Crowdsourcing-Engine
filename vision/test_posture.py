"""Runs during the image build: python -m unittest test_posture"""
import unittest
import numpy as np
from posture import posture, counts, SEATED, STANDING, UNKNOWN


def person(shoulder, hip, knee, conf=0.9):
    k = np.zeros((17, 3))
    for indices, point in (((5, 6), shoulder), ((11, 12), hip), ((13, 14), knee)):
        for i in indices:
            k[i] = (*point, conf)
    return k


class PostureTest(unittest.TestCase):
    def test_standing_side_view(self):
        self.assertEqual(posture(person((100, 100), (100, 250), (100, 380)), 450), STANDING)

    def test_seated_side_view(self):
        self.assertEqual(posture(person((100, 100), (100, 250), (230, 255)), 300), SEATED)

    def test_same_pose_any_resolution(self):
        for scale in (0.1, 1, 4):
            k = person((100 * scale, 100 * scale), (100 * scale, 250 * scale), (230 * scale, 255 * scale))
            self.assertEqual(posture(k, 300 * scale), SEATED)

    def test_ambiguous_angle_is_unknown(self):
        self.assertEqual(posture(person((100, 100), (100, 250), (180, 360)), 400), UNKNOWN)

    def test_foreshortened_thigh_is_unknown(self):
        self.assertEqual(posture(person((100, 100), (100, 250), (100, 262)), 300), UNKNOWN)

    def test_hidden_joints_are_unknown(self):
        self.assertEqual(posture(person((100, 100), (100, 250), (230, 255), conf=0.3), 300), UNKNOWN)
        self.assertEqual(posture(None, 300), UNKNOWN)
        self.assertEqual(posture(person((100, 100), (100, 250), (230, 255)), 0), UNKNOWN)

    def test_counts(self):
        self.assertEqual(counts([SEATED, STANDING, STANDING, UNKNOWN]), {SEATED: 1, STANDING: 2, UNKNOWN: 1})


if __name__ == "__main__":
    unittest.main()
