#!/usr/bin/env python3
"""
Fetch a small, self-hosted set of Pokemon Mystery Dungeon overworld walk
sprites from PMDCollab/SpriteCollab.

SpriteCollab's Walk-Anim.png is an 8-row sheet: one row per facing direction
in the order S, SE, E, NE, N, NW, W, SW, and one column per frame. Frame size
and per-frame durations come from AnimData.xml.

Run from the project root:
    python3 scripts/fetch-sprites.py

The generated files live in public/sprites and are committed, so the site has
no runtime dependency on GitHub.
"""
from __future__ import annotations

import json
import os
import struct
import urllib.request
import xml.etree.ElementTree as ET

RAW = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master"
OUT = "public/sprites"
USER_AGENT = "Pokepack sprite fetcher (fan project)"

# A spread of eras, types and body shapes. The script skips any species whose
# base form has no usable Walk animation.
CANDIDATES = [
    ("0001", "Bulbasaur"),
    ("0004", "Charmander"),
    ("0007", "Squirtle"),
    ("0025", "Pikachu"),
    ("0039", "Jigglypuff"),
    ("0054", "Psyduck"),
    ("0094", "Gengar"),
    ("0133", "Eevee"),
    ("0143", "Snorlax"),
    ("0258", "Mudkip"),
    ("0282", "Gardevoir"),
    ("0448", "Lucario"),
    ("0722", "Rowlet"),
    ("0778", "Mimikyu"),
]

MAX_SPRITES = 12


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def parse_walk(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    anims = {anim.findtext("Name"): anim for anim in root.iter("Anim")}
    walk = anims.get("Walk")
    if walk is None:
        return None
    # A few submissions alias the animation instead of storing frames.
    seen = set()
    while walk is not None and walk.find("Durations") is None and walk.findtext("CopyOf"):
        name = walk.findtext("CopyOf")
        if name in seen:
            return None
        seen.add(name)
        walk = anims.get(name)
    if walk is None:
        return None

    width = int(walk.findtext("FrameWidth") or 0)
    height = int(walk.findtext("FrameHeight") or 0)
    durations = [
        int(node.text)
        for node in walk.findall("./Durations/Duration")
        if node.text and node.text.strip().isdigit()
    ]
    if not width or not height or not durations:
        return None
    return width, height, durations


def short_credit(credits: str) -> str:
    authors = []
    for line in credits.splitlines():
        parts = [part.strip() for part in line.split("\t")]
        if len(parts) < 5:
            continue
        animations = parts[4]
        if "Walk" not in animations:
            continue
        author = parts[1]
        if author and author not in authors:
            authors.append(author)
    return ", ".join(authors) if authors else "PMDCollab contributors"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    entries = []
    credit_blocks = []

    for dex, name in CANDIDATES:
        if len(entries) >= MAX_SPRITES:
            break
        slug = f"{dex}-{name.lower().replace(' ', '-')}"
        print(f"checking {slug} ...", end=" ", flush=True)
        try:
            anim_xml = download(f"{RAW}/sprite/{dex}/AnimData.xml")
            walk = parse_walk(anim_xml)
            if walk is None:
                print("no Walk animation")
                continue
            frame_w, frame_h, durations = walk

            sheet = download(f"{RAW}/sprite/{dex}/Walk-Anim.png")
            width, height = png_size(sheet)
            if height != frame_h * 8 or width % frame_w != 0:
                print(f"unexpected sheet {width}x{height} for {frame_w}x{frame_h}")
                continue
            columns = width // frame_w
            if columns < 1:
                print("no frames")
                continue
            if len(durations) != columns:
                # Keep the sheet usable even if a submission's metadata is odd.
                durations = (durations + [durations[-1]] * columns)[:columns]

            filename = f"{slug}.png"
            with open(os.path.join(OUT, filename), "wb") as handle:
                handle.write(sheet)

            try:
                credits = download(f"{RAW}/sprite/{dex}/credits.txt").decode("utf-8", "replace")
            except Exception:
                credits = f"No per-sprite credits file. Source: {RAW}/sprite/{dex}/"
            else:
                credit_blocks.append(
                    f"### {name} ({dex})\n\nSource: {RAW}/sprite/{dex}/\n\n"
                    f"```\n{credits.strip()}\n```\n"
                )

            entries.append(
                {
                    "id": slug,
                    "name": name,
                    "file": filename,
                    "frameWidth": frame_w,
                    "frameHeight": frame_h,
                    "columns": columns,
                    "durations": durations,
                    "credit": short_credit(credits),
                    "source": f"{RAW}/sprite/{dex}/",
                }
            )
            print(f"ok — {columns} frames, {frame_w}x{frame_h}")
        except Exception as error:  # noqa: BLE001 - best-effort asset fetch
            print(f"skipped ({error})")

    if not entries:
        raise SystemExit("No sprites were downloaded; aborting.")

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2)
        handle.write("\n")

    try:
        license_text = download(f"{RAW}/LICENSE.md").decode("utf-8", "replace")
    except Exception as error:  # noqa: BLE001
        license_text = (
            "PMDCollab SpriteCollab is licensed CC BY-NC 4.0.\n"
            f"Could not download the licence text: {error}\n"
            "See https://creativecommons.org/licenses/by-nc/4.0/\n"
        )
    with open(os.path.join(OUT, "LICENSE.md"), "w", encoding="utf-8") as handle:
        handle.write(license_text)

    with open(os.path.join(OUT, "CREDITS.md"), "w", encoding="utf-8") as handle:
        handle.write(
            "# Overworld sprite credits\n\n"
            "Pokémon Mystery Dungeon overworld sprites from "
            "[PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab), "
            "licensed [CC BY-NC 4.0](LICENSE.md). Only the `Walk-Anim.png` sheets "
            "are used, at their original pixel resolution. The full per-sprite "
            "credits supplied by the repository are reproduced below.\n\n"
        )
        handle.write("\n".join(credit_blocks))

    print(f"\nwrote {len(entries)} sprites to {OUT}")


if __name__ == "__main__":
    main()
