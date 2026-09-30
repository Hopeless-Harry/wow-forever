"""Generate the original MAMChroniclesIcon.tga (64x64, uncompressed 32-bit).

Open chronicle book with a dark-red cover and gold edging, plus a small
crossed-out magical spark. No text, no third-party art. Run from the
repository root:  python tools/mam-chronicles/make-icon.py
"""
import math
import struct
from pathlib import Path

SIZE = 64
SS = 4  # supersampling per axis
OUT = Path(__file__).resolve().parents[2] / "addons" / "MAMChronicles" / "MAMChroniclesIcon.tga"

BG = (30, 18, 24)
GOLD = (214, 170, 52)
COVER = (122, 20, 32)
PAGE = (238, 226, 198)
PAGE_LINE = (170, 150, 118)
SPARK = (196, 150, 255)
RED = (214, 36, 48)


def in_poly(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def spark(x, y, cx, cy, long, short):
    dx, dy = abs(x - cx), abs(y - cy)
    # four-pointed star: astroid-like concave shape
    return (dx / long) ** 0.6 + (dy / long) ** 0.6 <= 1 or (dx / short + dy / short <= 1.0)


def dist_to_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def shade(x, y):
    """Return an (r, g, b, a) sample for continuous coordinates in 0..64."""
    if not in_round_rect(x, y, 1, 1, 63, 63, 11):
        return (0, 0, 0, 0)
    colour = GOLD if not in_round_rect(x, y, 3, 3, 61, 61, 9) else BG
    # book cover and edging
    if in_round_rect(x, y, 8, 24, 56, 54, 3):
        colour = GOLD
        if in_round_rect(x, y, 10, 26, 54, 52, 2):
            colour = COVER
    left = [(12, 27), (31, 30), (31, 49), (12, 46)]
    right = [(52, 27), (33, 30), (33, 49), (52, 46)]
    if in_poly(x, y, left) or in_poly(x, y, right):
        colour = PAGE
        for k in range(3):
            off = 35 + k * 4.5
            for a, b, c, d in ((15, off - 7.5, 28, off - 3.5), (49, off - 7.5, 36, off - 3.5)):
                if dist_to_segment(x, y, a, b, c, d) < 0.55 and 30 <= off - 3.5 + 7 <= 52:
                    colour = PAGE_LINE
    if abs(x - 32) <= 1.1 and 29 <= y <= 50:
        colour = GOLD
    # spark with a red crossed-out ring, upper right
    scx, scy = 46, 15
    if spark(x, y, scx, scy, 9.5, 3.2):
        colour = SPARK
    ring = abs(math.hypot(x - scx, y - scy) - 11)
    if ring < 1.5 or dist_to_segment(x, y, scx - 8, scy + 8, scx + 8, scy - 8) < 1.6:
        if math.hypot(x - scx, y - scy) <= 12.6:
            colour = RED
    return colour + (255,)


def main():
    rows = []
    for py in range(SIZE):
        row = bytearray()
        for px in range(SIZE):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    cr, cg, cb, ca = shade(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)
                    r += cr * ca
                    g += cg * ca
                    b += cb * ca
                    a += ca
            n = SS * SS
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes((round(b / a), round(g / a), round(r / a), round(a / n)))
        rows.append(bytes(row))
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, SIZE, SIZE, 32, 0x28)
    OUT.write_bytes(header + b"".join(rows))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
