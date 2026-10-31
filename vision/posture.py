"""Seated/standing estimate from COCO pose keypoints. Deliberately conservative.

At the hip, the angle between hip->shoulder and hip->knee is ~90 deg when seated and
~180 deg when standing. Frontal views foreshorten the thigh and occlusion hides joints,
so anything ambiguous is UNKNOWN rather than guessed.
"""
import numpy as np

SEATED, STANDING, UNKNOWN = "seated", "standing", "unknown"
SHOULDERS, HIPS, KNEES = (5, 6), (11, 12), (13, 14)
MIN_JOINT_CONF = 0.52
MIN_SEGMENT = 0.12  # torso and thigh must each be >= 12% of the person's box height


def posture(kpts, box_height):
    """kpts: (17, 3) array of x, y, confidence. box_height: detection height in pixels."""
    if kpts is None or len(kpts) < 17 or not box_height or box_height <= 0:
        return UNKNOWN

    def center(indices):
        pts = [kpts[i, :2] for i in indices if float(kpts[i, 2]) >= MIN_JOINT_CONF]
        return np.mean(pts, axis=0) if pts else None

    shoulder, hip, knee = center(SHOULDERS), center(HIPS), center(KNEES)
    if shoulder is None or hip is None or knee is None:
        return UNKNOWN
    torso, thigh = shoulder - hip, knee - hip
    # Relative to the person, so the result does not depend on video resolution or distance.
    if min(np.linalg.norm(torso), np.linalg.norm(thigh)) < MIN_SEGMENT * box_height:
        return UNKNOWN
    cos = float(np.dot(torso, thigh) / (np.linalg.norm(torso) * np.linalg.norm(thigh)))
    angle = float(np.degrees(np.arccos(np.clip(cos, -1, 1))))
    if 60 <= angle <= 123:
        return SEATED
    if 151 <= angle <= 180:
        return STANDING
    return UNKNOWN


def counts(postures):
    return {SEATED: postures.count(SEATED), STANDING: postures.count(STANDING), UNKNOWN: postures.count(UNKNOWN)}
