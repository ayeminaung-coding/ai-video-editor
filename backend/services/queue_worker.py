import os
import sys

# Windows workaround for rq relying on 'fork' which is not available
if sys.platform == "win32":
    import multiprocessing
    original_get_context = multiprocessing.get_context
    def mock_get_context(method=None):
        if method == "fork":
            return original_get_context("spawn")
        return original_get_context(method)
    multiprocessing.get_context = mock_get_context

import redis
from rq import Queue, Worker, SimpleWorker

listen = ["ocr_tasks"]


def main() -> None:
    # Configure redis connection
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    conn = redis.from_url(redis_url)
    queue = Queue("ocr_tasks", connection=conn)
    
    # Use SimpleWorker on Windows since it doesn't support 'fork'
    WorkerClass = SimpleWorker if sys.platform == "win32" else Worker
    worker = WorkerClass([queue], connection=conn)
    worker.work()


if __name__ == "__main__":
    main()
