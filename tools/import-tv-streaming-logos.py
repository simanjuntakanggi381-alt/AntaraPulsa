#!/usr/bin/env python3
"""Cache crisp brand symbols for every TV & Streaming provider in the catalog."""

from __future__ import annotations

import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "assets" / "streaming"
CATALOG = ROOT / "backend" / "internal" / "catalog" / "p24_snapshot.json"
DOMAINS = {
    "beIN Sports": "beinsports.com",
    "Biznet": "biznetnetworks.com",
    "Bnetfit": "bnetfit.id",
    "Bstation": "bilibili.tv",
    "CBN": "cbn.id",
    "Centrin": "centrin.net.id",
    "Comet Internet": "comet.net.id",
    "First Media": "firstmedia.com",
    "GlobalXtreme": "globalxtreme.net",
    "Iconnet": "iconnet.id",
    "Jawara Vision": "jawaravision.com",
    "K-Vision": "k-vision.tv",
    "MNC Play": "mncplay.id",
    "MNC Vision": "mncvision.id",
    "MyRepublic": "myrepublic.co.id",
    "Nex Parabola": "nexparabola.com",
    "Oxygen": "oxygen.id",
    "Transvision": "transvision.co.id",
    "WeTV": "wetv.vip",
    "XL Home": "xlhome.co.id",
}

MANUAL_ARTWORK = {
    "CBN": "https://101internet.id/cdn/shop/files/cbn_0b50c7f6-0df9-470d-81a8-ebdcc1236f37.png?v=1713079986",
    "Centrin": "https://tenderstore.id/filesfree/Logo_2021-12-2114e68268811d3f8b1675c700161baf271234567890.jpg",
    "First Media": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/First_Media_logo.svg/3840px-First_Media_logo.svg.png",
    "Jawara Vision": "https://static.wixstatic.com/media/347b3f_10bc55bef8ed46949b7397886b37f759~mv2.jpg/v1/fill/w_640,h_500,al_c,q_90/347b3f_10bc55bef8ed46949b7397886b37f759~mv2.jpg",
    "MNC Play": "https://sgp1.digitaloceanspaces.com/inps/images/operator/mnc-play.png",
    "MNC Vision": "https://3.bp.blogspot.com/-wcIjsI9aQZ0/XBOEJCo694I/AAAAAAAAQ80/7uUBHv8CiHQld_8E2m8YQzfRKN6nvKETwCLcBGAs/s1600/MNC%2BVision.png",
    "Nex Parabola": "https://www.static-src.com/wcsstore/Indraprastha/images/brandlogo/BRD-33299/nex-parabola-logo.png",
    "WeTV": "https://dl.memuplay.com/new_market/img/com.tencent.qqlivei18n.icon.2025-06-20-21-17-49.png",
    "XL Home": "https://images.glints.com/unsafe/1200x0/glints-dashboard.oss-ap-southeast-1-internal.aliyuncs.com/company-logo/ed1d607394cd88922db92c0fedfb679a.png",
}


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AntaraPulsa asset importer"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main() -> None:
    products = json.loads(CATALOG.read_text(encoding="utf-8"))
    providers = sorted({item["brand_nama"].strip() for item in products if item.get("kategori_nama") == "TV & Streaming"})
    missing_domains = sorted(set(providers) - set(DOMAINS))
    if missing_domains:
        raise RuntimeError("Missing official domains: " + ", ".join(missing_domains))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    failures = []
    for provider in providers:
        domain = DOMAINS[provider]
        if provider in MANUAL_ARTWORK:
            raw = fetch(MANUAL_ARTWORK[provider])
            with Image.open(io.BytesIO(raw)) as source:
                source.load()
                logo = source.convert("RGBA")
                logo.thumbnail((480, 480), Image.Resampling.LANCZOS)
                image = Image.new("RGBA", (512, 512), (255, 255, 255, 0))
                image.alpha_composite(logo, ((512 - logo.width) // 2, (512 - logo.height) // 2))
                filename = f"provider-streaming-{key(provider)}.png"
                image.save(OUTPUT / filename, "PNG", optimize=True)
            manifest[provider] = {"asset": f"/assets/streaming/{filename}", "domain": domain, "size": [512, 512]}
            print(f"{provider}: verified artwork (512, 512)")
            continue
        query = urllib.parse.urlencode({"domain_url": f"https://{domain}", "sz": "256"})
        try:
            raw = fetch(f"https://www.google.com/s2/favicons?{query}")
        except Exception as error:
            failures.append(f"{provider} fetch error")
            print(f"MISS {provider}: {error}")
            continue
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if min(image.size) < 64:
                failures.append(f"{provider} {image.size}")
                print(f"MISS {provider}: {domain} {image.size}")
                continue
            image = image.convert("RGBA")
            filename = f"provider-streaming-{key(provider)}.png"
            image.save(OUTPUT / filename, "PNG", optimize=True)
        manifest[provider] = {"asset": f"/assets/streaming/{filename}", "domain": domain, "size": list(image.size)}
        print(f"{provider}: {domain} {image.size}")
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(manifest)}/{len(providers)} TV & Streaming symbols")
    if failures:
        print("Needs manual source: " + ", ".join(failures))
        raise SystemExit(2)


if __name__ == "__main__":
    main()
