#!/usr/bin/env python3
"""Import high-resolution official game app icons from Apple's public catalog."""

from __future__ import annotations

import io
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "assets" / "games"
CATALOG = ROOT / "backend" / "internal" / "catalog" / "p24_snapshot.json"

SEARCH_OVERRIDES = {
    "CRYSTAL OF ALTLAN": "Crystal of Atlan",
    "DELTA FORCE - GARENA": "Garena Delta Force",
    "DELTA FORCE - STEAM": "Delta Force",
    "HONOR OF KING": "Honor of Kings",
    "LIGHT OF THEL NEW ERA": "Light of Thel New Era",
    "MAGIC CHESS : GO GO": "Magic Chess Go Go",
    "MOBILE LEGEND": "Mobile Legends Bang Bang",
    "NARUTO SHIPPUDEN": "Naruto Mobile game",
    "POINT BLANK - CASH": "Point Blank game",
    "PUBG MOBILE LITE": "PUBG Mobile",
    "PUBG NEW STATE MOBILE": "NEW STATE Mobile",
    "ROBLOX IDR": "Roblox",
}

MANUAL_ARTWORK = {
    "BLACK CLOVER M": "https://dl.memuplay.com/new_market/img/com.garena.game.bc.icon.2024-12-28-16-56-18.png",
    "CLOUD SONG: SAGA OF SKYWALK": "https://client-cdn.bangjeff.com/sipshop.cloud/product/Cloud%20SOng%20Saga%20of%20Skywalkers.jpg",
    "MADTALE IDLE RPG": "https://img.utdstc.com/icon/664/47e/66447e0355b638a9e7d67a9c7f454de8724346bb3c2845717d5c655a9f6949e1:600",
    "MARVEL RIVALS": "https://metabot.gg/marvelrivals/marvellogo.webp",
    "MARVEL SUPER WAR": "https://img.skich.io/games/icons/a28c765f-50d4-4695-b051-01cbf574cc71.jpg",
    "NARUTO SHIPPUDEN": "https://dl.memuplay.com/new_market/img/naruto.shippuden.andgame.google.icon.2025-06-19-17-36-01.png",
    "OMEGA LEGENDS": "https://img.utdstc.com/icon/eef/060/eef060b9c6548fecd51f08efc5c493bcf634cc7939db9b0652af7880503d5de9:600",
    "RACING MASTER": "https://dl.memuplay.com/new_market/img/com.netease.dfjsna.icon.2025-07-12-03-49-36.png",
}


def normalized(value: str) -> str:
    aliases = {"poll": "pool", "altlan": "atlan", "king": "kings"}
    words = re.findall(r"[a-z0-9]+", value.lower())
    return " ".join(aliases.get(word, word) for word in words if word not in {"garena", "steam", "cash", "idr"})


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalized(value)).strip("-")


def score(wanted: str, result: dict) -> tuple[int, int, int]:
    target = set(normalized(wanted).split())
    title = set(normalized(result.get("trackName", "")).split())
    overlap = len(target & title)
    missing = len(target - title)
    # Prefer exact title coverage, then official-looking popular listings.
    return (overlap * 20 - missing * 12, int(target <= title), int(result.get("userRatingCount", 0)))


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "AntaraPulsa asset importer"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 5:
                raise
            time.sleep(4 + attempt * 3)
    raise RuntimeError("unreachable")


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AntaraPulsa asset importer"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def main() -> None:
    products = json.loads(CATALOG.read_text(encoding="utf-8"))
    brands = sorted({item["brand_nama"].strip() for item in products if item.get("kategori_nama") == "Game"})
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, str | int]] = {}
    failures: list[str] = []

    for index, brand in enumerate(brands, 1):
        if brand in MANUAL_ARTWORK:
            raw = fetch_bytes(MANUAL_ARTWORK[brand])
            with Image.open(io.BytesIO(raw)) as image:
                image.load()
                image = ImageOps.fit(image.convert("RGBA"), (512, 512), Image.Resampling.LANCZOS)
                path = OUTPUT / f"provider-game-{slug(brand)}.png"
                image.save(path, "PNG", optimize=True)
            manifest[brand] = {"asset": f"/assets/games/{path.name}", "title": brand, "seller": "verified override", "trackId": 0}
            print(f"[{index:02}/{len(brands)}] {brand} -> verified artwork override")
            continue
        term = SEARCH_OVERRIDES.get(brand, brand)
        query = urllib.parse.urlencode({"term": term, "entity": "software", "country": "id", "limit": 25})
        data = fetch_json(f"https://itunes.apple.com/search?{query}")
        results = data.get("results", [])
        ranked = sorted(results, key=lambda item: score(term, item), reverse=True)
        if not ranked or score(term, ranked[0])[0] < 8:
            query = urllib.parse.urlencode({"term": term, "entity": "software", "country": "us", "limit": 25})
            results += fetch_json(f"https://itunes.apple.com/search?{query}").get("results", [])
        ranked = sorted(results, key=lambda item: score(term, item), reverse=True)
        if not ranked or score(term, ranked[0])[0] < 8:
            failures.append(brand)
            print(f"[{index:02}/{len(brands)}] MISS {brand}")
            continue

        selected = ranked[0]
        artwork = selected.get("artworkUrl512") or selected.get("artworkUrl100")
        if not artwork:
            failures.append(brand)
            print(f"[{index:02}/{len(brands)}] NO ART {brand}")
            continue
        artwork = re.sub(r"/[0-9]+x[0-9]+bb", "/512x512bb", artwork)
        raw = fetch_bytes(artwork)
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if min(image.size) < 256:
                raise RuntimeError(f"low-resolution artwork for {brand}: {image.size}")
            image = image.convert("RGBA")
            path = OUTPUT / f"provider-game-{slug(brand)}.png"
            image.save(path, "PNG", optimize=True)

        manifest[brand] = {
            "asset": f"/assets/games/{path.name}",
            "title": selected.get("trackName", ""),
            "seller": selected.get("sellerName", ""),
            "trackId": selected.get("trackId", 0),
        }
        print(f"[{index:02}/{len(brands)}] {brand} -> {selected.get('trackName')} ({selected.get('sellerName')})")
        time.sleep(0.9)

    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(manifest)}/{len(brands)} official app icons")
    if failures:
        print("Missing: " + ", ".join(failures))
        raise SystemExit(2)


if __name__ == "__main__":
    main()
