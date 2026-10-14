FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends gcc make python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN make -C src/core
EXPOSE 8000
CMD ["python3", "src/server/server.py", "--host", "0.0.0.0", "--port", "8000"]
