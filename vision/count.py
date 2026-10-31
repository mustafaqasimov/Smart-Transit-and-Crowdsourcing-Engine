"""Optional local YOLO + ByteTrack people tracker. Does not infer seat occupancy.
Usage: python vision/count.py --source video.mp4 --model yolo11n.pt
Outputs frame counts only; no video/face storage. Model weights download on first use.
"""
import argparse,json
from ultralytics import YOLO
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--model',default='yolo11n.pt');a=p.parse_args()
model=YOLO(a.model)
for frame,result in enumerate(model.track(source=a.source,stream=True,classes=[0],tracker='bytetrack.yaml',verbose=False,save=False)):
    print(json.dumps({'frame':frame,'visible_people':len(result.boxes),'source':'camera','not_total_occupancy':True}))
