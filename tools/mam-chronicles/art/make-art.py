#!/usr/bin/env python3
"""Generates the original texture art for Moms Against Magic Chronicles.

Everything is drawn from maths (signed-distance shapes, gradients, bevels), so it is original work with no third-party art.
Output: uncompressed 32-bit TGA files (power-of-two sizes) in addons/MAMChronicles/Art, plus PNG previews in
tools/mam-chronicles/art/preview. Run:  python tools/mam-chronicles/art/make-art.py
Needs numpy only.
"""
import pathlib, struct, zlib
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "addons" / "MAMChronicles" / "Art"
PREVIEW = HERE / "preview"

# ---------------------------------------------------------------- palette
def hexc(value):
    value = value.lstrip("#")
    return np.array([int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)

GOLD_HI, GOLD_MID, GOLD_LO = hexc("#e3c078"), hexc("#a8843f"), hexc("#5d4726")
BRONZE_LINE = hexc("#2c2316")
INK = hexc("#0b0806")

# ---------------------------------------------------------------- canvas helpers
class Canvas:
    """Premultiplied RGBA float canvas."""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), dtype=np.float32)
        self.y, self.x = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5

    def over(self, rgb, alpha):
        alpha = np.clip(alpha, 0, 1).astype(np.float32)
        rgb = np.broadcast_to(np.asarray(rgb, dtype=np.float32), (self.h, self.w, 3))
        self.px[..., :3] = rgb * alpha[..., None] + self.px[..., :3] * (1 - alpha[..., None])
        self.px[..., 3] = alpha + self.px[..., 3] * (1 - alpha)

    def straight(self):
        a = self.px[..., 3:4]
        rgb = np.where(a > 1e-4, self.px[..., :3] / np.maximum(a, 1e-4), 0)
        return np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)], axis=2)

def sdf_rrect(c, x0, y0, x1, y1, r):
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    qx = np.abs(c.x - cx) - hx + r
    qy = np.abs(c.y - cy) - hy + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def cover(d):
    return np.clip(0.5 - d, 0, 1)

def band(d, inner, outer):
    """Coverage of the band where inner <= d <= outer (d is a signed distance, negative inside)."""
    return np.clip(cover(d - outer) - cover(d - inner), 0, 1)

def vgrad(c, top, bottom, y0=None, y1=None):
    y0 = 0 if y0 is None else y0
    y1 = c.h if y1 is None else y1
    t = np.clip((c.y - y0) / max(1e-6, (y1 - y0)), 0, 1)[..., None]
    return np.asarray(top, dtype=np.float32) * (1 - t) + np.asarray(bottom, dtype=np.float32) * t

def lit(c, d, strength=1.0):
    """Light from the top: +1 on top-facing edges, -1 on bottom-facing edges."""
    gy = np.gradient(d, axis=0)
    return np.clip(-gy, -1, 1) * strength

def seg_dist(c, ax, ay, bx, by):
    px, py = c.x - ax, c.y - ay
    dx, dy = bx - ax, by - ay
    t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(px - t * dx, py - t * dy)

def poly_cover(c, pts, ss=4):
    """Anti-aliased polygon coverage by supersampling (even-odd rule)."""
    h, w = c.h, c.w
    ys = (np.arange(h * ss) + 0.5) / ss
    xs = (np.arange(w * ss) + 0.5) / ss
    X, Y = np.meshgrid(xs, ys)
    inside = np.zeros_like(X, dtype=bool)
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cond = ((y1 > Y) != (y2 > Y)) & (X < (x2 - x1) * (Y - y1) / (y2 - y1 + 1e-9) + x1)
        inside ^= cond
    return inside.reshape(h, ss, w, ss).mean(axis=(1, 3)).astype(np.float32)

# ---------------------------------------------------------------- file output
def save_tga(canvas, name):
    OUT.mkdir(parents=True, exist_ok=True)
    data = (canvas.straight() * 255 + 0.5).astype(np.uint8)
    bgra = data[..., [2, 1, 0, 3]]
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, canvas.w, canvas.h, 32, 0x28)
    (OUT / f"{name}.tga").write_bytes(header + bgra.tobytes())

def save_png(array_rgba_uint8, path):
    h, w, _ = array_rgba_uint8.shape
    raw = b"".join(b"\x00" + array_rgba_uint8[row].tobytes() for row in range(h))
    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)

def preview_on(canvas, name, bg="#3a4a5a", scale=2):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    bgc = np.asarray(hexc(bg), dtype=np.float32)
    s = canvas.straight()
    out = s[..., :3] * s[..., 3:4] + bgc * (1 - s[..., 3:4])
    out = np.repeat(np.repeat(out, scale, axis=0), scale, axis=1)
    save_png((np.dstack([out, np.ones(out.shape[:2], dtype=np.float32)]) * 255).astype(np.uint8), PREVIEW / f"{name}.png")

# ---------------------------------------------------------------- art
def gold_border(c, d, width, top=GOLD_HI, mid=GOLD_MID, low=GOLD_LO, y0=0, y1=None):
    """A bevelled metallic border band of the given width just inside the shape edge (d = 0)."""
    y1 = c.h if y1 is None else y1
    t = np.clip((c.y - y0) / max(1e-6, (y1 - y0)), 0, 1)[..., None]
    upper = top * (1 - 2 * np.minimum(t, 0.5)) + mid * (2 * np.minimum(t, 0.5))
    lower = mid * (1 - 2 * np.maximum(t - 0.5, 0)) + low * (2 * np.maximum(t - 0.5, 0))
    colour = np.where(t < 0.5, upper, lower)
    shine = 1 + 0.18 * lit(c, d)[..., None]
    c.over(np.clip(colour * shine, 0, 1), band(d, -width, 0))

def make_frame():
    c = Canvas(256, 256)
    d = sdf_rrect(c, 3, 3, 253, 253, 14)
    c.over(vgrad(c, hexc("#1b1611"), hexc("#100c09"), 3, 253), cover(d) * 0.97)
    # faint inner vignette
    edge = np.clip(1 + d / 36.0, 0, 1)
    c.over(np.array([0, 0, 0]), edge * 0.35 * cover(d))
    gold_border(c, d, 3.0, y0=3, y1=253)
    c.over(BRONZE_LINE, band(d, -4.6, -3.0) * 0.95)
    c.over(GOLD_MID, band(d, -6.4, -4.6) * (1 - np.clip((c.y - 3) / 70.0, 0, 1)) * 0.22)
    for cx, cy in ((9, 9), (247, 9), (9, 247), (247, 247)):
        dot = np.hypot(c.x - cx, c.y - cy)
        c.over(GOLD_HI, cover(dot - 1.8) * 0.85)
    save_tga(c, "Frame"); preview_on(c, "Frame")
    return c

def make_inset():
    c = Canvas(128, 128)
    d = sdf_rrect(c, 1, 1, 127, 127, 6)
    c.over(hexc("#0c0a08"), cover(d))
    c.over(np.array([0, 0, 0]), band(d, -7, 0) * np.clip(1 - (c.y - 1) / 14.0, 0, 1) * 0.5)
    c.over(hexc("#3a2f1f"), band(d, -1.2, 0))
    c.over(hexc("#2a2217"), band(d, -2.4, -1.2) * np.clip((c.y - 64) / 64.0, 0, 1) * 0.6)
    save_tga(c, "Inset"); preview_on(c, "Inset")

def button_state(c, row, palette, state):
    y0 = row * 64
    d = sdf_rrect(c, 2, y0 + 2, 254, y0 + 62, 9)
    top, bottom, border_hi, border_lo = palette[state]
    pressed = state == "pressed"
    c.over(vgrad(c, bottom if pressed else top, top if pressed else bottom, y0 + 2, y0 + 62), cover(d))
    gloss = np.clip(1 - (c.y - (y0 + 2)) / 26.0, 0, 1) * cover(d)
    c.over(np.array([1, 1, 1]), gloss * (0.03 if pressed or state == "disabled" else 0.10))
    gold_border(c, d, 2.0, top=border_hi, mid=(border_hi + border_lo) / 2, low=border_lo, y0=y0 + 2, y1=y0 + 62)
    c.over(INK, band(d, -3.4, -2.0) * 0.5)

def make_buttons():
    red = {
        "normal": (hexc("#932626"), hexc("#651414"), hexc("#e8c66e"), hexc("#8a6d3b")),
        "hover": (hexc("#b03030"), hexc("#7a1a1a"), hexc("#ffe28a"), hexc("#b8944d")),
        "pressed": (hexc("#6a1414"), hexc("#8a1f1f"), hexc("#a8843f"), hexc("#5d4726")),
        "disabled": (hexc("#3b3430"), hexc("#2a2522"), hexc("#5a5246"), hexc("#3e382f")),
    }
    brown = {
        "normal": (hexc("#3a2f21"), hexc("#241c12"), hexc("#9c7d43"), hexc("#5d4726")),
        "hover": (hexc("#4a3c2a"), hexc("#2f2518"), hexc("#d2ad63"), hexc("#8a6d3b")),
        "pressed": (hexc("#1f1810"), hexc("#33281a"), hexc("#7a6030"), hexc("#4a3a20")),
        "disabled": (hexc("#26221d"), hexc("#1c1915"), hexc("#4a4338"), hexc("#332e26")),
    }
    for name, palette in (("ButtonRed", red), ("ButtonBrown", brown)):
        c = Canvas(256, 256)
        for row, state in enumerate(("normal", "hover", "pressed", "disabled")):
            button_state(c, row, palette, state)
        save_tga(c, name); preview_on(c, name)

def make_tabs():
    c = Canvas(256, 128)
    for row, selected in enumerate((False, True)):
        y0 = row * 64
        d = sdf_rrect(c, 2, y0 + 2, 254, y0 + 120, 11)
        clip = (c.y >= y0) & (c.y < y0 + 64)
        if selected:
            fill, lift = vgrad(c, hexc("#2e2418"), hexc("#1d160e"), y0 + 2, y0 + 62), 1.0
        else:
            fill, lift = vgrad(c, hexc("#1e1812"), hexc("#15110d"), y0 + 2, y0 + 62), 0.0
        c.over(fill, cover(d) * clip)
        gold_border(c, d, 1.6, top=GOLD_HI if selected else GOLD_MID, mid=GOLD_MID, low=GOLD_LO, y0=y0 + 2, y1=y0 + 62)
        c.px[..., 3] = np.where(clip, c.px[..., 3], c.px[..., 3])
        if selected:
            c.over(hexc("#e3c078"), band(d, -3.6, -1.6) * clip * (1 - np.clip((c.y - y0 - 2) / 12.0, 0, 1)) * 0.55)
            # crimson underline echoes the addon icon
            c.over(hexc("#cc3649"), clip * (c.y > y0 + 56) * (c.y < y0 + 60) * cover(np.abs(c.x - 128) - 100))
    # remove anything bleeding across the row split
    mask = ((c.y % 64) < 62).astype(np.float32)
    c.px *= mask[..., None]
    save_tga(c, "Tab"); preview_on(c, "Tab")

def make_bar():
    c = Canvas(256, 64)
    # row 0: track, row 1: fill (white-ish so it can be tinted), row 2: border only
    d0 = sdf_rrect(c, 1, 1, 255, 15, 6)
    c.over(hexc("#0a0806"), cover(d0) * (c.y < 16))
    c.over(np.array([0, 0, 0]), band(d0, -4, 0) * (c.y < 16) * 0.5)
    c.over(hexc("#3a2f1f"), band(d0, -1.1, 0) * (c.y < 16))
    d1 = sdf_rrect(c, 1, 17, 255, 31, 6)
    m1 = (c.y >= 16) & (c.y < 32)
    c.over(vgrad(c, hexc("#f4f4f4"), hexc("#b8b8b8"), 17, 31), cover(d1) * m1)
    c.over(np.array([1, 1, 1]), cover(d1) * m1 * np.clip(1 - (c.y - 17) / 6.0, 0, 1) * 0.35)
    c.over(np.array([0, 0, 0]), band(d1, -1.4, 0) * m1 * 0.25)
    d2 = sdf_rrect(c, 1, 33, 255, 47, 6)
    m2 = (c.y >= 32) & (c.y < 48)
    c.over(GOLD_MID, band(d2, -1.3, 0) * m2 * 0.9)
    save_tga(c, "Bar"); preview_on(c, "Bar")

TIERS = {
    "bronze": ("#e0a06a", "#9a5a2a", "#5a3010"),
    "silver": ("#eef2f8", "#aab4c4", "#5d6878"),
    "gold": ("#ffe28a", "#d8a82c", "#7a5610"),
    "platinum": ("#c8f4ff", "#6cc8e0", "#1f6a80"),
}

def star_points(cx, cy, outer, inner, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        ang = np.radians(rot + i * 180.0 / n)
        r = outer if i % 2 == 0 else inner
        pts.append((cx + r * np.cos(ang), cy + r * np.sin(ang)))
    return pts

def make_badges():
    c = Canvas(256, 64)
    for index, (name, (light, mid, dark)) in enumerate(TIERS.items()):
        ox = index * 64
        cx, cy = ox + 32, 32
        dist = np.hypot(c.x - cx, c.y - cy)
        light, mid, dark = hexc(light), hexc(mid), hexc(dark)
        c.over(np.array([0, 0, 0]), cover(dist - 30.5) * 0.35 * (1 - cover(dist - 27)))  # soft contact shadow
        # ring
        ring_t = np.clip((c.y - 4) / 56.0, 0, 1)[..., None]
        ring = light * (1 - ring_t) + dark * ring_t
        c.over(ring, cover(dist - 29.5) * (np.abs(c.x - cx) < 32))
        # inner disc
        disc_t = np.clip(dist / 23.0, 0, 1)[..., None]
        c.over(light * (1 - disc_t) * 0.55 + mid * (1 - (1 - disc_t) * 0.55), cover(dist - 23.5))
        c.over(dark, band(dist, -1.1, 0) * 0 + band(dist - 23.5, -1.0, 0) * 0.55)
        # engraved star
        star = poly_cover(Canvas_window(c, ox, 0, 64, 64), star_points(32, 33, 14, 5.8))
        full = np.zeros((c.h, c.w), dtype=np.float32)
        full[:, ox:ox + 64] = star
        c.over(dark, full * 0.85)
        shine = poly_cover(Canvas_window(c, ox, 0, 64, 64), star_points(32, 31.5, 13.2, 5.4))
        full2 = np.zeros((c.h, c.w), dtype=np.float32)
        full2[:, ox:ox + 64] = shine
        c.over(light, np.clip(full2 - full * 0.0, 0, 1) * 0.45 * (1 - full))
        # top highlight arc
        arc = cover(np.abs(dist - 26.5) - 0.9) * (c.y < cy - 6) * (np.abs(c.x - cx) < 18)
        c.over(np.array([1, 1, 1]), arc * 0.55)
    save_tga(c, "Badge"); preview_on(c, "Badge", scale=3)

class Canvas_window:
    """Lets poly_cover draw into a sub-rectangle of a bigger canvas."""
    def __init__(self, parent, ox, oy, w, h):
        self.w, self.h = w, h

def make_glow():
    c = Canvas(128, 128)
    r = np.hypot(c.x - 64, c.y - 64) / 62.0
    a = np.clip(1 - r, 0, 1) ** 2.2
    c.over(hexc("#ffd27a"), a * 0.9)
    c.over(np.array([1, 1, 1]), np.clip(1 - r * 2.2, 0, 1) ** 2 * 0.6)
    save_tga(c, "Glow"); preview_on(c, "Glow", bg="#101014")

def make_shadow():
    c = Canvas(128, 128)
    d = sdf_rrect(c, 34, 30, 94, 92, 10)
    a = np.exp(-(np.maximum(d, 0) / 14.0) ** 2) * 0.62
    c.over(np.array([0, 0, 0]), a)
    save_tga(c, "Shadow"); preview_on(c, "Shadow", bg="#c8c8c8")

def make_divider():
    c = Canvas(256, 16)
    line = np.clip(1 - np.abs(c.x - 128) / 122.0, 0, 1) ** 0.6
    c.over(GOLD_MID, cover(np.abs(c.y - 8) - 0.8) * line * 0.9)
    c.over(GOLD_HI, cover(np.abs(c.y - 8) - 0.4) * line * 0.5)
    diamond = cover((np.abs(c.x - 128) + np.abs(c.y - 8)) - 6)
    c.over(GOLD_MID, diamond)
    c.over(INK, cover((np.abs(c.x - 128) + np.abs(c.y - 8)) - 3.2))
    c.over(GOLD_HI, cover((np.abs(c.x - 128) + np.abs(c.y - 8)) - 1.6))
    save_tga(c, "Divider"); preview_on(c, "Divider", bg="#16120e")

def make_checkbox():
    c = Canvas(128, 64)
    for index, checked in enumerate((False, True)):
        ox = index * 64
        d = sdf_rrect(c, ox + 10, 10, ox + 54, 54, 6)
        m = (c.x >= ox) & (c.x < ox + 64)
        c.over(vgrad(c, hexc("#0e0b08"), hexc("#191410"), 10, 54), cover(d) * m)
        gold_border(c, d, 1.8, top=GOLD_HI if checked else GOLD_MID, mid=GOLD_MID, low=GOLD_LO, y0=10, y1=54)
        if checked:
            d1 = seg_dist(c, ox + 19, 33, ox + 28, 43)
            d2 = seg_dist(c, ox + 28, 43, ox + 46, 21)
            stroke = np.minimum(d1, d2)
            c.over(hexc("#7a1c1c"), cover(stroke - 4.4) * m * 0.0)
            c.over(hexc("#e8c66e"), cover(stroke - 3.6) * m)
            c.over(hexc("#fff3c4"), cover(stroke - 1.6) * m * 0.55)
    save_tga(c, "Checkbox"); preview_on(c, "Checkbox", bg="#16120e", scale=3)

def make_scroll():
    c = Canvas(64, 64)
    d = sdf_rrect(c, 1, 1, 31, 31, 12)
    m = (c.x < 32) & (c.y < 32)
    c.over(vgrad(c, hexc("#b8944d"), hexc("#6b5530"), 1, 31), cover(d) * m)
    c.over(np.array([1, 1, 1]), cover(d) * m * np.clip(1 - (c.y - 1) / 10.0, 0, 1) * 0.25)
    c.over(hexc("#2c2316"), band(d, -1.2, 0) * m * 0.8)
    d2 = sdf_rrect(c, 41, 1, 47, 63, 3)
    c.over(hexc("#0a0806"), cover(d2) * (c.x > 36))
    c.over(hexc("#2a2217"), band(d2, -1.0, 0) * (c.x > 36))
    save_tga(c, "Scroll"); preview_on(c, "Scroll", bg="#16120e", scale=4)

def make_toast():
    c = Canvas(512, 128)
    d = sdf_rrect(c, 3, 3, 509, 125, 14)
    c.over(vgrad(c, hexc("#1d1812"), hexc("#120e0a"), 3, 125), cover(d) * 0.97)
    c.over(GOLD_MID, cover(d) * np.clip(1 - (c.x - 3) / 120.0, 0, 1) * 0.16)
    gold_border(c, d, 2.4, y0=3, y1=125)
    c.over(BRONZE_LINE, band(d, -3.8, -2.4) * 0.95)
    save_tga(c, "Toast"); preview_on(c, "Toast")

def compose_preview():
    """A rough composite of the window using the same slice maths the addon uses, to judge the look."""
    from PIL_free import compose  # noqa (kept out of the default path)

def main():
    make_frame(); make_inset(); make_buttons(); make_tabs(); make_bar(); make_badges()
    make_glow(); make_shadow(); make_divider(); make_checkbox(); make_scroll(); make_toast()
    print("wrote", len(list(OUT.glob("*.tga"))), "textures to", OUT)

if __name__ == "__main__":
    main()
