FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY src/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Mount src directory to /app
COPY src/ .

# Copy scripts directory
COPY scripts/ ./scripts/

# Default command (can be overridden)
CMD ["python"]
