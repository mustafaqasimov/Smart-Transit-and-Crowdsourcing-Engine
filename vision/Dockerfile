FROM python:3.11-slim
WORKDIR /vision
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Downloads are pinned by SHA-256 so a changed upstream file fails the build instead of shipping silently.
RUN mkdir -p /models && python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt','/models/yolo11n.pt'); urllib.request.urlretrieve('https://ultralytics.com/images/bus.jpg','/models/bus.jpg')" \
 && printf '%s  %s\n' 0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1 /models/yolo11n.pt c02019c4979c191eb739ddd944445ef408dad5679acab6fd520ef9d434bfbc63 /models/bus.jpg | sha256sum -c -
COPY make_sample.py .
RUN python make_sample.py
COPY service.py .
ENV YOLO_CONFIG_DIR=/tmp/ultralytics
USER 10001
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8001"]
