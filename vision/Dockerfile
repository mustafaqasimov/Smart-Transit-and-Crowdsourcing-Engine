FROM python:3.11-slim
WORKDIR /vision
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Downloads are pinned by SHA-256 so a changed upstream file fails the build instead of shipping silently.
RUN mkdir -p /models && python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26s-pose.pt','/models/yolo26s-pose.pt'); urllib.request.urlretrieve('https://ultralytics.com/images/bus.jpg','/models/bus.jpg')" \
 && printf '%s  %s\n' a083adb42303728ae14c4bd6bd56d80da46f82fb2564dbd6f31dcc92ea321646 /models/yolo26s-pose.pt c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63 /models/bus.jpg | sha256sum -c -
COPY make_sample.py .
RUN python make_sample.py
COPY posture.py test_posture.py ./
RUN python -m unittest -v test_posture
COPY service.py bus_yolo26.py ./
ENV YOLO_CONFIG_DIR=/tmp/ultralytics
USER 10001
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8001"]
