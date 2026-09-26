# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for liboqs and other C-based libs
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install liboqs from source to ensure we have the latest NIST PQC algorithms
RUN git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git /tmp/liboqs && \
    cd /tmp/liboqs && \
    mkdir build && cd build && \
    cmake -DBUILD_SHARED_LIBS=ON .. && \
    make && \
    make install && \
    ldconfig && \
    rm -rf /tmp/liboqs

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
