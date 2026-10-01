"""Plans the map art extraction from a local WoW client using the open-source `wowdata` CLI (npm @follenfang/wowdata).

Usage: python plan.py <product> <region> <out-dir>
  product: wow | wow_classic_beta        region: eu | us

Reads UiMap, UiMapXMapArt, UiMapArt, UiMapArtStyleLayer and UiMapArtTile from the client's own files and writes
<out-dir>/plan.json: one entry per distinct piece of map art, with the UiMap ids that use it and its base layer tiles.
Only zone-like maps are planned: continents (2), zones (3), micro maps (5) and orphans (6). The images are Blizzard's
art taken from the owner's own installation for a private home dashboard; they must not be committed or published.
"""
import json
import os
import subprocess
import sys

WOWDATA = os.environ.get("WOWDATA", "C:/Users/44750/.wowdata/bin/wowdata.exe")
CLIENT = os.environ.get("WOW_ROOT", "C:/Program Files (x86)/World of Warcraft")
KEEP_TYPES = {2, 3, 5, 6}


def sql(query, product, region):
    p = subprocess.run([WOWDATA, "sql", query, "--source", "local", "--path", CLIENT, "--region", region, "--product", product, "--build", "latest", "--locale", "enUS"],
                       capture_output=True, text=True, encoding="utf-8")
    out = p.stdout
    data = json.loads(out[out.index("{"):])
    if not data.get("ok"):
        raise SystemExit(f"query failed: {data}")
    return data["data"]["rows"]


def main():
    product, region, out_dir = sys.argv[1:4]
    os.makedirs(out_dir, exist_ok=True)
    maps = {r["ID"]: r for r in sql("SELECT ID, Name_lang, Type FROM UiMap", product, region) if r["Type"] in KEEP_TYPES}
    links = sql("SELECT UiMapID, UiMapArtID, PhaseID FROM UiMapXMapArt", product, region)
    arts = {r["ID"]: r["UiMapArtStyleID"] for r in sql("SELECT ID, UiMapArtStyleID FROM UiMapArt", product, region)}
    layers = {r["UiMapArtStyleID"]: r for r in sql("SELECT UiMapArtStyleID, LayerIndex, LayerWidth, LayerHeight, TileWidth, TileHeight FROM UiMapArtStyleLayer WHERE LayerIndex = 0", product, region)}
    tiles = {}
    for r in sql("SELECT UiMapArtID, RowIndex, ColIndex, FileDataID FROM UiMapArtTile WHERE LayerIndex = 0", product, region):
        tiles.setdefault(r["UiMapArtID"], []).append([r["RowIndex"], r["ColIndex"], r["FileDataID"]])

    # Several map ids can share art, and a map can have phased variants: keep the base (lowest phase) art for each map.
    best = {}
    for link in links:
        uid = link["UiMapID"]
        if uid not in maps or link["UiMapArtID"] not in tiles:
            continue
        if uid not in best or link["PhaseID"] < best[uid]["PhaseID"]:
            best[uid] = link
    plan = {}
    for uid, link in best.items():
        art = link["UiMapArtID"]
        layer = layers.get(arts.get(art))
        if not layer or not layer["LayerWidth"] or not layer["LayerHeight"]:
            continue
        entry = plan.setdefault(art, {"art": art, "width": layer["LayerWidth"], "height": layer["LayerHeight"], "tileW": layer["TileWidth"] or 256, "tileH": layer["TileHeight"] or 256, "maps": [], "tiles": tiles[art]})
        entry["maps"].append({"id": uid, "name": maps[uid]["Name_lang"], "type": maps[uid]["Type"]})
    result = sorted(plan.values(), key=lambda e: e["art"])
    json.dump(result, open(os.path.join(out_dir, "plan.json"), "w"), separators=(",", ":"))
    unique_tiles = {t[2] for e in result for t in e["tiles"]}
    print(f"{len(maps)} maps of the wanted types, {len(result)} distinct art sets, {len(unique_tiles)} unique tile files, "
          f"{sum(len(e['maps']) for e in result)} maps covered")


if __name__ == "__main__":
    main()
