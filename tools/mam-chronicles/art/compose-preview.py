#!/usr/bin/env python3
"""Builds a rough mock of the Modern window from the real texture art, using the same nine-slice rules as Theme.lua.
Text is drawn as plain bars (no fonts), so this judges shape, colour and spacing, not wording.
Writes tools/mam-chronicles/art/preview/window.png. Needs numpy only."""
import pathlib, struct, zlib
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ART = HERE.parents[2] / "addons" / "MAMChronicles" / "Art"
OUT = HERE / "preview" / "window.png"

def load(name):
    d = (ART / f"{name}.tga").read_bytes()
    w, h = struct.unpack("<HH", d[12:16])
    px = np.frombuffer(d[18:], dtype=np.uint8).reshape(h, w, 4)[..., [2, 1, 0, 3]].astype(np.float32) / 255.0
    return px

def resize(img, w, h):
    w, h = max(1, int(round(w))), max(1, int(round(h)))
    ys = np.minimum((np.arange(h) * img.shape[0] / h).astype(int), img.shape[0] - 1)
    xs = np.minimum((np.arange(w) * img.shape[1] / w).astype(int), img.shape[1] - 1)
    return img[ys][:, xs]

class Scene:
    def __init__(self, w, h, bg):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 3), dtype=np.float32) + np.array(bg, dtype=np.float32)

    def blit(self, img, x, y, tint=None, alpha=1.0):
        x, y = int(round(x)), int(round(y))
        h, w = img.shape[:2]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(self.w, x + w), min(self.h, y + h)
        if x1 <= x0 or y1 <= y0: return
        part = img[y0 - y:y1 - y, x0 - x:x1 - x]
        rgb, a = part[..., :3], part[..., 3:4] * alpha
        if tint is not None: rgb = rgb * np.array(tint, dtype=np.float32)
        self.px[y0:y1, x0:x1] = rgb * a + self.px[y0:y1, x0:x1] * (1 - a)

    def rect(self, x, y, w, h, color, alpha=1.0):
        a = np.ones((int(h), int(w), 1), dtype=np.float32)
        self.blit(np.concatenate([np.zeros((int(h), int(w), 3), dtype=np.float32) + np.array(color, dtype=np.float32), a], axis=2), x, y, alpha=alpha)

    def nine(self, sheet, rect, slice_, x, y, w, h, corner=None, tint=None, outset=0, alpha=1.0):
        corner = corner or slice_
        img = load(sheet)
        rx, ry, rw, rh = rect
        x, y, w, h = x - outset, y - outset, w + 2 * outset, h + 2 * outset
        s = slice_
        src = img[ry:ry + rh, rx:rx + rw]
        c = corner
        cols = [(0, s, x, c), (s, rw - s, x + c, w - 2 * c), (rw - s, rw, x + w - c, c)]
        rows = [(0, s, y, c), (s, rh - s, y + c, h - 2 * c), (rh - s, rh, y + h - c, c)]
        for sy0, sy1, dy, dh in rows:
            for sx0, sx1, dx, dw in cols:
                piece = src[sy0:sy1, sx0:sx1]
                self.blit(resize(piece, dw, dh), dx, dy, tint=tint, alpha=alpha)

    def save(self, path):
        data = (np.clip(self.px, 0, 1) * 255 + 0.5).astype(np.uint8)
        data = np.dstack([data, np.full(data.shape[:2], 255, dtype=np.uint8)])
        raw = b"".join(b"\x00" + data[r].tobytes() for r in range(self.h))
        def chunk(tag, payload):
            body = tag + payload
            return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

GOLD = (1.0, 0.82, 0.0)
TEXT = (0.95, 0.92, 0.85)
MUTED = (0.745, 0.69, 0.545)

def bar(scene, x, y, w, color, h=6, alpha=1.0):
    scene.rect(x, y, w, h, color, alpha)

def main():
    W, H = 820, 600
    s = Scene(W, H, (0.22, 0.27, 0.32))
    wx, wy, ww, wh = 30, 30, 760, 540
    s.nine("Shadow", (0, 0, 128, 128), 40, wx, wy, ww, wh, corner=40, outset=26, alpha=0.9)
    s.nine("Frame", (0, 0, 256, 256), 18, wx, wy, ww, wh, corner=18)
    # title
    bar(s, wx + 290, wy + 18, 180, GOLD, 8)
    s.nine("ButtonRed", (0, 0, 256, 64), 14, wx + ww - 44, wy + 12, 28, 22, corner=10)
    # tabs
    tx = wx + 14
    for i in range(7):
        rect = (0, 64, 256, 64) if i == 0 else (0, 0, 256, 64)
        s.nine("Tab", rect, 12, tx, wy + 44, 84, 28, corner=10)
        bar(s, tx + 22, wy + 57, 40, GOLD if i == 0 else MUTED, 4)
        tx += 86
    s.rect(wx + 6, wy + 76, ww - 12, 1, (0.42, 0.33, 0.19))
    # greeting
    bar(s, wx + 28, wy + 92, 220, GOLD, 10); bar(s, wx + 28, wy + 110, 160, MUTED, 5)
    # getting-started card + buttons
    s.nine("Inset", (0, 0, 128, 128), 8, wx + 24, wy + 130, ww - 48, 90)
    bar(s, wx + 40, wy + 142, 110, GOLD, 6)
    for i in range(3): bar(s, wx + 40, wy + 162 + i * 14, 520 - i * 70, TEXT, 4, 0.8)
    s.nine("ButtonBrown", (0, 0, 256, 64), 14, wx + ww - 110, wy + 138, 70, 22, corner=10)
    # tiles
    tw = (ww - 48 - 16) // 3
    for i in range(3):
        x = wx + 24 + i * (tw + 8)
        s.nine("Inset", (0, 0, 128, 128), 8, x, wy + 232, tw, 58)
        bar(s, x + 14, wy + 246, 70, TEXT, 12); bar(s, x + 14, wy + 270, 90, MUTED, 5)
    # cards
    cw = (ww - 48 - 8) // 2
    s.nine("Inset", (0, 0, 128, 128), 8, wx + 24, wy + 302, cw, 150)
    s.nine("Inset", (0, 0, 128, 128), 8, wx + 32 + cw, wy + 302, cw, 150)
    bar(s, wx + 40, wy + 316, 100, GOLD, 6)
    s.nine("ButtonBrown", (0, 0, 256, 64), 14, wx + 24 + cw - 100, wy + 312, 90, 20, corner=9)
    for i in range(6): bar(s, wx + 40, wy + 344 + i * 16, 230 - (i % 3) * 40, TEXT, 4, 0.8)
    # medal rows inside right card
    tiers = [0, 1, 2, 3]
    for i, t in enumerate(tiers):
        y = wy + 336 + i * 28
        img = load("Badge")[:, t * 64:(t + 1) * 64]
        s.blit(resize(img, 24, 24), wx + 48 + cw, y)
        s.blit(resize(load("Bar")[0:16], 140, 8), wx + 80 + cw, y + 14)
        s.blit(resize(load("Bar")[16:32], 40 + i * 28, 8), wx + 80 + cw, y + 14, tint=(0.85, 0.23, 0.31))
        bar(s, wx + 80 + cw, y + 2, 90, GOLD if t > 1 else TEXT, 5)
    # footer: memory box and red button
    s.nine("Inset", (0, 0, 128, 128), 8, wx + 24, wy + 474, ww - 160, 30)
    bar(s, wx + 38, wy + 486, 220, MUTED, 4)
    s.nine("ButtonRed", (0, 0, 256, 64), 14, wx + ww - 124, wy + 474, 100, 30, corner=11)
    bar(s, wx + ww - 100, wy + 486, 52, (1.0, 0.91, 0.69), 5)
    # checkbox and divider samples
    s.blit(resize(load("Divider"), 300, 12), wx + 40, wy + 512)
    chk = load("Checkbox")
    s.blit(resize(chk[:, :64], 22, 22), wx + 360, wy + 506); s.blit(resize(chk[:, 64:], 22, 22), wx + 392, wy + 506)
    s.save(OUT)
    print("wrote", OUT)

if __name__ == "__main__":
    main()
