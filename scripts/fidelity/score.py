#!/usr/bin/env python3
"""Score one VeloxPDF output against the Chrome output for the same page.

  python3 -I score.py chrome.pdf velox.pdf out_prefix

Prints one JSON object: text coverage, SSIM, page counts, and writes <out_prefix>-side.png.
Needs pdftoppm and pdftotext (poppler) and Pillow. No numpy needed.
"""
import json, re, subprocess, sys, tempfile, os, html, warnings
warnings.simplefilter("ignore")
from collections import Counter
from PIL import Image

def pages_and_words(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    pages, cur = [], None
    for line in out.splitlines():
        m = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', line)
        if m:
            cur = {'w': float(m.group(1)), 'h': float(m.group(2)), 'words': []}
            pages.append(cur)
            continue
        m = re.search(r'<word xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">(.*)</word>', line)
        if m and cur is not None:
            x0, y0, x1, y1 = map(float, m.groups()[:4])
            cur['words'].append((html.unescape(m.group(5)), x0, y0, x1, y1))
    return pages

def norm(w):
    return re.sub(r'[^\w$%.@/-]+', '', w.lower())

def visible_words(pages):
    """Words drawn with a real box that lies inside the page."""
    out = Counter()
    for p in pages:
        for w, x0, y0, x1, y1 in p['words']:
            n = norm(w)
            if not n or x1 - x0 < 0.5 or y1 - y0 < 0.5:
                continue
            if x0 < -1 or y0 < -1 or x1 > p['w'] + 1 or y1 > p['h'] + 1:
                continue
            out[n] += 1
    return out

def overlaps(pages, frac=0.2):
    """Pairs of word boxes on one page that intersect by more than `frac` of the smaller box."""
    found = []
    for pi, p in enumerate(pages):
        ws = [w for w in p['words'] if w[3] - w[1] > 0 and w[4] - w[2] > 0 and norm(w[0])]
        for i in range(len(ws)):
            a = ws[i]
            for j in range(i + 1, len(ws)):
                b = ws[j]
                ix = min(a[3], b[3]) - max(a[1], b[1])
                iy = min(a[4], b[4]) - max(a[2], b[2])
                if ix <= 0 or iy <= 0:
                    continue
                small = min((a[3] - a[1]) * (a[4] - a[2]), (b[3] - b[1]) * (b[4] - b[2]))
                if small > 0 and ix * iy / small > frac:
                    found.append((pi + 1, a[0], b[0]))
    return found

def raster(pdf, prefix):
    subprocess.run(['pdftoppm', '-r', '72', '-png', '-f', '1', '-l', '1', pdf, prefix], check=True)
    for f in sorted(os.listdir(os.path.dirname(prefix) or '.')):
        if f.startswith(os.path.basename(prefix)) and f.endswith('.png'):
            return Image.open(os.path.join(os.path.dirname(prefix), f)).convert('RGB')

def ssim(a, b, width=300, win=8, step=4):
    g = []
    for im in (a, b):
        h = round(im.height * width / im.width)
        g.append(list(im.convert('L').resize((width, h), Image.BILINEAR).getdata()))
    h = min(round(a.height * width / a.width), round(b.height * width / b.width))
    A, B = g[0], g[1]
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    total, n = 0.0, 0
    for y in range(0, h - win + 1, step):
        for x in range(0, width - win + 1, step):
            pa, pb = [], []
            for yy in range(y, y + win):
                o = yy * width + x
                pa += A[o:o + win]; pb += B[o:o + win]
            N = len(pa)
            ma, mb = sum(pa) / N, sum(pb) / N
            va = sum((v - ma) ** 2 for v in pa) / N
            vb = sum((v - mb) ** 2 for v in pb) / N
            cov = sum((p - ma) * (q - mb) for p, q in zip(pa, pb)) / N
            total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
            n += 1
    return total / n if n else 0.0

def main():
    chrome, velox, prefix = sys.argv[1:4]
    cp, vp = pages_and_words(chrome), pages_and_words(velox)
    cw, vw = visible_words(cp), visible_words(vp)
    total = sum(cw.values())
    # Words Velox drew but pdftotext glued together ("number:INV-1") count as present: a Chrome word that is not
    # matched whole is looked for inside the Velox words nobody else used.
    spare = []
    for w, c in vw.items():
        spare += [w] * max(0, c - cw.get(w, 0))
    for w, c in list(cw.items()):
        for _ in range(max(0, c - vw.get(w, 0))):
            k = next((n for n, x in enumerate(spare) if w in x), None)
            if k is None:
                break
            x = spare.pop(k)
            at = x.index(w)
            spare += [part for part in (x[:at], x[at + len(w):]) if part]
            vw[w] = vw.get(w, 0) + 1
    matched = sum(min(c, vw.get(w, 0)) for w, c in cw.items())
    missing = sorted(((c - vw.get(w, 0), w) for w, c in cw.items() if c > vw.get(w, 0)), reverse=True)[:8]
    lost_list = sorted(c - vw.get(w, 0) for w, c in cw.items() if c > vw.get(w, 0))
    lost_words = []
    for w, c in sorted(cw.items()):
        lost_words += [w] * max(0, c - vw.get(w, 0))
    vo, co = overlaps(vp), overlaps(cp)
    ci = raster(chrome, prefix + '-chrome'); vi = raster(velox, prefix + '-velox')
    vi2 = vi.resize(ci.size) if vi.size != ci.size else vi
    s = ssim(ci, vi2)
    side = Image.new('RGB', (ci.width * 2 + 12, ci.height), (200, 60, 60))
    side.paste(ci, (0, 0)); side.paste(vi2, (ci.width + 12, 0))
    side.save(prefix + '-side.png')
    for suffix in ('-chrome', '-velox'):
        for f in os.listdir(os.path.dirname(prefix)):
            if f.startswith(os.path.basename(prefix) + suffix) and f.endswith('.png') and not f.endswith('-side.png'):
                os.remove(os.path.join(os.path.dirname(prefix), f))
    print(json.dumps({
        'chrome_words': total, 'matched_words': matched,
        'text_coverage': matched / total if total else 1.0,
        'ssim': max(0.0, s),
        'chrome_pages': len(cp), 'velox_pages': len(vp),
        'missing': [f'{w} x{c}' for c, w in missing],
        'lost_count': len(lost_words), 'lost_words': lost_words[:40],
        'overlap_velox': len(vo), 'overlap_chrome': len(co), 'extra_overlaps': max(0, len(vo) - len(co)),
        'overlap_pairs': [f'p{pg}: {a} / {b}' for pg, a, b in vo[:12]],
    }))

main()
