#!/usr/bin/env python3
"""Convert a Pulsa24Jam Produk H2HR dashboard text export to the embedded catalog."""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
from pathlib import Path


HEADERS = ("SKU", "Keterangan", "Harga")


def rupiah(value: str) -> int:
    digits = re.sub(r"\D", "", value)
    if not digits:
        raise ValueError(f"harga tidak valid: {value!r}")
    return int(digits)


def parse(source: Path) -> tuple[list[dict], dict]:
    raw = source.read_bytes()
    lines = [line.strip() for line in raw.decode("utf-8-sig").splitlines() if line.strip()]
    try:
        cursor = lines.index("Semua brand", lines.index("Daftar Produk")) + 1
    except ValueError as exc:
        raise ValueError("penanda 'Daftar Produk' tidak ditemukan") from exc

    products: list[dict] = []
    category = ""
    provider = ""
    pending: list[str] = []

    while cursor < len(lines):
        if tuple(lines[cursor : cursor + 3]) != HEADERS:
            pending.append(lines[cursor])
            cursor += 1
            continue

        headings = pending
        pending = []
        if len(headings) == 2:
            category, provider = headings
        elif len(headings) == 1:
            provider = headings[0]
        else:
            raise ValueError(f"hierarki kategori/provider rusak dekat baris {cursor + 1}: {headings!r}")
        cursor += 3

        while cursor < len(lines):
            if tuple(lines[cursor : cursor + 3]) == HEADERS:
                break
            if cursor + 4 >= len(lines):
                raise ValueError(f"produk tidak lengkap dekat baris {cursor + 1}")
            price_type = lines[cursor + 3]
            if price_type != "FIXED" and not price_type.startswith("OPEN_AMOUNT"):
                pending.append(lines[cursor])
                cursor += 1
                break

            sku, name, group, price_line = (
                lines[cursor], lines[cursor + 1], lines[cursor + 2], lines[cursor + 4]
            )
            is_open = price_type.startswith("OPEN_AMOUNT")
            products.append(
                {
                    "id": 0,
                    "sku": sku,
                    "nama": name,
                    "group_name": group,
                    "kategori_nama": category,
                    "brand_nama": provider,
                    "tipe_harga": "OPEN_AMOUNT" if is_open else "FIXED",
                    "harga": 0 if is_open else rupiah(price_line),
                    "fee_tambahan": rupiah(price_line) if is_open else 0,
                }
            )
            cursor += 5

    skus = [item["sku"] for item in products]
    duplicates = sorted(sku for sku, count in collections.Counter(skus).items() if count > 1)
    if duplicates:
        raise ValueError(f"SKU ganda ditemukan ({len(duplicates)}): {duplicates[:10]}")
    if len(products) != 15026:
        raise ValueError(f"jumlah produk {len(products)}, seharusnya 15026")

    fixed = sum(item["tipe_harga"] == "FIXED" for item in products)
    if fixed != 6246:
        raise ValueError(f"jumlah FIXED {fixed}, seharusnya 6246")
    metadata = {
        "source": "Pulsa24Jam Dashboard / Produk H2HR",
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "products": len(products),
        "fixed": fixed,
        "open_amount": len(products) - fixed,
        "categories": len({item["kategori_nama"] for item in products}),
        "providers": len({(item["kategori_nama"], item["brand_nama"]) for item in products}),
    }
    return products, metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("backend/internal/catalog/p24_snapshot.json"))
    parser.add_argument("--metadata", type=Path, default=Path("backend/internal/catalog/p24_snapshot.meta.json"))
    args = parser.parse_args()
    products, metadata = parse(args.source)
    args.output.write_text(json.dumps(products, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
