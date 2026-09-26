# CIPHERTRACE Defense-Grade Air-Gapped Backend Dockerfile
# Builds deterministic NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65) with liboqs
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH \
    OQS_MINIMAL_BUILD="KEM_ml_kem_768;SIG_ml_dsa_65"

# System dependencies for compiling liboqs and supporting cryptographic libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    git \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Deterministic build of liboqs with minimal algorithms: ML-KEM-768 and ML-DSA-65
RUN git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git /tmp/liboqs && \
    cd /tmp/liboqs && \
    mkdir build && cd build && \
    cmake -GNinja -DBUILD_SHARED_LIBS=ON -DOQS_MINIMAL_BUILD="${OQS_MINIMAL_BUILD}" -DCMAKE_INSTALL_PREFIX=/usr/local .. && \
    ninja && \
    ninja install && \
    ldconfig && \
    rm -rf /tmp/liboqs

# Official Open Quantum Safe python bindings
RUN git clone --depth 1 https://github.com/open-quantum-safe/liboqs-python.git /tmp/liboqs-python && \
    cd /tmp/liboqs-python && \
    pip install --no-cache-dir . && \
    rm -rf /tmp/liboqs-python

WORKDIR /app

# Install project Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Secure local storage directories
RUN mkdir -p /app/data /app/keystores /app/uploads /app/returns

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
