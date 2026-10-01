"""Exports the map tile BLPs listed in plan.json as PNG files with wowdata (resumable, parallel).

Usage: python fetch_tiles.py <product> <region> <out-dir> <types, e.g. 2,3> [limit]
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

WOWDATA = os.environ.get("WOWDATA", "C:/Users/44750/.wowdata/bin/wowdata.exe")
CLIENT = os.environ.get("WOW_ROOT", "C:/Program Files (x86)/World of Warcraft")


def export(job):
    fdid, path, product, region = job
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    tmp = path + ".part"
    p = subprocess.run([WOWDATA, "icon", "export", "--file-data-id", str(fdid), "--format", "png", "--output", tmp, "--source", "local", "--path", CLIENT,
                        "--region", region, "--product", product, "--build", "latest", "--locale", "enUS"], capture_output=True, text=True)
    if p.returncode == 0 and os.path.exists(tmp):
        os.replace(tmp, path)
        return True
    return False


def main():
    product, region, out_dir, types = sys.argv[1:5]
    limit = int(sys.argv[5]) if len(sys.argv) > 5 else None
    wanted = {int(t) for t in types.split(",")}
    plan = json.load(open(os.path.join(out_dir, "plan.json")))
    fdids = []
    seen = set()
    for entry in plan:
        if min(m["type"] for m in entry["maps"]) in wanted:
            for _, _, fdid in entry["tiles"]:
                if fdid not in seen:
                    seen.add(fdid)
                    fdids.append(fdid)
    if limit:
        fdids = fdids[:limit]
    tiles_dir = os.path.join(out_dir, "tiles")
    os.makedirs(tiles_dir, exist_ok=True)
    jobs = [(f, os.path.join(tiles_dir, f"{f}.png"), product, region) for f in fdids]
    start = time.time()
    done = failed = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for ok in pool.map(export, jobs):
            done += 1
            failed += 0 if ok else 1
            if done % 500 == 0:
                print(f"{done}/{len(jobs)} tiles, {failed} failed, {time.time() - start:.0f}s", flush=True)
    print(f"finished {done} tiles, {failed} failed, {time.time() - start:.0f}s")


if __name__ == "__main__":
    main()
