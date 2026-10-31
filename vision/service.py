"""CPU YOLO service. Image coordinates describe detections, never bus seat locations."""
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

MODEL_PATH = os.getenv("YOLO_MODEL", "/models/yolo11n.pt")
MAX_IMAGE = 8 * 1024 * 1024
MAX_VIDEO = 50 * 1024 * 1024
MAX_PIXELS = 16_000_000
SAMPLE_FPS = 3      # analysed frames per second of video
MAX_FRAMES = 90     # at most 30 s of video at SAMPLE_FPS

app = FastAPI(title="YolBaku vision", version="2.1")
model = YOLO(MODEL_PATH)
lock = Lock()
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

def boxes(result, tracked=False):
    found = []
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxyn[0].tolist()
        item = dict(x=x1, y=y1, width=x2-x1, height=y2-y1, confidence=round(float(box.conf[0]), 3))
        if tracked and box.id is not None:
            item["track_id"] = int(box.id[0])
        found.append(item)
    return found

def detect(image, source):
    started = time.monotonic()
    with lock:
        result = model.predict(image, classes=[0], conf=0.35, device="cpu", verbose=False)[0]
    found = boxes(result)
    return dict(kind="image", visible_people=len(found), detections=found, source=source,
                model="YOLO11n", inference_ms=round((time.monotonic()-started)*1000),
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
        frames, tracks, index, truncated = [], set(), 0, False
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
                    tracks.update(d["track_id"] for d in found if "track_id" in d)
                    frames.append(dict(t=round(index / fps, 2), people=len(found), detections=found))
                index += 1
    finally:
        capture.release()
    if not frames:
        raise HTTPException(422, "No frames decoded")
    counts = [f["people"] for f in frames]
    return dict(kind="video", source=source, model="YOLO11n + ByteTrack", frames=frames,
                analyzed_frames=len(frames), sample_fps=round(fps / step, 2), analyzed_seconds=round(index / fps, 1),
                truncated=truncated, visible_people=max(counts), max_visible=max(counts),
                average_visible=round(sum(counts) / len(counts), 1), unique_people=len(tracks),
                inference_ms=round((time.monotonic()-started)*1000), width=width, height=height,
                not_total_occupancy=True)

@app.get("/health")
def health():
    return {"status": "ok", "model": "YOLO11n", "device": "cpu", "video": True}

@app.get("/sample")
def sample():
    return FileResponse("/models/bus.jpg", media_type="image/jpeg")

@app.get("/sample-video")
def sample_video():
    return FileResponse("/models/sample.webm", media_type="video/webm")

@app.post("/demo")
def demo():
    with open_image("/models/bus.jpg") as image:
        return detect(image.convert("RGB"), "ultralytics-reference-image")

@app.post("/demo-video")
def demo_video():
    return analyze_video("/models/sample.webm", "reference-video-from-ultralytics-image")

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
