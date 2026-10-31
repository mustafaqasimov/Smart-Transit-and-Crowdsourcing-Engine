"""Offline YOLO26 pose analysis of a cabin video: people, seated/standing estimate, ByteTrack ids.

pip install ultralytics opencv-python numpy lap
python vision/bus_yolo26.py input.mp4 --capacity 80

Writes <name>_YOLO26_ANALYZED.mp4 (annotated, mp4v; plays in desktop players, not in every browser)
and <name>_YOLO26_ANALYZED.csv. Weights download on first run. The web service (service.py) uses
the same model and posture rules; this script is for longer local recordings.
"""
import argparse
import csv
import math
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO
from posture import posture, SEATED, STANDING, UNKNOWN

COLORS = {SEATED: (90, 215, 120), STANDING: (20, 185, 250), UNKNOWN: (215, 185, 80)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('--capacity', type=int, default=0, help='Real vehicle capacity; 0 = do not estimate occupancy')
    parser.add_argument('--model', default='yolo26s-pose.pt', help='YOLO26 pose weights')
    parser.add_argument('--fps', type=float, default=12, help='Frames analysed per second of video')
    parser.add_argument('--conf', type=float, default=.35)
    parser.add_argument('--imgsz', type=int, default=640)
    args = parser.parse_args()
    vid = Path(args.video)
    if not vid.exists():
        raise SystemExit(f'Video missing: {vid}')
    model = YOLO(args.model)
    cap = cv2.VideoCapture(str(vid))
    if not cap.isOpened():
        raise SystemExit('Video not readable')
    input_fps = cap.get(cv2.CAP_PROP_FPS)
    if not input_fps or math.isnan(input_fps) or input_fps <= 0:
        input_fps = 30.0
    rate = min(args.fps, input_fps)  # output plays at real speed even when the source has fewer frames
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = vid.with_name(vid.stem + '_YOLO26_ANALYZED.mp4')
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*'mp4v'), rate, (w, h))
    if not writer.isOpened():
        raise SystemExit('Cannot open output writer')
    cols = ['time_seconds', 'total_visible_detected', 'seated_estimated', 'standing_estimated', 'unknown_pose', 'visible_percent_of_capacity']
    records = []
    frame_index = 0; next_t = 0.0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = frame_index / input_fps
        frame_index += 1
        if t + 1e-4 < next_t:
            continue
        while next_t <= t + 1e-4:
            next_t += 1 / rate
        res = model.track(frame, conf=args.conf, imgsz=args.imgsz, persist=True, classes=[0], tracker='bytetrack.yaml', verbose=False)[0]
        tally = {SEATED: 0, STANDING: 0, UNKNOWN: 0}
        if res.boxes is not None and len(res.boxes):
            coords = res.boxes.xyxy.cpu().numpy()
            ids = res.boxes.id.int().cpu().tolist() if res.boxes.id is not None else [None] * len(coords)
            kp = res.keypoints.data.cpu().numpy() if res.keypoints is not None else []
            for i, (bbox, pid) in enumerate(zip(coords, ids)):
                state = posture(kp[i], float(bbox[3] - bbox[1])) if i < len(kp) else UNKNOWN
                tally[state] += 1
                x1, y1, x2, y2 = map(int, bbox)
                cv2.rectangle(frame, (x1, y1), (x2, y2), COLORS[state], 2)
                label = f'ID {pid}: {state}' if pid is not None else state
                cv2.putText(frame, label, (x1, max(18, y1 - 7)), cv2.FONT_HERSHEY_SIMPLEX, .56, COLORS[state], 2, cv2.LINE_AA)
        total = sum(tally.values())
        # Visible people over capacity is a lower bound: the camera rarely sees the whole cabin.
        share = round(100 * total / args.capacity, 1) if args.capacity > 0 else None
        pad = np.zeros((130, min(w, 530), 3), dtype=np.uint8)
        region = frame[:pad.shape[0], :pad.shape[1]]
        cv2.addWeighted(region, .20, pad[:region.shape[0], :region.shape[1]], .80, 0, region)
        cv2.putText(frame, 'YOLO26 POSE  |  AUTOMATIC TRACKING', (15, 26), cv2.FONT_HERSHEY_SIMPLEX, .68, (255, 255, 255), 2)
        cv2.putText(frame, f'Visible detected: {total}', (15, 56), cv2.FONT_HERSHEY_SIMPLEX, .65, (255, 255, 255), 1)
        cv2.putText(frame, f'Seated: {tally[SEATED]}   Standing: {tally[STANDING]}   Unknown: {tally[UNKNOWN]}', (15, 84), cv2.FONT_HERSHEY_SIMPLEX, .58, (255, 255, 255), 1)
        note = f'Visible/capacity: {share:.1f}% (NOT true occupancy)' if share is not None else 'Occupancy: unavailable without capacity and complete view'
        cv2.putText(frame, note, (15, 111), cv2.FONT_HERSHEY_SIMPLEX, .45, (210, 230, 230), 1)
        writer.write(frame)
        records.append([round(t, 3), total, tally[SEATED], tally[STANDING], tally[UNKNOWN], share])
        if len(records) % 30 == 0:
            print(f'Processed {t:.1f} seconds, detected {total}', flush=True)
    cap.release(); writer.release()
    csv_path = vid.with_name(vid.stem + '_YOLO26_ANALYZED.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        wcsv = csv.writer(f); wcsv.writerow(cols); wcsv.writerows(records)
    print('Saved', out, csv_path)


if __name__ == '__main__':
    main()
