FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "kraken==7.1.1"

ENV XDG_DATA_HOME=/opt/kraken-data
RUN kraken get 10.5281/zenodo.21788410 \
    && find /opt/kraken-data -name 'medium.safetensors' -exec cp {} /opt/recognition.safetensors \; \
    && test -s /opt/recognition.safetensors

ENV KRAKEN_MODEL=/opt/recognition.safetensors
COPY server.py /server.py
EXPOSE 5000
CMD ["python", "/server.py"]
