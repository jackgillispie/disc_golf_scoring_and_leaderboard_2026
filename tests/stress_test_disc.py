import asyncio
import aiohttp
import json
import time
from datetime import datetime

# --- CONFIGURATION ---
ENDPOINT_E = "https://script.google.com/macros/s/AKfycbxinZ6rj0aIGTl34BR8Ydr__fZxqpallK0S2NBkYbOPQtJYpBFtVHmTfv-lULg5bVmX0A/exec"
K_REQUESTS = 50  # Number of concurrent requests
UNIQUE_IDENTIFIERS = [f"ID-{i}" for i in range(K_REQUESTS)]

async def send_request(session, unique_id):
    """Sends a single POST request and returns status/timing."""
    payload = {
        "Tournament": "LKNITP Disc Bash 2026",
        "Group": "PYTHON",
        "Token": unique_id,
        "Players": "The Little Python",
        "Hole": 12,
        "Par": 4,
        "Dist": 666,
        "Score": 1,
        "VsPar": -3,
        "Timestamp": datetime.utcnow().isoformat() + "Z"
    }

    # Specific header requirements
    headers = {"Content-Type": "text/plain;charset=utf-8"}
    
    start_time = time.perf_counter()
    try:
        async with session.post(ENDPOINT_E, data=json.dumps(payload), headers=headers, timeout=10) as response:
         
            status = response.status
            # Read body to ensure connection is returned to pool properly
            await response.read() 
            end_time = time.perf_counter()
            json_content = await response.json()
            return {"success": True, "status": status, "latency": end_time - start_time, "message": json_content["message"]}
    except Exception as e:
        end_time = time.perf_counter()
        return {"success": False, "error": str(e), "latency": end_time - start_time, "message": json_content["message"]}

async def run_load_test():
    """Orchestrates the concurrent requests and gathers diagnostics."""
    print(f"🚀 Starting {K_REQUESTS} concurrent requests to {ENDPOINT_E}...")
    
    # Increase connection limit for hardware testing
    connector = aiohttp.TCPConnector(limit=None) 
    
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [send_request(session, uid) for uid in UNIQUE_IDENTIFIERS]
        
        start_total = time.perf_counter()
        results = await asyncio.gather(*tasks)
        end_total = time.perf_counter()

    # --- DIAGNOSTICS ---
    total_time = end_total - start_total
    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]
    latencies = [r["latency"] for r in results]

    #check for specific messages in JSON when response codes are the same
    messages = [r["message"] for r in results if r["message"]]
    message_classifier_count = {}
    for el in messages:
        if el in message_classifier_count:
            message_classifier_count[el]+=1
        else:
            message_classifier_count[el] = 1
            
    print(message_classifier_count)
    print("\n" + "="*30)
    print("      DIAGNOSTICS REPORT")
    print("="*30)
    print(f"Total Requests:      {len(results)}")
    print(f"Successful:          {len(successes)}")
    print(f"Failed:              {len(failures)}")
    print(f"Total Duration:      {total_time:.4f}s")
    print(f"Requests Per Sec:    {len(results) / total_time:.2f}")
    
    if latencies:
        print(f"Avg Latency:         {sum(latencies) / len(latencies):.4f}s")
        print(f"Min Latency:         {min(latencies):.4f}s")
        print(f"Max Latency:         {max(latencies):.4f}s")

    if failures:
        print("\n--- ERROR LOG (First 5) ---")
        for f in failures[:5]:
            print(f"Error: {f.get('error')}")

if __name__ == "__main__":
    # Note: If running in a Jupyter notebook, use: await run_load_test()
    try:
        asyncio.run(run_load_test())
    except KeyboardInterrupt:
        pass
