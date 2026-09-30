"""Bake the sky data Umbra ships with.

stars.b64  Float32 quadruples (ra deg, dec deg, V mag, B-V) for every star to mag 6.
mw.webp    Milky Way glow as an equirectangular map (RA across, Dec down),
           rasterised from the d3-celestial brightness contours, blurred and
           mottled so the band reads as dust and star clouds rather than bands.
"""
import json, base64, struct, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SRC = os.path.expanduser('~/work/data')
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
os.makedirs(OUT, exist_ok=True)

# ---- stars ---------------------------------------------------------------
stars = json.load(open(os.path.join(SRC, 'stars.6.json')))['features']
buf = bytearray()
for f in stars:
    ra, dec = f['geometry']['coordinates']
    ra %= 360.0
    mag = float(f['properties']['mag'])
    try:
        bv = float(f['properties']['bv'])
    except (TypeError, ValueError):
        bv = 0.6
    buf += struct.pack('<4f', ra, dec, mag, bv)
open(os.path.join(OUT, 'stars.b64'), 'w').write(base64.b64encode(bytes(buf)).decode())
print('stars', len(stars), len(buf), 'bytes')

# ---- milky way -----------------------------------------------------------
W, H = 2048, 1024
mw = json.load(open(os.path.join(SRC, 'mw.json')))['features']

def to_px(lon, lat):
    return ((lon % 360.0) / 360.0 * W, (90.0 - lat) / 180.0 * H)

acc = np.zeros((H, W), np.float32)
weights = {'ol1': 0.16, 'ol2': 0.2, 'ol3': 0.22, 'ol4': 0.22, 'ol5': 0.2}
for ft in mw:
    level = Image.new('1', (W, H), 0)
    for poly in ft['geometry']['coordinates']:
        for ring in poly:
            # Unwrap longitude so a ring crossing RA 0 stays contiguous.
            pts, prev, off = [], None, 0.0
            for lon, lat in ring:
                lon = lon % 360.0
                if prev is not None:
                    d = lon + off - prev
                    if d > 180: off -= 360
                    elif d < -180: off += 360
                x = lon + off
                pts.append((x, lat)); prev = x
            # A ring that wraps all the way round RA (a band edge) is closed
            # through the north pole; XOR of both edges then leaves the band.
            if abs(pts[-1][0] - pts[0][0]) > 180:
                pts += [(pts[-1][0], 90.5), (pts[0][0], 90.5)]
            rm = Image.new('1', (W, H), 0)
            dr = ImageDraw.Draw(rm)
            for shift in (-360.0, 0.0, 360.0):
                dr.polygon([((x + shift) / 360.0 * W, (90.0 - lat) / 180.0 * H) for x, lat in pts], fill=1)
            level = ImageChops.logical_xor(level, rm)
    acc += np.asarray(level, np.float32) * weights[ft['id']]

img = Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8))
soft = np.asarray(img.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
wide = np.asarray(img.filter(ImageFilter.GaussianBlur(22)), np.float32) / 255

# Multi-octave value noise for star clouds and dust.
rng = np.random.default_rng(7)
def octave(scale):
    g = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((W + 2 * scale, H + 2 * scale), Image.BICUBIC), np.float32)[:H, :W] / 255
noise = sum(octave(s) * a for s, a in ((64, 0.45), (24, 0.3), (9, 0.17), (4, 0.08)))
noise = (noise - noise.min()) / (noise.max() - noise.min())
fine = octave(3)

band = soft * 0.78 + wide * 0.35
clouds = band * (0.45 + 0.9 * noise ** 1.6) * (0.85 + 0.3 * fine)
# Dust: where the contours dip inside the band, darken harder than the blur alone.
dust = np.clip(wide * 1.3 - soft, 0, 1)
clouds = clouds * (1 - 0.7 * dust)
clouds = np.clip(clouds / np.percentile(clouds, 99.7), 0, 1) ** 1.1
out = Image.fromarray((clouds * 255).astype(np.uint8))
out.save(os.path.join(OUT, 'mw.webp'), 'WEBP', quality=82, method=6)
out.resize((1024, 512)).save('/tmp/mw_preview.png')
print('mw', os.path.getsize(os.path.join(OUT, 'mw.webp')), 'bytes')
