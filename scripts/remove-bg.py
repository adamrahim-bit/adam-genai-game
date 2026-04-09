#!/usr/bin/env python3
"""
Usage: python3 scripts/remove-bg.py public/team-xyz.png
Removes near-black backgrounds from team images.
"""
import sys
from PIL import Image

for path in sys.argv[1:]:
    img = Image.open(path).convert("RGBA")
    data = img.getdata()
    new_data = []
    for r, g, b, a in data:
        if r < 30 and g < 30 and b < 30:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    img.save(path)
    print(f"✓ {path}")
