"""CPU YOLO26 pose service: people, seated/standing estimate, ByteTrack ids for video.
Image coordinates describe detections, never bus seat locations."""
from io import BytesIO
from threading import Lock
from tempfile import NamedTemporaryFile
import math
import time
import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
open_image = Image.open  # Keep Pillow validation; Ultralytics patches Image.open with an auto-installer.
os.environ["YOLO_AUTOINSTALL"] = "false"
import cv2
from ultralytics import YOLO
from posture import posture, counts, UNKNOWN

MODELS = os.getenv("MODELS_DIR", "/models")  # set for a local run outside Docker
MODEL_PATH = os.getenv("YOLO_MODEL", os.path.join(MODELS, "yolo26s-pose.pt"))
MODEL_NAME = "YOLO26s-pose"
MAX_IMAGE = 8 * 1024 * 1024
MAX_VIDEO = 50 * 1024 * 1024
MAX_PIXELS = 16_000_000
SAMPLE_FPS = 3      # analysed frames per second of video
MAX_FRAMES = 90     # at most 30 s of video at SAMPLE_FPS

app = FastAPI(title="BakuYolOu vision", version="2.1")
model = YOLO(MODEL_PATH)
lock = Lock()
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

def boxes(result, tracked=False):
    found = []
    keypoints = result.keypoints.data.cpu().numpy() if result.keypoints is not None else []
    for i, box in enumerate(result.boxes):
        x1, y1, x2, y2 = box.xyxyn[0].tolist()
        height = float(box.xyxy[0][3] - box.xyxy[0][1])
        item = dict(x=x1, y=y1, width=x2-x1, height=y2-y1, confidence=round(float(box.conf[0]), 3),
                    posture=posture(keypoints[i], height) if i < len(keypoints) else UNKNOWN)
        # Only real tracker ids: a person without one is shown unnumbered rather than with a made-up id.
        if tracked and box.id is not None:
            item["track_id"] = int(box.id[0])
        found.append(item)
    return found

def posture_counts(found):
    return counts([d["posture"] for d in found])

def detect(image, source):
    started = time.monotonic()
    with lock:
        result = model.predict(image, classes=[0], conf=0.35, device="cpu", verbose=False)[0]
    found = boxes(result)
    return dict(kind="image", visible_people=len(found), detections=found, source=source,
                postures=posture_counts(found), model=MODEL_NAME, inference_ms=round((time.monotonic()-started)*1000),
                not_total_occupancy=True, width=image.width, height=image.height)

def analyze_video(path, source):
    """Samples ~3 frames per second, detects people and links them across frames with ByteTrack."""
    started = time.monotonic()
    capture = cv2.VideoCapture(path)
    if not capture.isOpened():
        raise HTTPException(422, "Unreadable video")
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not fps or math.isnan(fps) or fps <= 0 or fps > 240:
            fps = 25.0
        step = max(1, round(fps / SAMPLE_FPS))
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)); height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if width * height > MAX_PIXELS:
            raise HTTPException(413, "Maximum frame size is 16 megapixels")
        frames, tracks, index, truncated = [], {}, 0, False
        with lock:
            tracker = YOLO(MODEL_PATH)  # fresh tracker state for every video
            while True:
                if not capture.grab():
                    break
                if index % step == 0:
                    if len(frames) >= MAX_FRAMES:
                        truncated = True
                        break
                    ok, frame = capture.retrieve()
                    if not ok:
                        break
                    result = tracker.track(frame, persist=True, classes=[0], conf=0.35, device="cpu",
                                           tracker="bytetrack.yaml", verbose=False)[0]
                    found = boxes(result, tracked=True)
                    for d in found:
                        if "track_id" in d:
                            tracks.setdefault(d["track_id"], []).append(d["posture"])
                    frames.append(dict(t=round(index / fps, 2), people=len(found), postures=posture_counts(found), detections=found))
                index += 1
    finally:
        capture.release()
    if not frames:
        raise HTTPException(422, "No frames decoded")
    people = [f["people"] for f in frames]
    # Per tracked person: the most frequent known posture over the clip, else unknown.
    def settled(seen):
        known = [p for p in seen if p != UNKNOWN]
        return max(set(known), key=known.count) if known else UNKNOWN
    return dict(kind="video", source=source, model=MODEL_NAME + " + ByteTrack", frames=frames,
                track_postures=counts([settled(seen) for seen in tracks.values()]),
                analyzed_frames=len(frames), sample_fps=round(fps / step, 2), analyzed_seconds=round(index / fps, 1),
                truncated=truncated, visible_people=max(people), max_visible=max(people),
                average_visible=round(sum(people) / len(people), 1), unique_people=len(tracks),
                inference_ms=round((time.monotonic()-started)*1000), width=width, height=height,
                not_total_occupancy=True)

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": "cpu", "video": True, "posture": True}

@app.get("/sample")
def sample():
    return FileResponse(os.path.join(MODELS, "bus.jpg"), media_type="image/jpeg")

@app.get("/sample-video")
def sample_video():
    return FileResponse(os.path.join(MODELS, "sample.webm"), media_type="video/webm")

@app.post("/demo")
def demo():
    with open_image(os.path.join(MODELS, "bus.jpg")) as image:
        return detect(image.convert("RGB"), "ultralytics-reference-image")

@app.post("/demo-video")
def demo_video():
    return analyze_video(os.path.join(MODELS, "sample.webm"), "reference-video-from-ultralytics-image")

@app.post("/detect")
async def upload(file: UploadFile = File(...)):
    content = await file.read(MAX_IMAGE + 1)
    if len(content) > MAX_IMAGE:
        raise HTTPException(413, "Maximum image size is 8 MB")
    try:
        with open_image(BytesIO(content)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(413, "Maximum image size is 16 megapixels")
            return detect(image.convert("RGB"), "uploaded-image")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Invalid or oversized image")

@app.post("/detect-video")
def upload_video(file: UploadFile = File(...)):
    # Written to a private temp file because OpenCV decodes from a path; deleted right after analysis.
    with NamedTemporaryFile(suffix=".video") as temp:
        size = 0
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_VIDEO:
                raise HTTPException(413, "Maximum video size is 50 MB")
            temp.write(chunk)
        temp.flush()
        return analyze_video(temp.name, "uploaded-video")
