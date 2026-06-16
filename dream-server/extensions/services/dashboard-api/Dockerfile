# Dream Server Dashboard API
# Lightweight system status backend for the Dashboard UI

FROM python:3.11-slim

LABEL org.opencontainers.image.source="https://github.com/Light-Heart-Labs/DreamServer"
LABEL org.opencontainers.image.description="Dream Server Dashboard API"

WORKDIR /app

# Install system deps for GPU metrics access
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
# Use glob to pick up every top-level .py file. The old explicit list
# went stale every time a new module landed in main.py's imports —
# `session_signer.py` was missed once (see #1181), then `settings.py`
# again right after. The glob is bounded to the build context's top
# level (won't recurse into routers/, tests/, etc.) and matches the
# filesystem shape (one flat module dir per service).
COPY *.py ./
COPY routers/ routers/
COPY docker-entrypoint.sh /usr/local/bin/dashboard-api-entrypoint

# Non-root user
RUN useradd -m -u 1000 dreamer

# Create the default /data path for unmounted dev containers. Production
# installs bind-mount ./data over it, so the entrypoint repairs ownership at
# container start before dropping back to this non-root account.
RUN mkdir -p /data \
    && chown dreamer:dreamer /data \
    && chmod 0755 /usr/local/bin/dashboard-api-entrypoint

ENV DASHBOARD_API_PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${DASHBOARD_API_PORT}/health || exit 1

EXPOSE ${DASHBOARD_API_PORT}

ENTRYPOINT ["dashboard-api-entrypoint"]
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${DASHBOARD_API_PORT:-3002}"]
