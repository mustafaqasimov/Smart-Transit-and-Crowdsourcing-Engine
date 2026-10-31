"""Builds /models/sample.webm: a slow pan and zoom over the Ultralytics bus.jpg reference image.
The video is synthetic camera motion over a real photo; it exists to exercise video inference and tracking."""
import os
import cv2

MODELS = os.getenv("MODELS_DIR", "/models")

image = cv2.imread(os.path.join(MODELS, "bus.jpg"))
h, w = image.shape[:2]
out_w, out_h, fps, seconds = 480, 640, 15, 6
writer = cv2.VideoWriter(os.path.join(MODELS, "sample.webm"), cv2.VideoWriter_fourcc(*"VP80"), fps, (out_w, out_h))
if not writer.isOpened():
    raise SystemExit("VP8 encoder unavailable")
frames = fps * seconds
for i in range(frames):
    p = i / (frames - 1)
    scale = 1.0 - 0.18 * p                      # zoom in slowly
    cw, ch = int(w * scale), int(w * scale * out_h / out_w)
    ch = min(ch, h)
    x = int((w - cw) * (0.15 + 0.7 * p))       # pan left to right
    y = int((h - ch) * 0.5)
    writer.write(cv2.resize(image[y:y+ch, x:x+cw], (out_w, out_h), interpolation=cv2.INTER_AREA))
writer.release()
check = cv2.VideoCapture(os.path.join(MODELS, "sample.webm"))
count = 0
while check.grab():
    count += 1
if count < frames // 2:
    raise SystemExit(f"Sample video decode check failed: {count} frames")
print(f"sample.webm: {count} frames")
