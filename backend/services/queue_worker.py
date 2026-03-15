import os 
import sys 
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
import multiprocessing 
def run_worker_process(queues_list): 
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379") 
    conn = redis.from_url(redis_url) 
    qs = [Queue(q, connection=conn) for q in queues_list] 
    WorkerClass = SimpleWorker if sys.platform == "win32" else Worker 
    worker = WorkerClass(qs, connection=conn) 
    print(f"Starting worker for queues: {queues_list} in process {os.getpid()}") 
    worker.work() 
def main() -> None: 
    worker_configs = [ 
        ["encoder_tasks"], 
        ["encoder_tasks"], 
        ["ocr_tasks"] 
    ] 
    processes = [] 
    print("Initializing Multiprocessing Queue Workers...") 
    for config in worker_configs: 
        p = multiprocessing.Process(target=run_worker_process, args=(config,)) 
        p.start() 
        processes.append(p) 
    try: 
        for p in processes: 
            p.join() 
    except KeyboardInterrupt: 
        print("Stopping workers...") 
        for p in processes: 
            p.terminate() 
if __name__ == "__main__": 
    multiprocessing.freeze_support() 
    main() 
