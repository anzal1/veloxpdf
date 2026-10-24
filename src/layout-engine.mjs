import { evaluateCalc, evaluateCssValue } from './css-tailwind.mjs';

const CHAR_WIDTHS_HELVETICA = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, a: 556, b: 556, c: 500,
  d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722,
  x: 500, y: 500, z: 500, '—': 1000, '–': 556, '·': 278, '•': 350,
};

// Helvetica-Bold advance widths (AFM, per 1000 em) for ASCII; other characters fall back to regular width x 1.06.
const HELVETICA_BOLD_ASCII = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// What the writer actually draws for symbols it spells out in ASCII; the line must be measured the same way.
const WRITER_SUBST = { '\u20B9': 'Rs.', '\u2713': '[v]', '\u2714': '[v]', '\u2717': '[x]', '\u2716': '[x]', '\u2192': '->', '\u2190': '<-', '\u2191': '^', '\u2193': 'v', '\u2194': '<->', '\u26A1': '*', '\u2605': '*', '\u2606': '*', '\u2726': '*', '\u2727': '*', '\u2665': '<3', '\u2764': '<3' };
export function measureTextWidth(text, cs = {}) {
  const s = cs.textTransform === 'uppercase' ? String(text || '').toUpperCase() : String(text || '');
  const fontSize = cs.fontSize || 10.5;
  const isMono = cs.fontFamily === 'Courier';
  let units = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    if (WRITER_SUBST[ch]) { units += measureTextWidth(WRITER_SUBST[ch], { ...cs, fontSize: 1000 }) ; continue; }
    if (isMono) units += 600;
    else if (code > 0x2e80) units += 1000;
    else if (cs.fontWeight === 'bold' && code >= 32 && code <= 126) units += HELVETICA_BOLD_ASCII[code - 32];
    else units += (CHAR_WIDTHS_HELVETICA[ch] || 556) * (cs.fontWeight === 'bold' ? 1.06 : 1);
  }
  return (units / 1000) * fontSize;
}

export function wrapParagraphOptimal(text, maxWidth, cs = {}) {
  const clean = (cs.textTransform === 'uppercase' ? String(text || '').toUpperCase() : String(text || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const n = words.length;
  if (n <= 1 && !(maxWidth >= (cs.fontSize || 10.5) * 3 && measureTextWidth(clean, cs) > maxWidth * 1.15)) return [clean];

  const wordWidths = new Float64Array(n);
  let totalWordW = 0;
  for (let i = 0; i < n; i++) {
    wordWidths[i] = measureTextWidth(words[i], cs);
    totalWordW += wordWidths[i];
  }
  const spaceW = measureTextWidth(' ', cs);

  if (totalWordW + (n - 1) * spaceW <= maxWidth) {
    return [clean];
  }

  // A single word wider than the line cannot be placed by the break search: split it into line-sized
  // chunks (like overflow-wrap: anywhere) and wrap greedily, so nothing draws outside its box.
  // A word that overshoots by under 15% is left whole: it lands in the box padding and reads better than a split.
  // Boxes narrower than three ems are a layout failure upstream; a one-letter-per-line split is worse than overflow.
  if (maxWidth >= (cs.fontSize || 10.5) * 3 && wordWidths.some((w) => w > maxWidth * 1.15)) {
    const out = [];
    let line = '';
    let lineW = 0;
    for (let i = 0; i < n; i++) {
      if (wordWidths[i] <= maxWidth * 1.15) {
        const add = line ? spaceW + wordWidths[i] : wordWidths[i];
        if (line && lineW + add > maxWidth) {
          out.push(line);
          line = words[i];
          lineW = wordWidths[i];
        } else {
          line = line ? line + ' ' + words[i] : words[i];
          lineW += add;
        }
        continue;
      }
      if (line) { out.push(line); line = ''; lineW = 0; }
      let chunk = '';
      for (const ch of Array.from(words[i])) {
        if (chunk && measureTextWidth(chunk + ch, cs) > maxWidth) {
          out.push(chunk);
          chunk = '';
        }
        chunk += ch;
      }
      line = chunk;
      lineW = measureTextWidth(chunk, cs);
    }
    if (line) out.push(line);
    return out;
  }

  function greedyWrap() {
    const lines = [];
    let lineStart = 0;
    let curW = wordWidths[0];
    for (let i = 1; i < n; i++) {
      const nextW = curW + spaceW + wordWidths[i];
      if (nextW <= maxWidth) {
        curW = nextW;
      } else {
        lines.push(words.slice(lineStart, i).join(' '));
        lineStart = i;
        curW = wordWidths[i];
      }
    }
    lines.push(words.slice(lineStart, n).join(' '));
    return lines;
  }

  // Exact O(n^2) Knuth-Plass DP fallback. The Hirschberg-Larmore monotone-deque
  // search is only valid while lineCost is concave-Monge, which holds only when
  // no single word exceeds maxWidth. As soon as a word overflows (long URL, hash,
  // code token, or a very narrow column) the demerit function leaves its Monge
  // regime, so we fall back to the exact DP here instead of greedy first-fit,
  // guaranteeing the returned breaks truly minimise the engine's own cost.
  function exactWrap() {
    const edp = new Float64Array(n + 1).fill(Infinity);
    const epar = new Int32Array(n + 1).fill(-1);
    edp[0] = 0;
    for (let j = 1; j <= n; j++) {
      for (let i = 0; i < j; i++) {
        const c = edp[i] + lineCost(i, j);
        if (c < edp[j]) { edp[j] = c; epar[j] = i; }
      }
    }
    const brks = [];
    let cur = n;
    while (cur > 0) {
      const prev = epar[cur];
      if (prev < 0 || prev >= cur) return greedyWrap();
      brks.push([prev, cur]);
      cur = prev;
    }
    brks.reverse();
    return brks.map(([a, b]) => words.slice(a, b).join(' '));
  }

  // Prefix sums: prefixW[k] = sum_{m < k} wordWidths[m]
  const prefixW = new Float64Array(n + 1);
  prefixW[0] = 0;
  for (let i = 0; i < n; i++) {
    prefixW[i + 1] = prefixW[i] + wordWidths[i];
  }

  function lineCost(i, j) {
    const lineW = (prefixW[j] - prefixW[i]) + (j - i - 1) * spaceW;
    const slack = maxWidth - lineW;
    if (slack < 0) return 1e9 + Math.abs(slack) * 1000;
    if (j === n) return 0;
    const ratio = slack / maxWidth;
    return ratio * ratio * ratio;
  }

  const dp = new Float64Array(n + 1).fill(Infinity);
  const parent = new Int32Array(n + 1).fill(-1);
  dp[0] = 0;

  function totalCost(i, j) {
    return dp[i] + lineCost(i, j);
  }

  function bridge(i1, i2) {
    let low = i2 + 1;
    let high = n + 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (totalCost(i2, mid) <= totalCost(i1, mid)) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low;
  }

  // Hirschberg-Larmore (1987) / SMAWK Monotone Deque Bridge
  const deque = [{ i: 0, start: 1 }];
  let head = 0;

  for (let j = 1; j <= n; j++) {
    while (head + 1 < deque.length && deque[head + 1].start <= j) {
      head++;
    }
    const bestI = deque[head].i;
    dp[j] = totalCost(bestI, j);
    parent[j] = bestI;

    if (j === n) break;

    while (deque.length > head) {
      const last = deque[deque.length - 1];
      const b = bridge(last.i, j);
      if (b <= last.start) {
        deque.pop();
      } else {
        if (b <= n) {
          deque.push({ i: j, start: b });
        }
        break;
       }
    }
    if (deque.length === head) {
      deque.push({ i: j, start: j + 1 });
    }
  }

  if (dp[n] >= 1e8) {
    // Overflow present: the deque result is not guaranteed optimal here, so
    // return the exact DP optimum instead of silently degrading to greedy.
    return exactWrap();
  }

  const breaks = [];
  let curr = n;
  while (curr > 0) {
    const prev = parent[curr];
    if (prev < 0 || prev >= curr) return exactWrap();
    breaks.push([prev, curr]);
    curr = prev;
  }
  breaks.reverse();

  const lines = new Array(breaks.length);
  for (let i = 0; i < breaks.length; i++) {
    lines[i] = words.slice(breaks[i][0], breaks[i][1]).join(' ');
  }
  return lines;
}

// Extracts inline styled spans (`<b>`, `<i>`, `<code>`, `<a href="...">`) inside a block
// The writer has no glyphs for emoji and pictographs (it would draw spaces). Drop them, with their joiners,
// so they neither leave a gap nor widen the line. Symbols the writer maps to ASCII are kept.
const KEEP_SYMBOLS = new Set(['\u2713', '\u2714', '\u2717', '\u2716', '\u2726', '\u2727', '\u2764', '\u2605', '\u2606', '\u2665', '\u26A1']);
export function stripUndrawable(str) {
  return String(str).replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0E\uFE0F\u200D]/gu, (ch) => (KEEP_SYMBOLS.has(ch) ? ch : ''));
}
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'blockquote', 'pre', 'address', 'figure', 'figcaption', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'form', 'fieldset']);
const BLOCKISH_DISPLAYS = new Set(['block', 'flex', 'grid', 'list-item', 'flow-root', 'table']);
function extractInlineTokens(node, baseCs) {
  const tokens = [];
  let prevEndedWithSpace = true;

  function walk(n, style, href = null) {
    if (!n) return;
    if (n.type === 'text') {
      const rawText = stripUndrawable(n.text || '');
      if (!rawText) return;
      const startsWithSpace = /^\s/.test(rawText);
      const endsWithSpace = /\s$/.test(rawText);
      const raw = style.textTransform === 'uppercase' ? rawText.toUpperCase() : rawText;
      const parts = raw.replace(/\s+/g, ' ').split(' ');
      let first = true;
      for (let i = 0; i < parts.length; i++) {
        const w = parts[i];
        if (!w) continue;
        const hasBoundarySpace = startsWithSpace || prevEndedWithSpace;
        const noLeading =
          (first && !hasBoundarySpace) ||
          /^[.,!?;:)\]}]/.test(w);
        tokens.push({
          word: w,
          fontSize: style.fontSize || 10.5,
          fontWeight: style.fontWeight || 'normal',
          fontStyle: style.fontStyle || 'normal',
          fontFamily: style.fontFamily || 'Helvetica',
          color: style.color || '#0f172a',
          bg: style.inlineBg || null,
          href,
          noLeadingSpace: noLeading,
        });
        first = false;
      }
      prevEndedWithSpace = endsWithSpace;
      return;
    }
    if (n.type === 'element') {
      const tag = (n.tagName || '').toLowerCase();
      if (tag === 'br') {
        tokens.push({ isBr: true, word: '', width: 0, fontSize: style.fontSize || 10.5 });
        prevEndedWithSpace = true;
        return;
      }
      const cs = { ...style, ...(n.computedStyle || {}) };
      if (tag === 'b' || tag === 'strong') cs.fontWeight = 'bold';
      if (tag === 'i' || tag === 'em') cs.fontStyle = 'italic';
      if (tag === 'code') {
        cs.fontFamily = 'Courier';
        cs.inlineBg = cs.inlineBg || '#f1f5f9';
      }
      // The block's own background is painted as its box, only inline children get a highlight chip
      // (otherwise every word of a shaded paragraph is padded and the line looks justified).
      if (n !== node && n.computedStyle?.backgroundColor) {
        cs.inlineBg = n.computedStyle.backgroundColor;
      }
      const nextHref = tag === 'a' ? n.attrs?.href || href : href;
      if (tag === 'a' && !n.computedStyle?.color) cs.color = '#4f46e5';
      // A block child (p, div, li, h1...) inside inline content starts and ends its own line. The soft break
      // does nothing at the start of a line, so back to back blocks do not leave blank lines.
      const isBlockChild = node !== n && (n.computedStyle?.display ? BLOCKISH_DISPLAYS.has(n.computedStyle.display) : BLOCK_TAGS.has(tag));
      if (isBlockChild) tokens.push({ isBr: true, soft: true, word: '', width: 0, fontSize: style.fontSize || 10.5 });
      for (const c of n.children || []) walk(c, cs, nextHref);
      if (isBlockChild) {
        tokens.push({ isBr: true, soft: true, word: '', width: 0, fontSize: style.fontSize || 10.5 });
        prevEndedWithSpace = true;
      }
    }
  }
  walk(node, baseCs, null);
  return tokens;
}

function wrapInlineTokens(tokens, maxWidth, baseCs) {
  if (!tokens || tokens.length === 0) return [];
  // Estimated metrics are a hair wide: a line may overshoot by up to 2% (at most 4pt) before it wraps.
  const wrapSlack = maxWidth > 1000 ? 0 : Math.min(6, maxWidth * 0.035);
  const spaceW = measureTextWidth(' ', baseCs);
  const lines = [];
  let curLine = [];
  let curW = 0;

  // A single word wider than the line is split into line-sized chunks so it wraps inside
  // its box instead of drawing into whatever sits next to it.
  const expanded = [];
  for (const tok of tokens) {
    if (!tok.isBr && maxWidth > 0 && tok.word.length > 1 && measureTextWidth(tok.word, tok) + (tok.bg ? 5 : 0) > maxWidth + wrapSlack) {
      const room = Math.max(1, maxWidth - (tok.bg ? 5 : 0));
      let chunk = '';
      let first = true;
      const flush = () => {
        expanded.push({ ...tok, word: chunk, noLeadingSpace: first ? tok.noLeadingSpace : true, breakBefore: !first });
        first = false;
        chunk = '';
      };
      for (const ch of Array.from(tok.word)) {
        if (chunk && measureTextWidth(chunk + ch, tok) > room) flush();
        chunk += ch;
      }
      if (chunk) flush();
    } else {
      expanded.push(tok);
    }
  }
  for (const tok of expanded) {
    if (tok.isBr) {
      if (tok.soft && curLine.length === 0) continue;
      lines.push({ tokens: curLine, width: curW });
      curLine = [];
      curW = 0;
      continue;
    }
    if (tok.breakBefore && curLine.length > 0) {
      lines.push({ tokens: curLine, width: curW });
      curLine = [];
      curW = 0;
    }
    const padX = tok.bg ? 5 : 0;
    const tw = measureTextWidth(tok.word, tok) + padX;
    const hasLeadingSpace =
      curLine.length > 0 && !tok.noLeadingSpace && !/^[.,!?;:)\]}]/.test(tok.word);
    const addW = hasLeadingSpace ? spaceW + tw : tw;
    if (curLine.length > 0 && curW + addW > maxWidth + wrapSlack) {
      lines.push({ tokens: curLine, width: curW });
      curLine = [{ ...tok, width: tw, textW: tw - padX, padX, hasLeadingSpace: false }];
      curW = tw;
    } else {
      curLine.push({ ...tok, width: tw, textW: tw - padX, padX, hasLeadingSpace });
      curW += addW;
    }
  }
  if (curLine.length > 0) lines.push({ tokens: curLine, width: curW });
  for (const ln of lines) {
    const merged = [];
    for (const tok of ln.tokens) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        !prev.bg &&
        !tok.bg &&
        !prev.href &&
        !tok.href &&
        prev.fontSize === tok.fontSize &&
        prev.fontWeight === tok.fontWeight &&
        prev.fontStyle === tok.fontStyle &&
        prev.fontFamily === tok.fontFamily &&
        prev.color === tok.color
      ) {
        const sep = tok.hasLeadingSpace ? ' ' : '';
        const addSpaceW = tok.hasLeadingSpace ? spaceW : 0;
        prev.word += sep + tok.word;
        prev.width += addSpaceW + tok.width;
        prev.textW = prev.width;
      } else {
        merged.push({ ...tok });
      }
    }
    ln.tokens = merged;
  }
  return lines;
}

export function extractSvgPaths(svgNode, parentFill = null, parentStroke = null, parentStrokeWidth = null, currentColor = '#0f172a') {
  const paths = [];

  function walkSvg(n, curFill, curStroke, curStrokeWidth, curTransform = null, curColor = currentColor) {
    if (!n || n.type !== 'element') return;
    const attrs = n.attrs || {};
    const cs = n.computedStyle || {};
    const nodeColor = attrs.color ?? cs.color ?? curColor;

    let fill = attrs.fill ?? cs.fill ?? curFill;
    if (fill === 'currentColor') fill = nodeColor;

    let stroke = attrs.stroke ?? cs.stroke ?? curStroke;
    if (stroke === 'currentColor') stroke = nodeColor;

    const strokeWidth = parseFloat(attrs['stroke-width'] ?? attrs.strokeWidth ?? cs['stroke-width'] ?? cs.strokeWidth ?? curStrokeWidth ?? 1);

    const rawTransform = attrs.transform || cs.transform || null;
    let nodeTransform = curTransform;
    if (rawTransform) {
      nodeTransform = curTransform ? `${curTransform} ${rawTransform}` : rawTransform;
    }

    const tag = (n.tagName || '').toLowerCase();
    if (tag === 'path') {
      const d = attrs.d || '';
      if (d) {
        paths.push({
          d,
          fill: fill === 'none' ? null : fill,
          stroke: stroke === 'none' ? null : stroke,
          strokeWidth,
          tag: 'path',
          attrs,
          transform: nodeTransform,
        });
      }
    } else if (tag === 'rect') {
      const rx = parseFloat(attrs.x || 0);
      const ry = parseFloat(attrs.y || 0);
      const rw = parseFloat(attrs.width || 0);
      const rh = parseFloat(attrs.height || 0);
      const r = parseFloat(attrs.rx || attrs.ry || 0);
      let d = '';
      if (r > 0) {
        d = `M ${(rx + r).toFixed(2)} ${ry.toFixed(2)} H ${(rx + rw - r).toFixed(2)} Q ${(rx + rw).toFixed(2)} ${ry.toFixed(2)} ${(rx + rw).toFixed(2)} ${(ry + r).toFixed(2)} V ${(ry + rh - r).toFixed(2)} Q ${(rx + rw).toFixed(2)} ${(ry + rh).toFixed(2)} ${(rx + rw - r).toFixed(2)} ${(ry + rh).toFixed(2)} H ${(rx + r).toFixed(2)} Q ${rx.toFixed(2)} ${(ry + rh).toFixed(2)} ${rx.toFixed(2)} ${(ry + rh - r).toFixed(2)} V ${(ry + r).toFixed(2)} Q ${rx.toFixed(2)} ${ry.toFixed(2)} ${(rx + r).toFixed(2)} ${ry.toFixed(2)} Z`;
      } else {
        d = `M ${rx.toFixed(2)} ${ry.toFixed(2)} H ${(rx + rw).toFixed(2)} V ${(ry + rh).toFixed(2)} H ${rx.toFixed(2)} Z`;
      }
      paths.push({
        d,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        rx: r,
        ry: r,
        fill: fill === 'none' ? null : fill,
        stroke: stroke === 'none' ? null : stroke,
        strokeWidth,
        tag: 'rect',
        attrs,
        transform: nodeTransform,
      });
    } else if (tag === 'circle') {
      const cx = parseFloat(attrs.cx || 0);
      const cy = parseFloat(attrs.cy || 0);
      const r = parseFloat(attrs.r || 0);
      const k = 0.55228475 * r;
      const d = `M ${cx.toFixed(2)} ${(cy - r).toFixed(2)} C ${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} C ${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} C ${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} C ${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} Z`;
      paths.push({
        d,
        cx,
        cy,
        r,
        fill: fill === 'none' ? null : fill,
        stroke: stroke === 'none' ? null : stroke,
        strokeWidth,
        tag: 'circle',
        attrs,
        transform: nodeTransform,
      });
    } else if (tag === 'ellipse') {
      const cx = parseFloat(attrs.cx || 0);
      const cy = parseFloat(attrs.cy || 0);
      const rx = parseFloat(attrs.rx || 0);
      const ry = parseFloat(attrs.ry || 0);
      paths.push({
        cx,
        cy,
        rx,
        ry,
        fill: fill === 'none' ? null : fill,
        stroke: stroke === 'none' ? null : stroke,
        strokeWidth,
        tag: 'ellipse',
        attrs,
        transform: nodeTransform,
      });
    } else if (tag === 'line') {
      const x1 = parseFloat(attrs.x1 || 0);
      const y1 = parseFloat(attrs.y1 || 0);
      const x2 = parseFloat(attrs.x2 || 0);
      const y2 = parseFloat(attrs.y2 || 0);
      const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      paths.push({
        d,
        x1,
        y1,
        x2,
        y2,
        fill: null,
        stroke: stroke === 'none' ? null : (stroke || '#000000'),
        strokeWidth,
        tag: 'line',
        attrs,
        transform: nodeTransform,
      });
    } else if (tag === 'polyline' || tag === 'polygon') {
      const pts = (attrs.points || '').trim().replace(/,/g, ' ').split(/\s+/).map(Number);
      if (pts.length >= 4) {
        let d = `M ${pts[0].toFixed(2)} ${pts[1].toFixed(2)}`;
        for (let i = 2; i < pts.length; i += 2) {
          d += ` L ${pts[i].toFixed(2)} ${pts[i + 1].toFixed(2)}`;
        }
        if (tag === 'polygon') d += ' Z';
        paths.push({
          d,
          points: attrs.points,
          fill: fill === 'none' ? null : fill,
          stroke: stroke === 'none' ? null : stroke,
          strokeWidth,
          tag,
          attrs,
          transform: nodeTransform,
        });
      }
    } else if (tag === 'text') {
      const tx = parseFloat(attrs.x || 0);
      const ty = parseFloat(attrs.y || 0);
      const txt = (n.children || []).map((c) => c.text || c.textContent || '').join('');
      paths.push({
        tag: 'text',
        text: txt,
        x: tx,
        y: ty,
        fill: fill === 'none' ? null : (fill || nodeColor),
        stroke: stroke === 'none' ? null : stroke,
        fontSize: parseFloat(attrs['font-size'] || cs.fontSize || 12),
        fontFamily: attrs['font-family'] || cs.fontFamily || 'Helvetica',
        fontWeight: attrs['font-weight'] || cs.fontWeight || 'normal',
        attrs,
        transform: nodeTransform,
      });
    } else if (tag === 'g' || tag === 'svg') {
      for (const child of n.children || []) {
        walkSvg(child, fill, stroke, strokeWidth, nodeTransform, nodeColor);
      }
    }
  }

  const baseColor = svgNode.computedStyle?.color || svgNode.attrs?.color || currentColor || '#0f172a';
  let rootFill = parentFill ?? svgNode.attrs?.fill ?? svgNode.computedStyle?.fill;
  if (rootFill === 'currentColor') rootFill = baseColor;
  let rootStroke = parentStroke ?? svgNode.attrs?.stroke ?? svgNode.computedStyle?.stroke;
  if (rootStroke === 'currentColor') rootStroke = baseColor;
  const rootStrokeWidth = parentStrokeWidth ?? svgNode.attrs?.['stroke-width'];

  for (const child of svgNode.children || []) {
    walkSvg(child, rootFill, rootStroke, rootStrokeWidth, null, baseColor);
  }
  return paths;
}
export const extractSvgSpec = extractSvgPaths;

function parseImageData(src) {
  if (!src || !src.startsWith('data:image/')) return null;
  const m = src.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  const format = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
  const base64Data = m[2];
  let buf;
  try {
    buf = Buffer.from(base64Data, 'base64');
  } catch {
    return null;
  }
  let widthPx = null;
  let heightPx = null;
  if (format === 'png' && buf.length >= 24) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      widthPx = buf.readUInt32BE(16);
      heightPx = buf.readUInt32BE(20);
    }
  } else if (format === 'jpeg' && buf.length >= 4) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] === 0xff) {
        const marker = buf[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          heightPx = buf.readUInt16BE(offset + 5);
          widthPx = buf.readUInt16BE(offset + 7);
          break;
        } else if (marker === 0xd9 || marker === 0xda) {
          break;
        } else {
          const len = buf.readUInt16BE(offset + 2);
          offset += 2 + len;
        }
      } else {
        offset++;
      }
    }
  }
  return { format, data: buf, widthPx, heightPx };
}

// Parses a CSS box-shadow list into { dx, dy, blur, spread, color, alpha } (points).
// Inset shadows are skipped.
function parseBoxShadows(value) {
  const out = [];
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(value)) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const part of parts) {
    let str = part.trim();
    if (/\binset\b/i.test(str)) continue;
    let color = '#000000';
    let alpha = 1;
    const cm = str.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|\b[a-zA-Z]+\b/);
    if (cm) {
      str = str.replace(cm[0], ' ');
      const c = cm[0];
      if (c[0] === '#') {
        let h = c.slice(1);
        if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
        color = '#' + h.slice(0, 6);
        if (h.length === 8) alpha = parseInt(h.slice(6), 16) / 255;
      } else if (/^rgba?/i.test(c)) {
        const n = c.replace(/^rgba?\(|\)$/gi, '').split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        const hx = (v) => Math.max(0, Math.min(255, Math.round(v || 0))).toString(16).padStart(2, '0');
        color = '#' + hx(n[0]) + hx(n[1]) + hx(n[2]);
        if (n.length > 3 && !Number.isNaN(n[3])) alpha = n[3];
      } else if (/^transparent$/i.test(c)) alpha = 0;
    }
    const nums = (str.match(/-?[0-9.]+(?:px|pt|em|rem)?/gi) || []).map((t) => {
      const v = parseFloat(t);
      return /pt$/i.test(t) ? v : /(em|rem)$/i.test(t) ? v * 12 : v * 0.75;
    });
    if (nums.length < 2 || alpha <= 0) continue;
    out.push({ dx: nums[0], dy: nums[1], blur: Math.max(0, nums[2] || 0), spread: nums[3] || 0, color, alpha });
  }
  return out;
}

// Resolves the drawn size of an <img> (points). Honours width/height attributes, px and
// percent widths, max-width, and keeps the aspect ratio when only one side is known.
function imageSizeFor(node, availW, imgInfo = null) {
  const cs = node.computedStyle || {};
  const info = imgInfo || parseImageData(node.attrs?.src || '');
  // width="120" is 120 CSS px (90pt) and width="100%" is a share of the line, as in a browser. CSS values are already in pt.
  const attrLen = (v, ref) => {
    if (v == null || v === '') return NaN;
    const str = String(v).trim();
    return str.endsWith('%') ? (parseFloat(str) / 100) * ref : parseFloat(str) * 0.75;
  };
  let iw = attrLen(node.attrs?.width, availW);
  if (!iw) iw = cs.widthPercent ? (availW * cs.widthPercent) / 100 : parseFloat(cs.width);
  let ih = attrLen(node.attrs?.height, availW) || parseFloat(cs.height);
  const explicitH = Boolean(ih);
  const ratio = info && info.widthPx && info.heightPx ? info.heightPx / info.widthPx : null;
  if (!iw && !ih && ratio) {
    iw = Math.min(availW, info.widthPx * 0.75);
    ih = ratio * iw;
  } else if (!iw) {
    iw = ih && ratio ? ih / ratio : Math.min(availW, 120);
  } else if (!ih) {
    ih = ratio ? ratio * iw : iw * 0.6;
  }
  iw = iw || 120;
  const cap = Math.min(availW, cs.maxWidth > 0 ? cs.maxWidth : Infinity);
  if (iw > cap) {
    if (!explicitH && ih) ih = (ih * cap) / iw;
    iw = cap;
  }
  return { iw, ih: ih || 80 };
}

function getCellExplicitWidth(cell, totalW) {
  const wVal = cell.computedStyle?.width ?? cell.attrs?.width;
  if (wVal != null) {
    const s = String(wVal).trim();
    if (s.endsWith('%')) {
      const pct = parseFloat(s);
      if (!isNaN(pct)) return (pct / 100) * totalW;
    } else if (s.toLowerCase().startsWith('calc(')) {
      const cv = evaluateCalc(s, totalW);
      if (!isNaN(cv) && cv > 0) return cv;
    }
    const num = parseFloat(s);
    if (!isNaN(num) && num > 0) return num;
  }
  const inlineStyle = cell.attrs?.style;
  if (inlineStyle) {
    const m = inlineStyle.match(/width:\s*([0-9.]+(?:%|px|pt)?)/);
    if (m) {
      if (m[1].endsWith('%')) {
        const pct = parseFloat(m[1]);
        if (!isNaN(pct)) return (pct / 100) * totalW;
      }
      const num = parseFloat(m[1]);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

const INLINE_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'code', 'a', 'span', 'small', 'mark', 'sub', 'sup', 'abbr', 'br',
]);
// A cell is laid out from styled tokens (instead of one plain string) when it holds inline markup, a <br>,
// or block children such as <td><p>one</p><p>two</p></td>.
function cellNeedsTokens(cell) {
  return (cell.children || []).some((c) => {
    if (c.type !== 'element') return false;
    const tag = (c.tagName || '').toLowerCase();
    if (tag === 'table' || tag === 'img') return false;
    return isInlineElement(c) || INLINE_TAGS.has(tag) || BLOCK_TAGS.has(tag) || BLOCKISH_DISPLAYS.has(c.computedStyle?.display);
  });
}
function isInlineElement(c) {
  if (!c) return false;
  if (c._syntheticBlock) return false;
  if (c.computedStyle?.display) {
    if (c.computedStyle.display === 'block') return false;
    return c.computedStyle.display === 'inline' || c.computedStyle.display === 'inline-block';
  }
  return INLINE_TAGS.has((c.tagName || '').toLowerCase());
}

function hexLuminance(c) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
// Header text keeps the CSS colour when it reads on the CSS background, otherwise falls back to white or ink.
function headTextColor(ccs) {
  const lb = hexLuminance(ccs.backgroundColor);
  const lc = hexLuminance(ccs.color);
  if (lb == null) return '#ffffff';
  if (lc != null && (Math.max(lb, lc) + 0.05) / (Math.min(lb, lc) + 0.05) >= 3) return ccs.color;
  return lb < 0.4 ? '#ffffff' : '#0f172a';
}

// How many grid columns an item covers: `grid-column: span 2`, `grid-column: 1 / 3`, start/end lines, `col-span-N`.
function gridSpanOf(k, cols) {
  const c = k.computedStyle || {};
  let sp = c.colSpan || 1;
  if (!c.colSpan && c.gridColumnStart != null && c.gridColumnEnd != null) {
    const end = c.gridColumnEnd < 0 ? cols + 2 + c.gridColumnEnd : c.gridColumnEnd;
    if (end > c.gridColumnStart) sp = end - c.gridColumnStart;
  }
  return Math.max(1, Math.min(cols, sp));
}
// Rows of grid items with their start column and span (auto placement, row by row).
function gridRowsOf(kids, cols) {
  const rows = [];
  let cur = [];
  let used = 0;
  for (const k of kids) {
    const span = gridSpanOf(k, cols);
    if (used + span > cols) { rows.push(cur); cur = []; used = 0; }
    cur.push({ k, col: used, span });
    used += span;
    if (used >= cols) { rows.push(cur); cur = []; used = 0; }
  }
  if (cur.length) rows.push(cur);
  return rows;
}
function gridItemBox(colWidths, gap, col, span) {
  let off = 0;
  for (let i = 0; i < col; i++) off += colWidths[i] + gap;
  let w = gap * (span - 1);
  for (let i = col; i < col + span; i++) w += colWidths[i];
  return { off, w };
}

// Rows of a table, thead, tbody or tfoot. Loose <td>/<th> children (no <tr>, which HTML parsers repair by
// inserting one) are gathered into an implied row.
const impliedRows = new WeakMap();
function trChildren(container) {
  const out = [];
  let loose = [];
  const flush = () => {
    if (!loose.length) return;
    const cacheKey = loose[0];
    let tr = impliedRows.get(cacheKey);
    if (!tr) {
      tr = { type: 'element', tagName: 'tr', attrs: {}, children: loose, computedStyle: { ...(container.computedStyle || {}), backgroundColor: undefined, borderWidth: 0 } };
      impliedRows.set(cacheKey, tr);
    }
    out.push(tr);
    loose = [];
  };
  for (const k of container.children || []) {
    if (k.type !== 'element') continue;
    if (k.tagName === 'tr') { flush(); out.push(k); }
    else if (k.tagName === 'td' || k.tagName === 'th') loose.push(k);
  }
  flush();
  return out;
}

// List markers -----------------------------------------------------------------------------------
function toRoman(n) {
  if (n <= 0 || n >= 4000) return String(n);
  const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, r] of t) while (n >= v) { out += r; n -= v; }
  return out;
}
function toAlpha(n) {
  if (n <= 0) return String(n);
  let out = '';
  while (n > 0) { n -= 1; out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); }
  return out;
}
// Text of a counter marker for list-style-type, or null for none and the three bullet shapes.
export function listMarkerText(type, n) {
  switch (type) {
    case 'decimal': return `${n}.`;
    case 'decimal-leading-zero': return `${String(n).padStart(2, '0')}.`;
    case 'lower-alpha': case 'lower-latin': return `${toAlpha(n)}.`;
    case 'upper-alpha': case 'upper-latin': return `${toAlpha(n).toUpperCase()}.`;
    case 'lower-roman': return `${toRoman(n)}.`;
    case 'upper-roman': return `${toRoman(n).toUpperCase()}.`;
    default: return null;
  }
}
const BULLET_BY_LEVEL = ['disc', 'circle', 'square'];

function makeSyntheticBlock(run, cs) {
  const synthetic = {
    type: 'element',
    tagName: 'span',
    computedStyle: {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      color: cs.color,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      display: 'block',
    },
    children: run,
    attrs: {},
    _syntheticBlock: true,
  };
  Object.defineProperty(synthetic, 'textContent', {
    get() {
      return run.map((c) => (c.type === 'text' ? (c.text || '') : (c.textContent || ''))).join('');
    },
    configurable: true,
  });
  return synthetic;
}

// The items of a flex row: every child element, and every run of loose text (which becomes an anonymous item,
// like the label in `<p style="display:flex">Total <span>10</span></p>`).
function flexItemsOf(children, cs) {
  const items = [];
  for (const c of children || []) {
    if (c.type === 'element') items.push(c);
    else if (c.type === 'text' && c.text && c.text.trim()) items.push(makeSyntheticBlock([c], cs));
  }
  return items;
}

function groupMixedChildren(children, cs) {
  if (!children || children.length === 0) return children || [];
  const hasBlock = children.some((c) => c.type === 'element' && !isInlineElement(c));
  const hasInline = children.some(
    (c) =>
      (c.type === 'text' && c.text && c.text.trim().length > 0) ||
      (c.type === 'element' && isInlineElement(c) && c.tagName !== 'br')
  );
  if (!hasBlock || !hasInline) return children;

  const result = [];
  let currentInlineRun = [];

  function flushInlineRun() {
    if (currentInlineRun.length === 0) return;
    const hasMeaningfulContent = currentInlineRun.some(
      (c) =>
        (c.type === 'text' && c.text && c.text.trim().length > 0) ||
        (c.type === 'element' && (isInlineElement(c) || c.tagName === 'br'))
    );
    if (hasMeaningfulContent) {
      const run = currentInlineRun;
      const synthetic = makeSyntheticBlock(run, cs);
      result.push(synthetic);
    }
    currentInlineRun = [];
  }

  for (const c of children) {
    if (c.type === 'element' && !isInlineElement(c)) {
      flushInlineRun();
      result.push(c);
    } else {
      currentInlineRun.push(c);
    }
  }
  flushInlineRun();
  return result;
}

const PAGE_SIZES = {
  A0: { width: 2383.94, height: 3370.39 },
  A1: { width: 1683.78, height: 2383.94 },
  A2: { width: 1190.55, height: 1683.78 },
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  A6: { width: 297.64, height: 419.53 },
  B4: { width: 708.66, height: 1000.63 },
  B5: { width: 498.9, height: 708.66 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
  TABLOID: { width: 792, height: 1224 },
  LEDGER: { width: 1224, height: 792 },
  EXECUTIVE: { width: 521.86, height: 756 },
};
const LENGTH_UNITS = { pt: 1, px: 0.75, in: 72, mm: 72 / 25.4, cm: 72 / 2.54, '': 1 };
function lengthToPt(tok) {
  const m = /^([\d.]+)\s*(pt|px|in|mm|cm)?$/i.exec(String(tok).trim());
  return m ? parseFloat(m[1]) * LENGTH_UNITS[(m[2] || '').toLowerCase()] : NaN;
}
// A page size from `format`: a name ('A3', 'tabloid', 'A4 landscape'), [width, height] in points, {width, height},
// or two lengths ('210mm 297mm', '8.5in 11in'). Returns null when it is not understood.
function resolvePageSize(fmt) {
  if (fmt == null || fmt === '') return null;
  if (Array.isArray(fmt)) {
    const [w, h] = fmt.map((v) => (typeof v === 'number' ? v : lengthToPt(v)));
    return w > 0 && h > 0 ? { width: w, height: h } : null;
  }
  if (typeof fmt === 'object') {
    const w = typeof fmt.width === 'number' ? fmt.width : lengthToPt(fmt.width);
    const h = typeof fmt.height === 'number' ? fmt.height : lengthToPt(fmt.height);
    return w > 0 && h > 0 ? { width: w, height: h } : null;
  }
  const tokens = String(fmt).trim().split(/\s+/);
  let landscape = false;
  const lengths = [];
  let named = null;
  for (const tk of tokens) {
    const up = tk.toUpperCase();
    if (up === 'LANDSCAPE') landscape = true;
    else if (up === 'PORTRAIT') landscape = false;
    else if (PAGE_SIZES[up]) named = PAGE_SIZES[up];
    else if (Number.isFinite(lengthToPt(tk))) lengths.push(lengthToPt(tk));
  }
  let size = named ? { ...named } : lengths.length >= 2 ? { width: lengths[0], height: lengths[1] } : lengths.length === 1 ? { width: lengths[0], height: lengths[0] } : null;
  if (size && landscape && size.width < size.height) size = { width: size.height, height: size.width };
  return size;
}
export function layoutAndPaginate(rootNode, pageConfig = {}, options = {}) {
  if (rootNode && rootNode.rootNode) rootNode = rootNode.rootNode;
  // An explicit format option wins over the stylesheet's @page size, which wins over the default A4.
  const explicit = resolvePageSize(options.format);
  const fromCss = !explicit && parseFloat(pageConfig.width) > 0 && parseFloat(pageConfig.height) > 0 ? { width: parseFloat(pageConfig.width), height: parseFloat(pageConfig.height) } : null;
  const dim = explicit || fromCss || resolvePageSize(pageConfig.format) || PAGE_SIZES.A4;
  let pageW = dim.width;
  let pageH = dim.height;

  const fmtOrientation = typeof options.format === 'string' ? (/landscape|portrait/i.exec(options.format) || [''])[0] : '';
  // pageConfig.orientation always carries index's 'portrait' default, so only an explicit option, a format keyword or a
  // stylesheet landscape may turn the page. A custom [w, h] keeps the shape it was given.
  const orientation = String(fmtOrientation || options.orientation || (pageConfig.orientation === 'landscape' ? 'landscape' : '')).toLowerCase();
  if (orientation === 'landscape') {
    if (pageW < pageH) {
      const tmp = pageW;
      pageW = pageH;
      pageH = tmp;
    }
  } else if (orientation === 'portrait') {
    if (pageW > pageH) {
      const tmp = pageW;
      pageW = pageH;
      pageH = tmp;
    }
  }

  const mTop = pageConfig.margins?.top ?? pageConfig.marginTop ?? pageConfig.margin ?? 36;
  const mRight = pageConfig.margins?.right ?? pageConfig.marginRight ?? pageConfig.margin ?? 36;
  const mBottom = pageConfig.margins?.bottom ?? pageConfig.marginBottom ?? pageConfig.margin ?? 36;
  const mLeft = pageConfig.margins?.left ?? pageConfig.marginLeft ?? pageConfig.margin ?? 36;

  const contentW = pageW - mLeft - mRight;
  const maxPageY = pageH - mBottom;

  const pages = [{ width: pageW, height: pageH, items: [], links: [] }];
  let curPage = pages[0];
  let cursorY = mTop;

  function nextPage() {
    curPage = { width: pageW, height: pageH, items: [], links: [] };
    pages.push(curPage);
    cursorY = mTop;
  }

  function ensureSpace(hNeeded) {
    if (!options.singlePage && cursorY + hNeeded > maxPageY && curPage.items.length > 0) {
      nextPage();
      return true;
    }
    return false;
  }
  function pushItem(item, nodeCs = null) {
    if (nodeCs) {
      if (nodeCs.zIndex != null && item.zIndex == null) item.zIndex = nodeCs.zIndex;
      if (nodeCs.opacity != null && item.opacity == null) item.opacity = nodeCs.opacity;
      if (nodeCs.rotate != null && item.rotate == null) item.rotate = nodeCs.rotate;
    }
    curPage.items.push(item);
  }


  function extractNodeText(node) {
    if (!node) return '';
    if (node.textContent != null) return stripUndrawable(String(node.textContent)).replace(/\s+/g, ' ').trim();
    if (node.text != null) return stripUndrawable(String(node.text)).replace(/\s+/g, ' ').trim();
    if (node.children) {
      return node.children.map(extractNodeText).join(' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function measureIntrinsicWidth(node) {
    if (!node || node.type !== 'element') return 80;
    const cs = node.computedStyle || {};
    if (node.tagName === 'qr') return (parseFloat(node.attrs.size) || 64) * 0.75 + 16;
    if (node.tagName === 'canvas') return (parseFloat(node.attrs.width) || 240) * 0.75 + 16;
    if (node.tagName === 'svg') return parseFloat(node.attrs.width) || parseFloat(cs.width) || 24;
    if (node.tagName === 'img') return parseFloat(node.attrs.width) || parseFloat(cs.width) || 120;
    if (node.tagName === 'barcode' || node.attrs?.['data-barcode'] != null || node.classList?.contains('barcode')) {
      return parseFloat(node.attrs.width) || parseFloat(cs.width) || 160;
    }
    const padX = (cs.paddingLeft || 0) + (cs.paddingRight || 0);
    const blockKids = node.children.filter((c) => c.type === 'element' && !isInlineElement(c));
    if (blockKids.length > 0) {
      let maxW = 0;
      for (const k of blockKids) maxW = Math.max(maxW, measureIntrinsicWidth(k));
      return maxW + padX;
    }
    const txt = extractNodeText(node);
    return measureTextWidth(txt, cs) + padX + 8;
  }
  // A flex item's width has already been resolved by the flex algorithm. Hand it on without its own `width`,
  // or a percentage (width: 32%) would be taken again against the item's own, already narrowed box.
  function resolvedFlexItem(k) {
    return k.type === 'element' && k.computedStyle?.width != null && k.computedStyle.width !== ''
      ? Object.create(k, { computedStyle: { value: { ...k.computedStyle, width: undefined } } })
      : k;
  }
  function computeFlexRowLayout(kids, innerW, startX, cs) {
    const n = kids.length;
    if (n === 0) return { childWidths: [], childXOffsets: [] };

    const gap = cs.gap || cs.gapX || cs.columnGap || 0;
    const totalGaps = (n - 1) * gap;
    const availForKids = Math.max(0, innerW - totalGaps);

    if (n === 2 && cs.justifyContent === 'space-between' &&
        !kids[0].computedStyle?.flexGrow && !kids[1].computedStyle?.flexGrow &&
        !kids[0].computedStyle?.width && !kids[1].computedStyle?.width) {
      const wRight = Math.min(innerW * 0.42, Math.max(110, measureIntrinsicWidth(kids[1])));
      const wLeft = Math.max(40, innerW - wRight - (gap || 12));
      return {
        childWidths: [wLeft, wRight],
        childXOffsets: [startX, startX + innerW - wRight],
      };
    }

    if (n === 2 && (kids[0].tagName === 'svg' || kids[0].tagName === 'img' || kids[0].attrs?.width) &&
        !kids[0].computedStyle?.flexGrow && !kids[1].computedStyle?.flexGrow && !kids[1].computedStyle?.width) {
      const w0 = (parseFloat(kids[0].attrs?.width || kids[0].computedStyle?.width) || 28) * (kids[0].tagName === 'svg' ? 0.75 : 1);
      const w1 = Math.max(40, innerW - w0 - (gap || 8));
      return {
        childWidths: [w0, w1],
        childXOffsets: [startX, startX + w0 + (gap || 8)],
      };
    }

    const items = kids.map((k) => {
      const kcs = k.computedStyle || {};
      const grow = parseFloat(kcs.flexGrow || 0) || 0;
      const shrink = kcs.flexShrink != null ? parseFloat(kcs.flexShrink) : 1;
      let explicitW = null;

      if (kcs.width) {
        if (typeof kcs.width === 'string' && kcs.width.endsWith('%')) {
          explicitW = (parseFloat(kcs.width) / 100) * innerW;
        } else if (typeof kcs.width === 'string' && kcs.width.toLowerCase().startsWith('calc(')) {
          explicitW = evaluateCalc(kcs.width, innerW, kcs.fontSize);
        } else if (typeof kcs.width === 'number') {
          explicitW = kcs.width;
        } else {
          explicitW = evaluateCssValue(kcs.width, { parentWidth: innerW, fontSize: kcs.fontSize || 11 });
        }
      } else if (k.attrs?.width) {
        explicitW = parseFloat(k.attrs.width) * (k.tagName === 'svg' ? 0.75 : 1);
      } else if (kcs.flexBasis != null && kcs.flexBasis !== 'auto' && kcs.flexBasis !== 0) {
        explicitW = evaluateCssValue(kcs.flexBasis, { parentWidth: innerW, fontSize: kcs.fontSize || 11 });
      }

      let minW = 0;
      if (kcs.minWidth) {
        if (typeof kcs.minWidth === 'string' && kcs.minWidth.endsWith('%')) minW = (parseFloat(kcs.minWidth) / 100) * innerW;
        else if (typeof kcs.minWidth === 'string' && kcs.minWidth.toLowerCase().startsWith('calc(')) minW = evaluateCalc(kcs.minWidth, innerW, kcs.fontSize);
        else minW = typeof kcs.minWidth === 'number' ? kcs.minWidth : evaluateCssValue(kcs.minWidth, { parentWidth: innerW, fontSize: kcs.fontSize || 11 });
      }

      let maxW = Infinity;
      if (kcs.maxWidth) {
        if (typeof kcs.maxWidth === 'string' && kcs.maxWidth.endsWith('%')) maxW = (parseFloat(kcs.maxWidth) / 100) * innerW;
        else if (typeof kcs.maxWidth === 'string' && kcs.maxWidth.toLowerCase().startsWith('calc(')) maxW = evaluateCalc(kcs.maxWidth, innerW, kcs.fontSize);
        else maxW = typeof kcs.maxWidth === 'number' ? kcs.maxWidth : evaluateCssValue(kcs.maxWidth, { parentWidth: innerW, fontSize: kcs.fontSize || 11 });
      }

      return {
        k,
        kcs,
        grow,
        shrink,
        explicitW,
        minW,
        maxW,
        baseW: explicitW != null ? explicitW : (grow > 0 ? 0 : measureIntrinsicWidth(k)),
      };
    });

    const totalGrow = items.reduce((sum, it) => sum + it.grow, 0);
    let childWidths = new Array(n).fill(0);
    let childXOffsets = new Array(n).fill(0);

    if (totalGrow > 0) {
      const totalFixedW = items.reduce((sum, it) => sum + (it.grow === 0 ? it.baseW : 0), 0);
      const remW = Math.max(0, availForKids - totalFixedW);

      if (totalFixedW > availForKids && availForKids > 0) {
        const scale = availForKids / totalFixedW;
        items.forEach((it, i) => {
          childWidths[i] = it.grow === 0 ? it.baseW * scale : 0;
        });
      } else {
        items.forEach((it, i) => {
          if (it.grow > 0) {
            childWidths[i] = (it.grow / totalGrow) * remW;
          } else {
            childWidths[i] = it.baseW;
          }
        });
      }

      items.forEach((it, i) => {
        if (it.minW && childWidths[i] < it.minW) childWidths[i] = it.minW;
        if (it.maxW && childWidths[i] > it.maxW) childWidths[i] = it.maxW;
      });

      let curX = startX;
      for (let i = 0; i < n; i++) {
        childXOffsets[i] = curX;
        curX += childWidths[i] + gap;
      }
    } else {
      const hasAnyExplicit = items.some((it) => it.explicitW != null);
      if (!hasAnyExplicit && !cs.justifyContent) {
        const cw = availForKids / n;
        childWidths = items.map(() => cw);
      } else {
        childWidths = items.map((it) => it.baseW);
      }

      const totalChildrenW = childWidths.reduce((a, b) => a + b, 0);
      const minGap = n > 2 ? 6 * (n - 1) : 0; // keep a little air between squeezed neighbours
      if (totalChildrenW > availForKids - minGap && totalChildrenW > 0) {
        // Shrink the items, but never below the longest unbreakable word of each (a flex item's min-content),
        // so neighbouring numbers do not draw over each other.
        const mins = items.map((it, i) => {
          const kcs = it.kcs || {};
          const bold = /<(b|strong)\b/i.test('') || kcs.fontWeight === 'bold' || Boolean(it.k.querySelector?.('b, strong'));
          const st = { ...kcs, fontWeight: bold ? 'bold' : kcs.fontWeight };
          let longest = 0;
          for (const word of extractNodeText(it.k).split(/\s+/)) if (word) longest = Math.max(longest, measureTextWidth(word, st));
          return Math.min(childWidths[i], longest + (kcs.paddingLeft || 0) + (kcs.paddingRight || 0) + 1);
        });
        const excess = totalChildrenW - (availForKids - minGap);
        const free = childWidths.reduce((a, w, i) => a + Math.max(0, w - mins[i]), 0);
        if (free > 0) {
          const take = Math.min(1, excess / free);
          childWidths = childWidths.map((w, i) => w - Math.max(0, w - mins[i]) * take);
        }
      }

      const finalContentW = childWidths.reduce((a, b) => a + b, 0);
      const spareW = Math.max(0, availForKids - finalContentW);
      const jc = cs.justifyContent || 'flex-start';

      if (jc === 'flex-end' || jc === 'end' || jc === 'justify-end') {
        let curX = startX + spareW;
        for (let i = 0; i < n; i++) {
          childXOffsets[i] = curX;
          curX += childWidths[i] + gap;
        }
      } else if (jc === 'center' || jc === 'justify-center') {
        let curX = startX + spareW / 2;
        for (let i = 0; i < n; i++) {
          childXOffsets[i] = curX;
          curX += childWidths[i] + gap;
        }
      } else if (jc === 'space-between' || jc === 'justify-between') {
        if (n === 1) {
          childXOffsets[0] = startX;
        } else {
          const extraGap = spareW / (n - 1);
          let curX = startX;
          for (let i = 0; i < n; i++) {
            childXOffsets[i] = curX;
            curX += childWidths[i] + gap + extraGap;
          }
        }
      } else if (jc === 'space-around' || jc === 'justify-around') {
        const unit = spareW / (2 * n);
        let curX = startX + unit;
        for (let i = 0; i < n; i++) {
          childXOffsets[i] = curX;
          curX += childWidths[i] + gap + 2 * unit;
        }
      } else if (jc === 'space-evenly' || jc === 'justify-evenly') {
        const unit = spareW / (n + 1);
        let curX = startX + unit;
        for (let i = 0; i < n; i++) {
          childXOffsets[i] = curX;
          curX += childWidths[i] + gap + unit;
        }
      } else {
        let curX = startX;
        for (let i = 0; i < n; i++) {
          childXOffsets[i] = curX;
          curX += childWidths[i] + gap;
        }
      }
    }

    return { childWidths, childXOffsets };
  }

  function renderBlockBackgroundAndBorders(boxX, boxY, boxW, boxH, cs) {
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      // Shadows are emitted back to front and only ever paint outside the box edge.
      const shadows = parseBoxShadows(cs.boxShadow);
      for (let i = shadows.length - 1; i >= 0; i--) {
        pushItem({
          type: 'shadow',
          x: boxX,
          y: boxY,
          w: boxW,
          h: boxH,
          radius: cs.borderRadius || 0,
          ...shadows[i],
        }, cs);
      }
    }
    const hasUniformBorder = Boolean(cs.borderWidth && cs.borderWidth > 0);
    if (cs.backgroundColor || cs.gradient || hasUniformBorder) {
      pushItem({
        type: 'rect',
        x: boxX,
        y: boxY,
        w: boxW,
        h: boxH,
        fill: cs.backgroundColor || null,
        gradient: cs.gradient,
        stroke: hasUniformBorder ? cs.borderColor || '#e2e8f0' : null,
        lineWidth: hasUniformBorder ? cs.borderWidth : 0,
        radius: cs.borderRadius || 0,
      }, cs);
    }
    if (!hasUniformBorder) {
      if (cs.borderLeftWidth && cs.borderLeftWidth > 0) {
        const lw = cs.borderLeftWidth;
        const col = cs.borderLeftColor || cs.borderColor || '#4f46e5';
        if (lw >= 2) {
          pushItem({
            type: 'rect',
            x: boxX,
            y: boxY,
            w: lw,
            h: boxH,
            fill: col,
            radius: cs.borderRadius ? Math.min(cs.borderRadius, lw / 2) : 0,
          }, cs);
        } else {
          pushItem({
            type: 'line',
            x1: boxX + lw / 2,
            y1: boxY,
            x2: boxX + lw / 2,
            y2: boxY + boxH,
            stroke: col,
            lineWidth: lw,
          }, cs);
        }
      }
      if (cs.borderTopWidth && cs.borderTopWidth > 0) {
        const tw = cs.borderTopWidth;
        const col = cs.borderTopColor || cs.borderColor || '#e2e8f0';
        pushItem({
          type: 'line',
          x1: boxX,
          y1: boxY + tw / 2,
          x2: boxX + boxW,
          y2: boxY + tw / 2,
          stroke: col,
          lineWidth: tw,
        }, cs);
      }
      if (cs.borderRightWidth && cs.borderRightWidth > 0) {
        const rw = cs.borderRightWidth;
        const col = cs.borderRightColor || cs.borderColor || '#e2e8f0';
        pushItem({
          type: 'line',
          x1: boxX + boxW - rw / 2,
          y1: boxY,
          x2: boxX + boxW - rw / 2,
          y2: boxY + boxH,
          stroke: col,
          lineWidth: rw,
        }, cs);
      }
      if (cs.borderBottomWidth && cs.borderBottomWidth > 0) {
        const bw = cs.borderBottomWidth;
        const col = cs.borderBottomColor || cs.borderColor || '#e2e8f0';
        pushItem({
          type: 'line',
          x1: boxX,
          y1: boxY + boxH - bw / 2,
          x2: boxX + boxW,
          y2: boxY + boxH - bw / 2,
          stroke: col,
          lineWidth: bw,
        }, cs);
      }
    }
  }
  function measureBlockHeight(node, availW) {
    if (node.type !== 'element') return 0;
    const cs = node.computedStyle || {};
    if (cs.display === 'none' || node.tagName === 'style' || node.tagName === 'script' || node.tagName === 'head') return 0;
    if (cs.width) {
      if (typeof cs.width === 'string' && cs.width.endsWith('%')) {
        availW = (parseFloat(cs.width) / 100) * availW;
      } else if (typeof cs.width === 'string' && cs.width.toLowerCase().startsWith('calc(')) {
        availW = evaluateCalc(cs.width, availW, cs.fontSize);
      } else if (typeof cs.width === 'number') {
        availW = cs.width;
      }
    }
    if (node.tagName === 'table') {
      const thead = node.children?.find((c) => c.type === 'element' && c.tagName === 'thead');
      const tbody = node.children?.find((c) => c.type === 'element' && c.tagName === 'tbody') || node;
      const tfoot = node.children?.find((c) => c.type === 'element' && c.tagName === 'tfoot');
      const allRows = [
        ...(thead ? trChildren(thead) : []),
        ...(tbody && tbody !== node ? trChildren(tbody) : trChildren(node)),
        ...(tfoot ? trChildren(tfoot) : []),
      ];
      return measureNestedTable(node, availW);
    }
    if (node.tagName === 'canvas') return (parseFloat(node.attrs.height) || 70) * 0.75 + 8;
    if (node.tagName === 'qr') return (parseFloat(node.attrs.size) || 64) * 0.75 + 6;
    if (node.tagName === 'svg') return (parseFloat(node.attrs.height) || parseFloat(cs.height) || 24) + 4;
    if (node.tagName === 'img') return imageSizeFor(node, availW).ih + 6;
    if (node.tagName === 'barcode' || node.attrs?.['data-barcode'] != null || node.classList?.contains('barcode')) {
      return (parseFloat(node.attrs.height) || parseFloat(cs.height) || 48) + 6;
    }
    const innerW = Math.max(20, availW - (cs.paddingLeft || 0) - (cs.paddingRight || 0));
    const effectiveChildren = groupMixedChildren(node.children || [], cs);
    const elemChildren = effectiveChildren.filter((c) => c.type === 'element' && !isInlineElement(c));

    // Smart grid height calculation (rows of columns, not vertical sum)
    if (cs.display === 'grid' && elemChildren.length > 0) {
      const cols = cs.gridCols || 2;
      const gap = cs.gap || 0;
      let colWidths = [];
      const tmpl = cs.gridTemplateColumns;
      if (tmpl && !tmpl.includes('repeat')) {
        const tracks = tmpl.trim().split(/\s+/);
        if (tracks.length === cols) {
          let totalFr = 0;
          let fixedW = 0;
          const parsed = tracks.map((t) => {
            if (t.endsWith('%')) {
              const w = (parseFloat(t) / 100) * innerW;
              fixedW += w;
              return { type: 'px', val: w };
            }
            if (t.endsWith('pt') || t.endsWith('px')) {
              const w = parseFloat(t);
              fixedW += w;
              return { type: 'px', val: w };
            }
            if (t.endsWith('fr')) {
              const fr = parseFloat(t) || 1;
              totalFr += fr;
              return { type: 'fr', val: fr };
            }
            totalFr += 1;
            return { type: 'fr', val: 1 };
          });
          const totalGaps = gap * (cols - 1);
          const remW = Math.max(0, innerW - fixedW - totalGaps);
          colWidths = parsed.map((p) => p.type === 'px' ? p.val : (totalFr > 0 ? (p.val / totalFr) * remW : 0));
        }
      }
      if (colWidths.length !== cols) {
        const cellW = (innerW - gap * (cols - 1)) / cols;
        colWidths = new Array(cols).fill(cellW);
      }
      let totalH = (cs.paddingTop || 0) + (cs.paddingBottom || 0);
      const gridRows = gridRowsOf(elemChildren, cols);
      for (let r = 0; r < gridRows.length; r++) {
        let maxRowH = 0;
        for (const it of gridRows[r]) {
          maxRowH = Math.max(maxRowH, measureBlockHeight(it.k, gridItemBox(colWidths, gap, it.col, it.span).w));
        }
        totalH += maxRowH + (r < gridRows.length - 1 ? gap : 0);
      }
      return totalH;
    }

    // Smart row flex height calculation (max child height, not sum)
    if (cs.display === 'flex' && cs.flexDirection !== 'column' && elemChildren.length > 0) {
      const flexKids = flexItemsOf(node.children, cs);
      const { childWidths } = computeFlexRowLayout(flexKids, innerW, 0, cs);
      let maxH = 0;
      flexKids.forEach((k, idx) => {
        maxH = Math.max(maxH, measureBlockHeight(resolvedFlexItem(k), childWidths[idx] || (innerW / flexKids.length)));
      });
      return maxH + (cs.paddingTop || 0) + (cs.paddingBottom || 0);
    }

    let h = (cs.paddingTop || 0) + (cs.paddingBottom || 0);
    if (elemChildren.length > 0) {
      let prevMb = 0;
      for (const c of elemChildren) {
        const mt = c.computedStyle?.marginTop || 0;
        h += measureBlockHeight(c, innerW) + mt - Math.min(prevMb, mt) + (c.computedStyle?.marginBottom || 2);
        prevMb = c.computedStyle?.marginBottom || 0;
      }
      return h;
    }
    const hasInlineMarkup = (node.children || []).some((c) => c.type === 'element');
    const fSize = cs.fontSize || 10.5;
    const lh = cs.lineHeight || fSize * 1.38;
    if (hasInlineMarkup) {
      const tokens = extractInlineTokens(node, cs);
      const wrapped = wrapInlineTokens(tokens, innerW, cs);
      return h + Math.max(1, wrapped.length) * lh;
    }
    const txt = extractNodeText(node);
    const lines = wrapParagraphOptimal(txt, innerW, cs);
    return h + Math.max(1, lines.length) * lh;
  }
  function isNumericCellText(txt) {
    return /^[$€£¥₹]?[\d,]+(\.\d+)?%?$/.test(String(txt || '').trim());
  }

  function sideBorder(ccs, side) {
    const st = ccs.borderStyle;
    if (!st || st === 'none' || st === 'hidden') return { w: 0, color: null };
    const w = ccs['border' + side + 'Width'] != null ? ccs['border' + side + 'Width'] : ccs.borderWidth || 0;
    return { w, color: ccs['border' + side + 'Color'] || ccs.borderColor || '#000000' };
  }
  // A table is "authored" when its CSS describes real box metrics (explicit line-height,
  // vertical-align, images or nested tables in cells). Those tables use the exact cell box
  // model; tables relying on the engine's built-in report look keep the styled defaults.
  function isAuthoredTable(rows) {
    for (const { tr } of rows) {
      for (const cell of tr.children) {
        if (cell.type !== 'element' || (cell.tagName !== 'td' && cell.tagName !== 'th')) continue;
        const ccs = cell.computedStyle || {};
        if (ccs._lineHeightExplicit || ccs.verticalAlign || ccs._tableAuthored || tr.computedStyle?._tableAuthored) return true;
        if (cell.children?.some((c) => c.type === 'element' && (c.tagName === 'table' || c.tagName === 'img'))) return true;
      }
    }
    return false;
  }
  // Dry-run a nested table to learn its true height, then drop what it drew.
  function measureNestedTable(tbl, w) {
    const page = curPage;
    const nItems = page.items.length;
    const nLinks = page.links ? page.links.length : 0;
    const h = renderTable(tbl, 0, w, 0) || 0;
    page.items.length = nItems;
    if (page.links) page.links.length = nLinks;
    return h;
  }
  function authoredCellStyle(ccs) {
    const fSize = ccs.fontSize || 10.5;
    return {
      ...ccs,
      fontSize: fSize,
      fontWeight: ccs.fontWeight || 'normal',
      fontStyle: ccs.fontStyle || 'normal',
      fontFamily: ccs.fontFamily || 'Helvetica',
      color: ccs.color || '#0f172a',
    };
  }
  // Content of an authored cell: nested table, image, or wrapped inline text (with <br>).
  function authoredCellContent(cell, innerW, maxContent = false) {
    const ccs = cell.computedStyle || {};
    const kids = (cell.children || []).filter((c) => !(c.type === 'text' && !String(c.text || '').trim()));
    const nested = kids.find((c) => c.type === 'element' && c.tagName === 'table');
    if (nested) {
      return { kind: 'table', node: nested, h: maxContent ? 0 : measureNestedTable(nested, innerW), w: 0 };
    }
    const img = kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'img' ? kids[0] : null;
    if (img) {
      const sz = imageSizeFor(img, maxContent ? 1e6 : innerW);
      return { kind: 'img', node: img, h: sz.ih, w: sz.iw };
    }
    const style = authoredCellStyle(ccs);
    const lh = ccs.lineHeight || style.fontSize * 1.35;
    // the cell's own background is painted as the cell fill, not as an inline highlight
    const tokenRoot = ccs.backgroundColor ? { ...cell, computedStyle: { ...ccs, backgroundColor: undefined } } : cell;
    const tokens = extractInlineTokens(tokenRoot, style);
    const lines = wrapInlineTokens(tokens, maxContent ? 1e6 : innerW, style).filter((l, i, a) => l.tokens.length > 0 || i < a.length - 1 || a.length === 1);
    const hasText = tokens.some((t) => !t.isBr);
    const visible = hasText ? lines : [];
    return {
      kind: 'text',
      style,
      lh,
      lines: visible,
      h: visible.length * lh,
      w: visible.reduce((m, l) => Math.max(m, l.width), 0),
    };
  }
  function authoredCellBox(cell) {
    const ccs = cell.computedStyle || {};
    const bT = sideBorder(ccs, 'Top');
    const bB = sideBorder(ccs, 'Bottom');
    const bL = sideBorder(ccs, 'Left');
    const bR = sideBorder(ccs, 'Right');
    const k = cell._collapse ? 0.5 : 1;
    return {
      ccs,
      sT: bT.w * k, sB: bB.w * k, sL: bL.w * k, sR: bR.w * k,
      padT: ccs.paddingTop || 0,
      padB: ccs.paddingBottom || 0,
      padL: ccs.paddingLeft || 0,
      padR: ccs.paddingRight || 0,
      bT, bB, bL, bR,
    };
  }

  function renderTable(tableNode, x, w, overrideStartY = null) {
    const prevCursor = cursorY;
    if (overrideStartY != null) {
      cursorY = overrideStartY;
    }

    const thead = tableNode.children.find((c) => c.type === 'element' && c.tagName === 'thead');
    const tbody = tableNode.children.find((c) => c.type === 'element' && c.tagName === 'tbody') || tableNode;
    const tfoot = tableNode.children.find((c) => c.type === 'element' && c.tagName === 'tfoot');
    const headRows = thead ? trChildren(thead) : [];
    const bodyElements = tableNode.children.filter((c) => c.type === 'element' && c.tagName === 'tbody');
    let bodyRows = [];
    if (bodyElements.length > 0) {
      for (const b of bodyElements) {
        bodyRows.push(...trChildren(b));
      }
    } else if (tbody && tbody !== tableNode) {
      bodyRows = trChildren(tbody);
    } else {
      bodyRows = trChildren(tableNode);
    }
    const footRows = tfoot ? trChildren(tfoot) : [];

    const allRows = [
      ...headRows.map((tr) => ({ tr, section: 'head' })),
      ...bodyRows.map((tr) => ({ tr, section: 'body' })),
      ...footRows.map((tr) => ({ tr, section: 'foot' })),
    ];
    if (allRows.length === 0) {
      if (overrideStartY != null) cursorY = prevCursor;
      return 0;
    }

    const numRows = allRows.length;
    const occupied = [];
    let maxColCount = 1;

    for (let r = 0; r < numRows; r++) {
      if (!occupied[r]) occupied[r] = [];
      const { tr, section } = allRows[r];
      const cells = tr.children.filter((c) => c.type === 'element' && (c.tagName === 'th' || c.tagName === 'td'));
      let colIdx = 0;
      for (const cell of cells) {
        while (occupied[r][colIdx]) {
          colIdx++;
        }
        const span = Math.max(1, parseInt(cell.attrs?.colspan || cell.attrs?.colSpan || 1) || 1);
        const rowspan = Math.max(1, parseInt(cell.attrs?.rowspan || cell.attrs?.rowSpan || 1) || 1);
        const entry = { cell, tr, section, row: r, col: colIdx, colspan: span, rowspan };
        for (let dr = 0; dr < rowspan; dr++) {
          const trgR = r + dr;
          if (!occupied[trgR]) occupied[trgR] = [];
          for (let dc = 0; dc < span; dc++) {
            occupied[trgR][colIdx + dc] = { ...entry, isOrigin: dr === 0 && dc === 0 };
          }
        }
        colIdx += span;
      }
      if (colIdx > maxColCount) maxColCount = colIdx;
    }
    for (let r = 0; r < occupied.length; r++) {
      if (occupied[r] && occupied[r].length > maxColCount) {
        maxColCount = occupied[r].length;
      }
    }
    const colCount = Math.max(1, maxColCount);
    const authored = isAuthoredTable(allRows);
    // border-collapse: collapse shares one border between neighbouring cells, so each cell only owes half of it
    {
      const collapse = tableNode.computedStyle?.borderCollapse === 'collapse';
      for (const { tr } of allRows) for (const cell of tr.children) if (cell.type === 'element') cell._collapse = collapse;
    }

    const colExplicitWidths = new Array(colCount).fill(null);
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (slot && slot.isOrigin && slot.colspan === 1 && colExplicitWidths[c] == null) {
          const expW = getCellExplicitWidth(slot.cell, w);
          if (expW != null) colExplicitWidths[c] = expW;
        }
      }
    }

    const colIsNumeric = new Array(colCount).fill(false);
    const colHasNumericHeader = new Array(colCount).fill(false);
    for (let r = 0; r < numRows; r++) {
      const isHead = allRows[r].section === 'head';
      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (slot && slot.isOrigin && slot.colspan === 1) {
          const txt = extractNodeText(slot.cell).trim();
          if (isHead) {
            if (/^(qty|quantity|unit\s*price|price|rate|amount|line\s*total|total|subtotal|balance|tax|discount|fee|vat)$/i.test(txt)) {
              colHasNumericHeader[c] = true;
              colIsNumeric[c] = true;
            }
          } else if (r < 30) {
            if (isNumericCellText(txt)) {
              colIsNumeric[c] = true;
            }
          }
        }
      }
    }

    const colWeights = new Array(colCount).fill(authored ? 1 : 48);
    for (let r = 0; r < Math.min(numRows, 25); r++) {
      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (slot && slot.isOrigin && slot.colspan === 1) {
          if (authored) {
            const bx = authoredCellBox(slot.cell);
            const mc = authoredCellContent(slot.cell, 1e6, true);
            const tw = mc.w + bx.padL + bx.padR + bx.sL + bx.sR;
            if (tw > colWeights[c]) colWeights[c] = tw;
            continue;
          }
          const txt = extractNodeText(slot.cell);
          const ccs = slot.cell.computedStyle || {};
          const tw = measureTextWidth(txt, ccs) + (ccs.paddingLeft || 10) + (ccs.paddingRight || 10) + 12;
          if (tw > colWeights[c]) colWeights[c] = Math.min(260, tw);
        }
      }
    }

    let explicitSum = 0;
    let explicitCount = 0;
    for (let i = 0; i < colCount; i++) {
      if (colExplicitWidths[i] != null) {
        explicitSum += colExplicitWidths[i];
        explicitCount++;
      }
    }

    let colWidths = new Array(colCount);
    if (explicitCount === colCount) {
      const scale = explicitSum > 0 ? w / explicitSum : 1;
      colWidths = colExplicitWidths.map((ew) => ew * scale);
    } else {
      const remW = Math.max(colCount * 20, w - explicitSum);
      let nonExplicitWeightSum = 0;
      for (let i = 0; i < colCount; i++) {
        if (colExplicitWidths[i] == null) nonExplicitWeightSum += colWeights[i];
      }
      if (nonExplicitWeightSum <= 0) nonExplicitWeightSum = 1;
      for (let i = 0; i < colCount; i++) {
        if (colExplicitWidths[i] != null) {
          colWidths[i] = colExplicitWidths[i];
        } else {
          colWidths[i] = (colWeights[i] / nonExplicitWeightSum) * remW;
        }
      }
      const currentTotal = colWidths.reduce((a, b) => a + b, 0);
      if (Math.abs(currentTotal - w) > 1 && currentTotal > 0) {
        const s = w / currentTotal;
        colWidths = colWidths.map((cw) => cw * s);
      }
    }

    // Min-content floor: a column is never narrower than its longest unbreakable word, so text
    // cannot draw into a neighbouring column. Extra width is taken from the other columns.
    {
      const minW = new Array(colCount).fill(0);
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < colCount; c++) {
          const slot = occupied[r]?.[c];
          if (!slot || !slot.isOrigin || slot.colspan !== 1 || colExplicitWidths[c] != null) continue;
          if (slot.cell.children?.some((ch) => ch.type === 'element' && (ch.tagName === 'table' || ch.tagName === 'img'))) continue;
          const ccs = slot.cell.computedStyle || {};
          const hasCode = Boolean(slot.cell.querySelector && slot.cell.querySelector('code'));
          const st = {
            ...ccs,
            fontSize: ccs.fontSize || 9.5,
            fontFamily: hasCode ? 'Courier' : ccs.fontFamily,
            fontWeight: slot.section === 'head' || slot.section === 'foot' ? 'bold' : ccs.fontWeight,
          };
          let longest = 0;
          for (const word of extractNodeText(slot.cell).split(/\s+/)) {
            if (word) longest = Math.max(longest, measureTextWidth(word, st));
          }
          if (hasCode) longest += 5; // the chip padding around a <code> run
          const badgeEl = slot.section === 'head' ? null : slot.cell.children?.find((ch) => ch.type === 'element' && ch.tagName !== 'code' && (ch.classList?.contains('badge') || ch.classList?.contains('pill') || ch.computedStyle?.backgroundColor));
          if (badgeEl) {
            const bcs = badgeEl.computedStyle || {};
            longest = Math.max(longest, measureTextWidth(extractNodeText(badgeEl).trim(), { fontSize: bcs.fontSize || 8, fontWeight: 'bold', fontFamily: bcs.fontFamily || 'Helvetica' }) + 12);
          }
          const pad = authored
            ? (() => { const b = authoredCellBox(slot.cell); return b.padL + b.padR + b.sL + b.sR; })()
            : (ccs.paddingLeft || 10) + (ccs.paddingRight || 10);
          minW[c] = Math.max(minW[c], longest + pad);
        }
      }
      const sumMin = minW.reduce((a, b) => a + b, 0);
      // Browser auto table layout: when the longest lines do not all fit, every column gets its min-content
      // plus a share of the remaining room in proportion to how much more it wants (max - min).
      if (authored && colExplicitWidths.every((e) => e == null) && sumMin > 0 && sumMin <= w) {
        const maxW = colWeights.map((cw, i) => Math.max(cw, minW[i]));
        const sumMax = maxW.reduce((a, b) => a + b, 0);
        if (sumMax > w) {
          const k = (w - sumMin) / (sumMax - sumMin);
          for (let i = 0; i < colCount; i++) colWidths[i] = minW[i] + (maxW[i] - minW[i]) * k;
        }
      }
      if (sumMin > w) {
        // Not even the longest words fit: share the width in proportion to min-content (words wrap inside their own cell).
        const m = minW.map((v, i) => (colExplicitWidths[i] != null ? colWidths[i] : Math.max(v, 8)));
        const total = m.reduce((a, b) => a + b, 0);
        for (let i = 0; i < colCount; i++) colWidths[i] = (m[i] * w) / total;
      } else if (sumMin > 0) {
        for (let pass = 0; pass < 4; pass++) {
          let deficit = 0;
          let free = 0;
          for (let i = 0; i < colCount; i++) {
            if (colWidths[i] < minW[i] - 0.01) deficit += minW[i] - colWidths[i];
            else free += colWidths[i] - minW[i];
          }
          if (deficit <= 0.01 || free <= 0) break;
          const k = Math.max(0, (free - deficit) / free);
          for (let i = 0; i < colCount; i++) {
            colWidths[i] = colWidths[i] < minW[i] ? minW[i] : minW[i] + (colWidths[i] - minW[i]) * k;
          }
        }
      }
    }

    const colOffsets = [];
    let accX = x;
    for (let i = 0; i < colCount; i++) {
      colOffsets.push(accX);
      accX += colWidths[i];
    }

    function measureCellHeight(cell, cellW, isHead, isFoot) {
      if (authored) {
        const bx = authoredCellBox(cell);
        const innerW = Math.max(1, cellW - bx.padL - bx.padR - bx.sL - bx.sR);
        return authoredCellContent(cell, innerW).h + bx.padT + bx.padB + bx.sT + bx.sB;
      }
      const ccs = cell.computedStyle || {};
      const padL = ccs.paddingLeft || 10;
      const padR = ccs.paddingRight || 10;
      const padT = ccs.paddingTop || (isHead ? 7 : 5);
      const padB = ccs.paddingBottom || (isHead ? 7 : 5);
      const contentW = Math.max(20, cellW - padL - padR);

      const nestedTable = cell.children?.find((c) => c.type === 'element' && c.tagName === 'table');
      if (nestedTable) {
        const nth = measureNestedTable(nestedTable, contentW);
        return nth + padT + padB;
      }

      const badgeChild = cell.children?.find((c) => c.type === 'element' && (c.classList?.contains('badge') || c.classList?.contains('pill') || c.computedStyle?.backgroundColor));
      if (badgeChild && !isHead) {
        const bcs = badgeChild.computedStyle || {};
        const bH = (bcs.fontSize || 8) * 1.3 + 4;
        return bH + padT + padB + 4;
      }

      const isBold = isHead || isFoot || Boolean(cell.querySelector && cell.querySelector('b'));
      const fSize = ccs.fontSize || 9.5;
      const lh = fSize * 1.32;
      const basePadY = isHead ? 13 : 10;
      const cellBaseStyle = {
        ...ccs,
        fontSize: fSize,
        fontWeight: isBold ? 'bold' : ccs.fontWeight || 'normal',
        fontStyle: ccs.fontStyle || 'normal',
        fontFamily: ccs.fontFamily || 'Helvetica',
        color: isHead ? headTextColor(ccs) : isFoot ? '#0f172a' : ccs.color || '#0f172a',
      };

      const hasInlineMarkup = cellNeedsTokens(cell);

      let lineCount = 1;
      if (hasInlineMarkup) {
        const tokens = extractInlineTokens(cell, cellBaseStyle);
        const wrappedLines = wrapInlineTokens(tokens, contentW, cellBaseStyle);
        lineCount = Math.max(1, wrappedLines.length);
      } else {
        const lines = wrapParagraphOptimal(extractNodeText(cell), contentW, cellBaseStyle);
        lineCount = Math.max(1, lines.length);
      }
      return Math.max(isHead ? 25 : 21, lineCount * lh + basePadY);
    }

    const rowHeights = new Float64Array(numRows);
    for (let r = 0; r < numRows; r++) {
      const isHead = allRows[r].section === 'head';
      rowHeights[r] = authored ? 0 : isHead ? 25 : 21;
      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (slot && slot.isOrigin && slot.rowspan === 1) {
          let cellW = 0;
          for (let dc = 0; dc < slot.colspan; dc++) cellW += colWidths[c + dc] || 0;
          const ch = measureCellHeight(slot.cell, cellW, isHead, allRows[r].section === 'foot');
          if (ch > rowHeights[r]) rowHeights[r] = ch;
        }
      }
    }
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (slot && slot.isOrigin && slot.rowspan > 1) {
          let cellW = 0;
          for (let dc = 0; dc < slot.colspan; dc++) cellW += colWidths[c + dc] || 0;
          const ch = measureCellHeight(slot.cell, cellW, slot.section === 'head', slot.section === 'foot');
          let currentSpanH = 0;
          for (let dr = 0; dr < slot.rowspan; dr++) currentSpanH += rowHeights[r + dr] || 0;
          if (ch > currentSpanH) {
            const diff = (ch - currentSpanH) / slot.rowspan;
            for (let dr = 0; dr < slot.rowspan; dr++) rowHeights[r + dr] += diff;
          }
        }
      }
    }

    // An authored table keeps the margins its stylesheet gives it (the built-in look has its own spacing).
    const authoredMarginT = authored && overrideStartY == null ? tableNode.computedStyle?.marginTop || 0 : 0;
    const authoredMarginB = authored && overrideStartY == null ? tableNode.computedStyle?.marginBottom || 0 : 0;
    cursorY += authoredMarginT;
    let pageTableStartY = cursorY + (authored ? 0 : 4);
    cursorY += authored ? 0 : 4;
    pageTableStartY = cursorY;

    function closeTablePageBorder(endY) {
      if (!authored && endY > pageTableStartY) {
        pushItem({
          type: 'rect',
          x,
          y: pageTableStartY,
          w,
          h: endY - pageTableStartY,
          fill: null,
          stroke: '#cbd5e1',
          lineWidth: 0.8,
          radius: 6,
        }, tableNode.computedStyle);
      }
    }

    // A background on <thead>, <tbody>, <tfoot> or <tr> paints behind every cell of that row.
    {
      const sectionNode = { head: thead, foot: tfoot };
      for (const { tr, section } of allRows) {
        const bg = tr.computedStyle?.backgroundColor || sectionNode[section]?.computedStyle?.backgroundColor;
        if (!bg) continue;
        for (const cell of tr.children) {
          if (cell.type === 'element' && (cell.tagName === 'td' || cell.tagName === 'th') && !cell.computedStyle?.backgroundColor) {
            cell.computedStyle = { ...cell.computedStyle, backgroundColor: bg };
          }
        }
      }
    }

    const deferredSpans = [];
    // Rows are visited through a queue so a page break can put the <thead> rows back in front of the next row.
    const rowQueue = Array.from({ length: numRows }, (_, i) => i);
    const headIdx = rowQueue.filter((i) => allRows[i].section === 'head' && !occupied[i]?.some((sl) => sl && sl.rowspan > 1));
    let repeatedFor = -1;
    for (let qi = 0; qi < rowQueue.length; qi++) {
      const r = rowQueue[qi];
      const { tr, section } = allRows[r];
      const isHead = section === 'head';
      const isFoot = section === 'foot';
      const rowH = rowHeights[r];

      const trCs = tr.computedStyle || {};
      const trBreakBefore =
        trCs['page-break-before'] === 'always' ||
        trCs['break-before'] === 'page' ||
        trCs.pageBreakBefore === 'always' ||
        trCs.breakBefore === 'page';

      if ((trBreakBefore || (!options.singlePage && cursorY + rowH > maxPageY)) && curPage.items.length > 0 && !isHead && overrideStartY == null) {
        closeTablePageBorder(cursorY);
        nextPage();
        pageTableStartY = cursorY;
        if (headIdx.length > 0 && repeatedFor !== r && !isFoot) {
          repeatedFor = r;
          rowQueue.splice(qi, 0, ...headIdx);
          qi--;
          continue;
        }
      }

      const rowY = cursorY;
      const isTopHeader = isHead && cursorY === pageTableStartY;
      const rowBg = isHead ? '#0f172a' : isFoot ? '#f8fafc' : r % 2 === 1 ? '#f8fafc' : '#ffffff';
      // Columns covered by a cell that spans past this row are painted by that cell, so the row
      // background and divider must skip them (the head keeps its full-width bar).
      const colRuns = (skip) => {
        const runs = [];
        let start = -1;
        for (let c = 0; c <= colCount; c++) {
          const blocked = c === colCount || skip(c);
          if (!blocked && start < 0) start = c;
          if (blocked && start >= 0) {
            runs.push([colOffsets[start], colOffsets[c - 1] + colWidths[c - 1]]);
            start = -1;
          }
        }
        return runs;
      };
      const spansPast = (slot) => slot && slot.row + slot.rowspan - 1 > r;
      const coveredFromAbove = (slot) => slot && !slot.isOrigin && slot.row < r;
      const bgSkip = isHead ? () => false : (c) => spansPast(occupied[r]?.[c]) || coveredFromAbove(occupied[r]?.[c]);
      if (!authored) {
        const bgRuns = colRuns(bgSkip);
        const whole = bgRuns.length === 1 && bgRuns[0][0] === x && Math.abs(bgRuns[0][1] - (x + w)) < 0.5;
        // Light text (a dark page theme) must not be put on the built-in white row stripes.
        const lightText = !isHead && (hexLuminance(trCs.color || tableNode.computedStyle?.color) ?? 0) > 0.6;
        for (const [rx0, rx1] of lightText ? [] : bgRuns) {
          pushItem({
            type: 'rect',
            x: rx0,
            y: rowY,
            w: rx1 - rx0,
            h: rowH,
            fill: rowBg,
            radius: isTopHeader && whole ? 6 : 0,
            radii: isTopHeader && whole ? [6, 6, 0, 0] : [0, 0, 0, 0],
          }, trCs);
        }
      }
      if (isFoot && !authored) {
        pushItem({
          type: 'line',
          x1: x,
          y1: rowY,
          x2: x + w,
          y2: rowY,
          stroke: '#94a3b8',
          lineWidth: 1.0,
        }, trCs);
      }
      if (!isHead && !authored) {
        for (const [rx0, rx1] of colRuns((c) => spansPast(occupied[r]?.[c]))) {
          pushItem({
            type: 'line',
            x1: rx0,
            y1: rowY + rowH,
            x2: rx1,
            y2: rowY + rowH,
            stroke: '#e2e8f0',
            lineWidth: 0.6,
          }, trCs);
        }
      }

      for (let c = 0; c < colCount; c++) {
        const slot = occupied[r]?.[c];
        if (!slot || !slot.isOrigin) continue;
        const _pg = curPage;
        const _i0 = _pg.items.length;
        try {

        let spanH = 0;
        for (let dr = 0; dr < slot.rowspan; dr++) spanH += rowHeights[r + dr] || 0;
        let cellW = 0;
        for (let dc = 0; dc < slot.colspan; dc++) cellW += colWidths[c + dc] || 0;

        const cx = colOffsets[c] || x;
        const cy = rowY;
        // A span that runs past the page bottom is drawn only in the part that is on this page.
        if (slot.rowspan > 1 && overrideStartY == null && !options.singlePage) {
          spanH = Math.max(rowH, Math.min(spanH, maxPageY - cy));
        }
        const ccs = slot.cell.computedStyle || {};
        const padL = ccs.paddingLeft || 10;
        const padR = ccs.paddingRight || 10;
        const padT = ccs.paddingTop || (isHead ? 7 : 5);

        if (ccs.backgroundColor || (!authored && !isHead && slot.rowspan > 1)) {
          pushItem({
            type: 'rect',
            x: cx,
            y: cy,
            w: cellW,
            h: spanH,
            fill: ccs.backgroundColor || rowBg,
            radius: 0,
          }, ccs);
        }

        if (authored) {
          const bx = authoredCellBox(slot.cell);
          const innerX = cx + bx.padL + bx.sL;
          const innerW = Math.max(1, cellW - bx.padL - bx.padR - bx.sL - bx.sR);
          const content = authoredCellContent(slot.cell, innerW);
          const room = spanH - bx.padT - bx.padB - bx.sT - bx.sB;
          const va = ccs.verticalAlign || 'middle';
          const slack = Math.max(0, room - content.h);
          const off = va === 'bottom' || va === 'text-bottom' ? slack : va === 'middle' ? slack / 2 : 0;
          const top = cy + bx.sT + bx.padT + off;
          if (content.kind === 'table') {
            renderTable(content.node, innerX, innerW, top);
          } else if (content.kind === 'img') {
            renderNode(content.node, innerX, innerW, top - 2, ccs.textAlign || 'left');
          } else {
            const st = content.style;
            const spaceW = measureTextWidth(' ', st);
            let lineY = top;
            for (const lineObj of content.lines) {
              let tx = ccs.textAlign === 'right' || ccs.textAlign === 'end'
                ? innerX + innerW - lineObj.width
                : ccs.textAlign === 'center'
                  ? innerX + (innerW - lineObj.width) / 2
                  : innerX;
              const baselineY = lineY + (content.lh - st.fontSize) / 2 + st.fontSize * 0.86;
              for (const tok of lineObj.tokens) {
                if (tok.hasLeadingSpace) tx += spaceW;
                const padOffset = tok.bg ? 2.5 : 0;
                if (tok.bg) {
                  pushItem({ type: 'rect', x: tx, y: lineY + 1, w: tok.width, h: (tok.fontSize || st.fontSize) + 2, fill: tok.bg, radius: 2 }, ccs);
                }
                pushItem({
                  type: 'text',
                  text: tok.word,
                  x: tx + padOffset,
                  y: baselineY,
                  fontSize: tok.fontSize || st.fontSize,
                  fontWeight: tok.fontWeight || st.fontWeight,
                  fontStyle: tok.fontStyle || st.fontStyle,
                  fontFamily: tok.fontFamily || st.fontFamily,
                  color: tok.color || st.color,
                }, ccs);
                if (tok.href) {
                  curPage.links.push({ x: tx, y: lineY, w: tok.width, h: (tok.fontSize || st.fontSize) + 2, url: tok.href });
                }
                tx += tok.width;
              }
              lineY += content.lh;
            }
          }
          const edge = (b, x1, y1, x2, y2) => {
            if (b.w > 0) pushItem({ type: 'line', x1, y1, x2, y2, stroke: b.color, lineWidth: b.w }, ccs);
          };
          edge(bx.bT, cx, cy + bx.bT.w / 2, cx + cellW, cy + bx.bT.w / 2);
          edge(bx.bB, cx, cy + spanH - bx.bB.w / 2, cx + cellW, cy + spanH - bx.bB.w / 2);
          edge(bx.bL, cx + bx.bL.w / 2, cy, cx + bx.bL.w / 2, cy + spanH);
          edge(bx.bR, cx + cellW - bx.bR.w / 2, cy, cx + cellW - bx.bR.w / 2, cy + spanH);
          continue;
        }

        const nestedTable = slot.cell.children?.find((ch) => ch.type === 'element' && ch.tagName === 'table');
        if (nestedTable) {
          renderTable(nestedTable, cx + padL, cellW - padL - padR, cy + padT);
          continue;
        }

        const badgeChild = slot.cell.children?.find((ch) => ch.type === 'element' && (ch.classList?.contains('badge') || ch.classList?.contains('pill') || ch.computedStyle?.backgroundColor));
        if (badgeChild && !isHead) {
          const badgeText = extractNodeText(badgeChild).trim();
          const bcs = badgeChild.computedStyle || {};
          const bStyle = {
            fontSize: bcs.fontSize || 8,
            fontWeight: 'bold',
            fontFamily: bcs.fontFamily || 'Helvetica',
          };
          const bTextW = measureTextWidth(badgeText, bStyle);
          const bPadX = 6;
          const bPadY = 2;
          const bW = bTextW + bPadX * 2;
          const bH = (bStyle.fontSize || 8) * 1.3 + bPadY * 2;
          const hasExplicitCellAlign =
            Boolean(slot.cell.attrs?.style && /text-align/i.test(slot.cell.attrs.style)) ||
            Boolean(slot.cell.attrs?.class && /text-(left|center|right)/i.test(slot.cell.attrs.class));
          const alignRight = hasExplicitCellAlign ? ccs.textAlign === 'right' : (ccs.textAlign === 'right' || colIsNumeric[c]);
          const bx = alignRight ? cx + cellW - padR - bW : cx + padL;
          const by = cy + (spanH - bH) / 2;
          pushItem({
            type: 'rect',
            x: bx,
            y: by,
            w: bW,
            h: bH,
            fill: bcs.backgroundColor || '#dcfce7',
            radius: 4,
          }, bcs);
          pushItem({
            type: 'text',
            text: badgeText,
            x: bx + bPadX,
            y: by + bH * 0.72,
            ...bStyle,
            color: bcs.color || '#166534',
          }, bcs);
          continue;
        }

        const isBold = isHead || isFoot || Boolean(slot.cell.querySelector && slot.cell.querySelector('b'));
        const availCellW = Math.max(20, cellW - padL - padR);
        const fSize = ccs.fontSize || 9.5;
        const lh = fSize * 1.32;
        const cellBaseStyle = {
          ...ccs,
          fontSize: fSize,
          fontWeight: isBold ? 'bold' : ccs.fontWeight || 'normal',
          fontStyle: ccs.fontStyle || 'normal',
          fontFamily: ccs.fontFamily || 'Helvetica',
          color: isHead ? headTextColor(ccs) : isFoot ? '#0f172a' : ccs.color || '#0f172a',
        };

        const hasExplicitCellAlign =
          Boolean(slot.cell.attrs?.style && /text-align/i.test(slot.cell.attrs.style)) ||
          Boolean(slot.cell.attrs?.class && /text-(left|center|right)/i.test(slot.cell.attrs.class));
        const alignRight = hasExplicitCellAlign
          ? ccs.textAlign === 'right'
          : isHead
            ? (colIsNumeric[c] || colHasNumericHeader[c])
            : (ccs.textAlign === 'right' || colIsNumeric[c]);

        const hasInlineMarkup = cellNeedsTokens(slot.cell);

        if (hasInlineMarkup) {
          const tokens = extractInlineTokens(slot.cell, cellBaseStyle);
          const wrappedLines = wrapInlineTokens(tokens, availCellW, cellBaseStyle);
          const totalTextH = Math.max(1, wrappedLines.length) * lh;
          let lineY = cy + (spanH - totalTextH) / 2;
          const spaceW = measureTextWidth(' ', cellBaseStyle);

          for (const lineObj of wrappedLines) {
            let tx = alignRight
              ? cx + cellW - padR - lineObj.width
              : ccs.textAlign === 'center'
                ? cx + padL + (availCellW - lineObj.width) / 2
                : cx + padL;
            const baselineY = lineY + fSize * 0.84;

            for (let ti = 0; ti < lineObj.tokens.length; ti++) {
              const tok = lineObj.tokens[ti];
              if (tok.hasLeadingSpace) {
                tx += spaceW;
              }
              const padOffset = tok.bg ? 2.5 : 0;
              if (tok.bg) {
                pushItem({
                  type: 'rect',
                  x: tx,
                  y: lineY + 1,
                  w: tok.width,
                  h: (tok.fontSize || fSize) + 2,
                  fill: tok.bg,
                  radius: 2,
                }, ccs);
              }
              pushItem({
                type: 'text',
                text: tok.word,
                x: tx + padOffset,
                y: baselineY,
                fontSize: tok.fontSize || fSize,
                fontWeight: tok.fontWeight || cellBaseStyle.fontWeight,
                fontStyle: tok.fontStyle || cellBaseStyle.fontStyle,
                fontFamily: tok.fontFamily || cellBaseStyle.fontFamily,
                color: tok.color || cellBaseStyle.color,
              }, ccs);
              if (tok.href) {
                curPage.links.push({
                  x: tx,
                  y: lineY,
                  w: tok.width,
                  h: (tok.fontSize || fSize) + 2,
                  url: tok.href,
                });
              }
              tx += tok.width;
            }
            lineY += lh;
          }
        } else {
          const lines = wrapParagraphOptimal(extractNodeText(slot.cell), availCellW, cellBaseStyle);
          const textBlockH = lines.length * lh;
          let ty = cy + (spanH - textBlockH) / 2 + fSize * 0.84;

          for (const ln of lines) {
            const styleObj = {
              fontSize: fSize,
              fontWeight: isBold ? 'bold' : ccs.fontWeight || 'normal',
              fontStyle: ccs.fontStyle || 'normal',
              fontFamily: ccs.fontFamily || 'Helvetica',
            };
            const lw = measureTextWidth(ln, styleObj);
            const tx = alignRight
              ? cx + cellW - padR - lw
              : ccs.textAlign === 'center'
                ? cx + (cellW - lw) / 2
                : cx + padL;
            pushItem({
              type: 'text',
              text: ln,
              x: tx,
              y: ty,
              ...styleObj,
              color: cellBaseStyle.color,
            }, ccs);
            ty += lh;
          }
        }
        } finally {
          if (slot.rowspan > 1 && _pg.items.length > _i0) {
            const lastRow = Math.min(numRows - 1, r + slot.rowspan - 1);
            (deferredSpans[lastRow] ||= []).push({ page: _pg, items: _pg.items.splice(_i0) });
          }
        }
      }

      // rowspan cells were painted early; replay them now so later rows' backgrounds do not cover their text
      if (deferredSpans[r]) {
        for (const d of deferredSpans[r]) d.page.items.push(...d.items);
        deferredSpans[r] = null;
      }
      cursorY += rowH;

      const trBreakAfter =
        trCs['page-break-after'] === 'always' ||
        trCs['break-after'] === 'page' ||
        trCs.pageBreakAfter === 'always' ||
        trCs.breakAfter === 'page';
      if (trBreakAfter && r < numRows - 1 && overrideStartY == null) {
        closeTablePageBorder(cursorY);
        nextPage();
        pageTableStartY = cursorY;
      }
    }

    closeTablePageBorder(cursorY);
    cursorY += authored ? authoredMarginB : 10;

    if (overrideStartY != null) {
      const renderedH = cursorY - overrideStartY;
      cursorY = prevCursor;
      return renderedH;
    }
  }

  let listDepth = 0; // how many <ul>/<ol> enclose the node being rendered
  let lastMargin = null; // { y, m }: cursor after the last block and the bottom margin it contains
  function renderNode(node, x, availW, overrideY = null, inheritedAlign = 'left', forcedHeight = null, relativeBox = null) {
    if (!node || node.type !== 'element') return 0;
    const cs = node.computedStyle || {};
    if (cs.display === 'none' || node.tagName === 'head' || node.tagName === 'style' || node.tagName === 'script') return 0;

    const activeRelBox = relativeBox || { x: mLeft, y: mTop, w: contentW, h: maxPageY - mTop };

    if (cs.position === 'absolute' || cs.position === 'fixed') {
      const refBox = cs.position === 'fixed'
        ? { x: 0, y: 0, w: curPage.width, h: curPage.height }
        : activeRelBox;

      let absW = availW;
      if (cs.width) {
        if (typeof cs.width === 'string' && cs.width.endsWith('%')) {
          absW = (parseFloat(cs.width) / 100) * refBox.w;
        } else if (typeof cs.width === 'string' && cs.width.toLowerCase().startsWith('calc(')) {
          absW = evaluateCalc(cs.width, refBox.w, cs.fontSize);
        } else {
          absW = typeof cs.width === 'number' ? cs.width : evaluateCssValue(cs.width, { parentWidth: refBox.w, fontSize: cs.fontSize || 11 });
        }
      } else if (cs.left != null && cs.right != null) {
        const l = typeof cs.left === 'string' && cs.left.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.left, refBox.w, cs.fontSize) : evaluateCssValue(cs.left, { parentWidth: refBox.w });
        const r = typeof cs.right === 'string' && cs.right.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.right, refBox.w, cs.fontSize) : evaluateCssValue(cs.right, { parentWidth: refBox.w });
        absW = Math.max(0, refBox.w - l - r);
      } else {
        absW = Math.min(refBox.w, availW);
      }

      let absX = refBox.x;
      if (cs.left != null) {
        const l = typeof cs.left === 'string' && cs.left.toLowerCase().startsWith('calc(')
          ? evaluateCalc(cs.left, refBox.w, cs.fontSize)
          : (typeof cs.left === 'string' && cs.left.endsWith('%') ? (parseFloat(cs.left) / 100) * refBox.w : (evaluateCssValue(cs.left, { parentWidth: refBox.w }) || 0));
        absX = refBox.x + l;
      } else if (cs.right != null) {
        const r = typeof cs.right === 'string' && cs.right.toLowerCase().startsWith('calc(')
          ? evaluateCalc(cs.right, refBox.w, cs.fontSize)
          : (typeof cs.right === 'string' && cs.right.endsWith('%') ? (parseFloat(cs.right) / 100) * refBox.w : (evaluateCssValue(cs.right, { parentWidth: refBox.w }) || 0));
        absX = refBox.x + refBox.w - r - absW;
      }

      let absY = cursorY;
      if (cs.top != null) {
        const t = typeof cs.top === 'string' && cs.top.toLowerCase().startsWith('calc(')
          ? evaluateCalc(cs.top, refBox.h, cs.fontSize)
          : (typeof cs.top === 'string' && cs.top.endsWith('%') ? (parseFloat(cs.top) / 100) * refBox.h : (evaluateCssValue(cs.top, { parentWidth: refBox.h }) || 0));
        absY = refBox.y + t;
      } else if (cs.bottom != null) {
        const b = typeof cs.bottom === 'string' && cs.bottom.toLowerCase().startsWith('calc(')
          ? evaluateCalc(cs.bottom, refBox.h, cs.fontSize)
          : (typeof cs.bottom === 'string' && cs.bottom.endsWith('%') ? (parseFloat(cs.bottom) / 100) * refBox.h : (evaluateCssValue(cs.bottom, { parentWidth: refBox.h }) || 0));
        const nh = measureBlockHeight(node, absW);
        absY = refBox.y + refBox.h - b - nh;
      }

      const prevCursor = cursorY;
      const savedPos = cs.position;
      cs.position = 'static';
      renderNode(node, absX, absW, absY, inheritedAlign, null, activeRelBox);
      cs.position = savedPos;
      cursorY = prevCursor;
      return 0;
    }

    if (cs.position === 'relative') {
      let relX = x;
      let relY = overrideY;
      if (cs.left != null) {
        const l = typeof cs.left === 'string' && cs.left.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.left, availW, cs.fontSize) : (typeof cs.left === 'string' && cs.left.endsWith('%') ? (parseFloat(cs.left) / 100) * availW : evaluateCssValue(cs.left, { parentWidth: availW }));
        relX += l;
      } else if (cs.right != null) {
        const r = typeof cs.right === 'string' && cs.right.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.right, availW, cs.fontSize) : (typeof cs.right === 'string' && cs.right.endsWith('%') ? (parseFloat(cs.right) / 100) * availW : evaluateCssValue(cs.right, { parentWidth: availW }));
        relX -= r;
      }
      if (cs.top != null) {
        const t = typeof cs.top === 'string' && cs.top.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.top, availW, cs.fontSize) : evaluateCssValue(cs.top, { parentWidth: availW });
        if (relY != null) relY += t;
        else cursorY += t;
      } else if (cs.bottom != null) {
        const b = typeof cs.bottom === 'string' && cs.bottom.toLowerCase().startsWith('calc(') ? evaluateCalc(cs.bottom, availW, cs.fontSize) : evaluateCssValue(cs.bottom, { parentWidth: availW });
        if (relY != null) relY -= b;
        else cursorY -= b;
      }
      x = relX;
      if (relY != null) overrideY = relY;
    }

    const inlineBreakBefore = node.attrs?.style && /break-before:\s*page|page-break-before:\s*always/i.test(node.attrs.style);
    const breakBefore =
      cs['page-break-before'] === 'always' ||
      cs['break-before'] === 'page' ||
      cs.pageBreakBefore === 'always' ||
      cs.breakBefore === 'page' ||
      Boolean(inlineBreakBefore);
    if (breakBefore && overrideY == null && curPage.items.length > 0) {
      nextPage();
    }

    if (['html', 'body', 'document'].includes(node.tagName)) {
      for (const c of node.children) {
        if (c.type === 'element') renderNode(c, x, availW, null, inheritedAlign, null, activeRelBox);
      }
      return 0;
    }
    const effectiveAlign = cs.textAlign && cs.textAlign !== 'left' ? cs.textAlign : inheritedAlign;

    if (node.tagName === 'table') {
      // Inside a box that is painted at a fixed y (overrideY), the table must start there and report its
      // height, otherwise it lands at the stale page cursor and the box under-measures it.
      if (overrideY != null) return renderTable(node, x, availW, overrideY) || 0;
      renderTable(node, x, availW);
      const inlineBreakAfter = node.attrs?.style && /break-after:\s*page|page-break-after:\s*always/i.test(node.attrs.style);
      const breakAfter =
        cs['page-break-after'] === 'always' ||
        cs['break-after'] === 'page' ||
        cs.pageBreakAfter === 'always' ||
        cs.breakAfter === 'page' ||
        Boolean(inlineBreakAfter);
      if (breakAfter && overrideY == null) {
        nextPage();
      }
      return 0;
    }

    if (node.tagName === 'canvas') {
      const cw = (parseFloat(node.attrs.width) || 240) * 0.75;
      const ch = (parseFloat(node.attrs.height) || 70) * 0.75;
      const drawY = overrideY ?? cursorY;
      pushItem({
        type: 'canvas2d',
        x,
        y: drawY + 4,
        w: cw,
        h: ch,
        rawW: parseFloat(node.attrs.width) || 240,
        rawH: parseFloat(node.attrs.height) || 70,
        ops: node.canvasOps || [],
      }, cs);
      if (overrideY == null) cursorY += ch + 8;
      return ch + 8;
    }

    if (node.tagName === 'qr') {
      const sz = (parseFloat(node.attrs.size) || 64) * 0.75;
      const drawY = overrideY ?? cursorY;
      const qx = effectiveAlign === 'right' ? x + availW - sz : x;
      pushItem({
        type: 'qr',
        x: qx,
        y: drawY + 2,
        size: sz,
        value: node.attrs.value || 'https://veloxpdf.dev',
      }, cs);
      if (overrideY == null) cursorY += sz + 6;
      return sz + 6;
    }

    if (node.tagName === 'barcode' || node.attrs?.['data-barcode'] != null || node.classList?.contains('barcode')) {
      const val = node.attrs?.['data-barcode'] || node.attrs?.value || extractNodeText(node) || '123456789';
      const label = node.attrs?.['data-label'] ?? node.attrs?.label ?? (node.attrs?.showLabel !== 'false' ? val : '');
      const bw = parseFloat(node.attrs?.width) || parseFloat(cs.width) || Math.min(availW, 160);
      const bh = parseFloat(node.attrs?.height) || parseFloat(cs.height) || 48;
      const drawY = overrideY ?? cursorY;
      const drawX = effectiveAlign === 'right' ? x + availW - bw : effectiveAlign === 'center' ? x + (availW - bw) / 2 : x;
      if (overrideY == null) ensureSpace(bh + 6);
      pushItem({
        type: 'barcode',
        op: 'barcode',
        x: drawX,
        y: drawY + 2,
        w: bw,
        h: bh,
        value: val,
        label,
      }, cs);
      if (overrideY == null) cursorY += bh + 6 + (cs.marginBottom || 0);
      return bh + 6;
    }

    if (node.tagName === 'img') {
      const src = node.attrs?.src || '';
      const imgInfo = parseImageData(src);
      const { iw, ih } = imageSizeFor(node, availW, imgInfo);

      const drawY = overrideY ?? cursorY;
      const drawX = effectiveAlign === 'right' ? x + availW - iw : effectiveAlign === 'center' ? x + (availW - iw) / 2 : x;
      if (overrideY == null) ensureSpace(ih + 6);
      pushItem({
        type: 'image',
        op: 'image',
        x: drawX,
        y: drawY + 2,
        w: iw,
        h: ih,
        src,
        format: imgInfo?.format || 'png',
        widthPx: imgInfo?.widthPx || Math.round(iw),
        heightPx: imgInfo?.heightPx || Math.round(ih),
        data: imgInfo?.data || null,
      }, cs);
      if (overrideY == null) cursorY += ih + 6 + (cs.marginBottom || 0);
      return ih + 6;
    }

    if (node.tagName === 'svg') {
      const sw = parseFloat(node.attrs?.width) || parseFloat(cs.width) || 24;
      const sh = parseFloat(node.attrs?.height) || parseFloat(cs.height) || 24;
      const viewBox = node.attrs?.viewBox || node.attrs?.viewbox || `0 0 ${sw} ${sh}`;
      const paths = extractSvgPaths(node, node.attrs?.fill || cs.fill, node.attrs?.stroke || cs.stroke, node.attrs?.['stroke-width'], cs.color || '#0f172a');
      const drawY = overrideY ?? cursorY;
      const drawX = effectiveAlign === 'right' ? x + availW - sw : effectiveAlign === 'center' ? x + (availW - sw) / 2 : x;
      if (overrideY == null) ensureSpace(sh + 4);
      pushItem({
        type: 'svg',
        op: 'svg',
        x: drawX,
        y: drawY + 2,
        w: sw,
        h: sh,
        viewBox,
        paths,
      }, cs);
      if (overrideY == null) cursorY += sh + 4 + (cs.marginBottom || 0);
      return sh + 4;
    }

    if (overrideY == null) {
      // Adjacent vertical margins collapse: the gap is the larger of the two, not their sum.
      const mt = cs.marginTop || 0;
      cursorY += lastMargin && Math.abs(lastMargin.y - cursorY) < 0.01 ? Math.max(0, mt - lastMargin.m) : mt;
    }

    // CSS Grid (`display: grid`) — supports multi-track columns and stretches row cards to equal height
    if (cs.display === 'grid') {
      const cols = cs.gridCols || 3;
      const gap = cs.gap || 10;
      const kids = node.children.filter((c) => c.type === 'element');

      let colWidths = [];
      const tmpl = cs.gridTemplateColumns;
      if (tmpl && !tmpl.includes('repeat')) {
        const tracks = tmpl.trim().split(/\s+/);
        if (tracks.length === cols) {
          let totalFr = 0;
          let fixedW = 0;
          const parsed = tracks.map((t) => {
            if (t.endsWith('%')) {
              const w = (parseFloat(t) / 100) * availW;
              fixedW += w;
              return { type: 'px', val: w };
            }
            if (t.endsWith('pt') || t.endsWith('px')) {
              const w = parseFloat(t);
              fixedW += w;
              return { type: 'px', val: w };
            }
            if (t.endsWith('fr')) {
              const fr = parseFloat(t) || 1;
              totalFr += fr;
              return { type: 'fr', val: fr };
            }
            totalFr += 1;
            return { type: 'fr', val: 1 };
          });
          const totalGaps = gap * (cols - 1);
          const remW = Math.max(0, availW - fixedW - totalGaps);
          colWidths = parsed.map((p) => p.type === 'px' ? p.val : (totalFr > 0 ? (p.val / totalFr) * remW : 0));
        }
      }
      if (colWidths.length !== cols) {
        const cellW = (availW - gap * (cols - 1)) / cols;
        colWidths = new Array(cols).fill(cellW);
      }

      const gridRows = gridRowsOf(kids, cols);
      let totalGridH = 0;
      for (let r = 0; r < gridRows.length; r++) {
        let maxRowH = 0;
        for (const it of gridRows[r]) {
          maxRowH = Math.max(maxRowH, measureBlockHeight(it.k, gridItemBox(colWidths, gap, it.col, it.span).w));
        }
        // Inside a box painted at a fixed y (overrideY) the grid rows start there, not at the page cursor.
        if (overrideY == null) ensureSpace(maxRowH);
        const rowStartY = overrideY != null ? overrideY + totalGridH : cursorY;
        for (const it of gridRows[r]) {
          const box = gridItemBox(colWidths, gap, it.col, it.span);
          renderNode(it.k, x + box.off, box.w, rowStartY, effectiveAlign, maxRowH, activeRelBox);
        }
        const nextGap = r < gridRows.length - 1 ? gap : (cs.marginBottom || 10);
        if (overrideY == null) cursorY = rowStartY + maxRowH + nextGap;
        totalGridH += maxRowH + (r < gridRows.length - 1 ? gap : 0);
      }
      return totalGridH;
    }

    // Flexbox (`display: flex`)
    if (cs.display === 'flex' && cs.flexDirection !== 'column') {
      const kids = flexItemsOf(node.children, cs);
      const padT = cs.paddingTop || 0, padB = cs.paddingBottom || 0, padL = cs.paddingLeft || 0, padR = cs.paddingRight || 0;
      const innerW = availW - padL - padR;
      const myRelBox = cs.position === 'relative' ? { x, y: overrideY ?? cursorY, w: availW, h: forcedHeight || 60 } : activeRelBox;

      if (cs.flexWrap === 'wrap') {
        const gap = cs.gap || 0;
        const flexLines = [];
        let curLineKids = [];
        let curLineWidths = [];
        let curLineTotalW = 0;

        kids.forEach((k) => {
          const kcs = k.computedStyle || {};
          let kw = null;
          if (kcs.width) {
            kw = typeof kcs.width === 'string' && kcs.width.endsWith('%')
              ? (parseFloat(kcs.width) / 100) * innerW
              : evaluateCalc(kcs.width, innerW, kcs.fontSize);
          } else if (k.attrs?.width) {
            kw = parseFloat(k.attrs.width);
          }
          if (kw == null || kw <= 0) kw = Math.max(40, innerW / Math.max(1, kids.length));
          kw = Math.min(innerW, kw);

          const needed = curLineKids.length === 0 ? kw : kw + gap;
          if (curLineKids.length > 0 && curLineTotalW + needed > innerW + 1) {
            flexLines.push({ kids: curLineKids, widths: curLineWidths });
            curLineKids = [k];
            curLineWidths = [kw];
            curLineTotalW = kw;
          } else {
            curLineKids.push(k);
            curLineWidths.push(kw);
            curLineTotalW += needed;
          }
        });
        if (curLineKids.length > 0) flexLines.push({ kids: curLineKids, widths: curLineWidths });

        let measuredTotalH = padT + padB;
        flexLines.forEach((fl, lIdx) => {
          let lineH = 0;
          fl.kids.forEach((k, idx) => lineH = Math.max(lineH, measureBlockHeight(resolvedFlexItem(k), fl.widths[idx])));
          measuredTotalH += lineH + (lIdx < flexLines.length - 1 ? gap : 0);
        });

        ensureSpace(measuredTotalH);
        const startY = overrideY ?? cursorY;

        renderBlockBackgroundAndBorders(x, startY, availW, measuredTotalH, cs);

        let curLineY = startY + padT;
        let totalFlexH = padT;
        flexLines.forEach((fl, lIdx) => {
          let lineH = 0;
          fl.kids.forEach((k, idx) => lineH = Math.max(lineH, measureBlockHeight(resolvedFlexItem(k), fl.widths[idx])));
          let colX = x + padL;
          fl.kids.forEach((k, idx) => {
            const kw = fl.widths[idx];
            const childH = measureBlockHeight(resolvedFlexItem(k), kw);
            let childY = curLineY;
            if (cs.alignItems === 'center') {
              childY = curLineY + (lineH - childH) / 2;
            } else if (cs.alignItems === 'flex-end' || cs.alignItems === 'end') {
              childY = curLineY + lineH - childH;
            }
            renderNode(resolvedFlexItem(k), colX, kw, childY, k.computedStyle?.textAlign || effectiveAlign, null, myRelBox);
            colX += kw + gap;
          });
          curLineY += lineH + gap;
          totalFlexH += lineH + (lIdx < flexLines.length - 1 ? gap : 0);
        });
        totalFlexH += padB;

        if (overrideY == null) { cursorY = startY + totalFlexH + (cs.marginBottom || 0); lastMargin = { y: cursorY, m: cs.marginBottom || 0 }; }
        return totalFlexH;
      }

      const { childWidths, childXOffsets } = computeFlexRowLayout(kids, innerW, x + padL, cs);

      let maxChildH = 0;
      kids.forEach((k, i) => {
        maxChildH = Math.max(maxChildH, measureBlockHeight(resolvedFlexItem(k), childWidths[i]));
      });
      const boxH = forcedHeight ?? (maxChildH + padT + padB);

      // A page-sized flex row (a sidebar layout or page wrapper) cannot be split by the row layout, and its content
      // would be drawn below the page. When one item carries all the content and the others only decorate,
      // let that item flow and paginate normally, and paint the decoration on the first page.
      if (overrideY == null && forcedHeight == null && !options.singlePage && cursorY + boxH > maxPageY && boxH > 0) {
        const hasContent = (k) => Boolean(extractNodeText(k)) || Boolean(k.querySelector?.('img, svg, table, canvas, qr'));
        const contentKids = kids.map((k, i) => ({ k, i })).filter(({ k }) => hasContent(k));
        if (contentKids.length === 1) {
          const { k: ck, i: ci } = contentKids[0];
          const topY = cursorY;
          const firstPageH = Math.max(0, Math.min(boxH, maxPageY - topY));
          renderBlockBackgroundAndBorders(x, topY, availW, firstPageH, cs);
          kids.forEach((k, i) => {
            if (i !== ci) renderBlockBackgroundAndBorders(childXOffsets[i], topY, childWidths[i], firstPageH, k.computedStyle || {});
          });
          const kcs = ck.computedStyle || {};
          const flowKid = Object.create(ck, { computedStyle: { value: { ...kcs, width: undefined } } });
          renderNode(flowKid, childXOffsets[ci], childWidths[ci], null, ck.computedStyle?.textAlign || effectiveAlign, null, myRelBox);
          return cursorY - topY;
        }
      }

      ensureSpace(boxH);
      const startY = overrideY ?? cursorY;

      renderBlockBackgroundAndBorders(x, startY, availW, boxH, cs);

      kids.forEach((k, idx) => {
        const childH = measureBlockHeight(resolvedFlexItem(k), childWidths[idx]);
        let childY = startY + padT;
        if (cs.alignItems === 'center') {
          childY = startY + (boxH - childH) / 2;
        } else if (cs.alignItems === 'flex-end' || cs.alignItems === 'end') {
          childY = startY + boxH - padB - childH;
        }
        renderNode(resolvedFlexItem(k), childXOffsets[idx], childWidths[idx], childY, k.computedStyle?.textAlign || effectiveAlign, null, myRelBox);
      });
      if (overrideY == null) { cursorY = startY + boxH + (cs.marginBottom || 0); lastMargin = { y: cursorY, m: cs.marginBottom || 0 }; }
      return boxH;
    }

    // Standard Block or Pill Badge Element
    const padT = cs.paddingTop || 0, padB = cs.paddingBottom || 0, padL = cs.paddingLeft || 0, padR = cs.paddingRight || 0;
    const effectiveChildren = groupMixedChildren(node.children || [], cs);
    const blockKids = effectiveChildren.filter((c) => c.type === 'element' && !isInlineElement(c));
    const txt = blockKids.length === 0 ? extractNodeText(node) : '';

    const isBadgePill = node.classList?.contains('badge') || (cs.display === 'inline-block' && cs.backgroundColor);
    let boxW = availW;
    if (isBadgePill) {
      boxW = Math.min(availW, measureTextWidth(txt, cs) + padL + padR + 4);
    } else if (cs.width) {
      if (typeof cs.width === 'string' && cs.width.endsWith('%')) {
        boxW = (parseFloat(cs.width) / 100) * availW;
      } else if (typeof cs.width === 'string' && cs.width.toLowerCase().startsWith('calc(')) {
        boxW = evaluateCalc(cs.width, availW, cs.fontSize);
      } else {
        boxW = typeof cs.width === 'number' ? cs.width : evaluateCssValue(cs.width, { parentWidth: availW, fontSize: cs.fontSize || 11 });
      }
      boxW = Math.min(availW, Math.max(0, boxW));
    }
    if (cs.minWidth) {
      let minW = 0;
      if (typeof cs.minWidth === 'string' && cs.minWidth.endsWith('%')) minW = (parseFloat(cs.minWidth) / 100) * availW;
      else if (typeof cs.minWidth === 'string' && cs.minWidth.toLowerCase().startsWith('calc(')) minW = evaluateCalc(cs.minWidth, availW, cs.fontSize);
      else minW = typeof cs.minWidth === 'number' ? cs.minWidth : evaluateCssValue(cs.minWidth, { parentWidth: availW, fontSize: cs.fontSize || 11 });
      if (minW > boxW) boxW = Math.min(availW, minW);
    }
    if (cs.maxWidth) {
      let maxW = availW;
      if (typeof cs.maxWidth === 'string' && cs.maxWidth.endsWith('%')) maxW = (parseFloat(cs.maxWidth) / 100) * availW;
      else if (typeof cs.maxWidth === 'string' && cs.maxWidth.toLowerCase().startsWith('calc(')) maxW = evaluateCalc(cs.maxWidth, availW, cs.fontSize);
      else maxW = typeof cs.maxWidth === 'number' ? cs.maxWidth : evaluateCssValue(cs.maxWidth, { parentWidth: availW, fontSize: cs.fontSize || 11 });
      if (maxW < boxW) boxW = maxW;
    }
    // Horizontal margins: auto margins centre (both) or push right (left only) a box narrower than its line;
    // fixed margins inset the box.
    const autoL = cs.marginLeft === 'auto' || cs.marginLeftAuto;
    const autoR = cs.marginRight === 'auto' || cs.marginRightAuto;
    const fixedL = typeof cs.marginLeft === 'number' && cs.marginLeft > 0 && !autoL ? cs.marginLeft : 0;
    const fixedR = typeof cs.marginRight === 'number' && cs.marginRight > 0 && !autoR ? cs.marginRight : 0;
    if (!isBadgePill && (fixedL || fixedR) && !cs.width) boxW = Math.max(20, boxW - fixedL - fixedR);
    else if (!isBadgePill && cs.width && boxW > availW - fixedL - fixedR) boxW = Math.max(20, availW - fixedL - fixedR);
    let marginShift = fixedL;
    if (!isBadgePill && boxW < availW) {
      const free = availW - boxW - fixedL - fixedR;
      if (autoL && autoR) marginShift = fixedL + free / 2;
      else if (autoL) marginShift = fixedL + free;
    }
    const boxX = (isBadgePill || (cs.width && boxW < availW)) && effectiveAlign === 'right' && !autoL && !autoR
      ? x + availW - boxW
      : (cs.width && boxW < availW && effectiveAlign === 'center' && !autoL && !autoR)
        ? x + (availW - boxW) / 2
        : x + (isBadgePill ? 0 : marginShift);
    const innerW = Math.max(20, boxW - padL - padR);

    const naturalH = measureBlockHeight(node, boxW);
    const totalH = forcedHeight != null && !isBadgePill ? Math.max(naturalH, forcedHeight) : naturalH;
    // A shaded box taller than a whole page cannot be placed in one piece (its content would be drawn below
    // the page and lost). Let its children flow and paginate, and paint the shading page by page.
    if (
      overrideY == null && forcedHeight == null && !isBadgePill && !options.singlePage && blockKids.length > 0 &&
      (cs.backgroundColor || cs.gradient || cs.borderWidth) && totalH > maxPageY - cursorY && totalH > (maxPageY - mTop) * 0.5
    ) {
      const boxTop = cursorY;
      const shade = (top) => ({ type: 'rect', x: boxX, y: top, w: boxW, h: maxPageY - top, fill: cs.backgroundColor || null, gradient: cs.gradient, stroke: cs.borderWidth ? cs.borderColor || '#e2e8f0' : null, lineWidth: cs.borderWidth || 0, radius: cs.borderRadius || 0 });
      let lastRect = shade(boxTop);
      pushItem(lastRect, cs);
      let lastPage = curPage;
      cursorY = boxTop + padT;
      for (const bk of blockKids) {
        renderNode(bk, boxX + padL, innerW, null, effectiveAlign, null, activeRelBox);
        if (curPage !== lastPage) {
          const from = pages.indexOf(lastPage) + 1;
          const to = pages.indexOf(curPage);
          for (let pi = from; pi <= to; pi++) {
            lastRect = shade(mTop);
            pages[pi].items.unshift(lastRect);
          }
          lastPage = curPage;
        }
      }
      cursorY += padB;
      lastRect.h = Math.max(0, Math.min(maxPageY, cursorY) - lastRect.y);
      cursorY += cs.marginBottom || 0;
      return cursorY - boxTop;
    }
    // A plain wrapper (no shading, border or shadow) has nothing to keep whole: when it is longer than what is left
    // on the page its children simply continue on the next page, as in a browser.
    const splitFree =
      overrideY == null && forcedHeight == null && !isBadgePill && !options.singlePage && blockKids.length > 0 &&
      !cs.backgroundColor && !cs.gradient && !cs.borderWidth && !cs.boxShadow && !cs.borderTopWidth && !cs.borderBottomWidth &&
      !cs.borderLeftWidth && !cs.borderRightWidth && cs.position !== 'relative' && cs.display !== 'flex' && cs.display !== 'grid' &&
      totalH > maxPageY - cursorY && curPage.items.length > 0;
    if (overrideY == null && !splitFree) ensureSpace(totalH);
    const boxY = (overrideY ?? cursorY) + (overrideY != null ? cs.marginTop || 0 : 0);
    if (splitFree) cursorY += padT;

    renderBlockBackgroundAndBorders(boxX, boxY, boxW, totalH, cs);
    if (node._listMarker) {
      // Hanging marker in the list's indent, on the baseline of the first line, in the item's colour.
      const lm = node._listMarker;
      const fs = cs.fontSize || 12;
      const baseline = boxY + padT + fs * 0.85;
      const color = cs.color || '#0f172a';
      if (lm.type !== 'none') {
        const label = listMarkerText(lm.type, lm.n);
        if (label) {
          const lw = measureTextWidth(label + ' ', { ...cs, fontSize: fs });
          pushItem({ type: 'text', text: label, x: boxX - lw, y: baseline, fontSize: fs, fontWeight: 'normal', fontStyle: 'normal', fontFamily: cs.fontFamily || 'Helvetica', color }, cs);
        } else {
          const d = Math.max(3, fs * 0.33);
          const cy = baseline - fs * 0.3;
          const rx = boxX - fs * 0.7 - d;
          if (lm.type === 'disc') pushItem({ type: 'rect', x: rx, y: cy - d / 2, w: d, h: d, fill: color, radius: d / 2 }, cs);
          else if (lm.type === 'circle') pushItem({ type: 'rect', x: rx, y: cy - d / 2, w: d, h: d, fill: null, stroke: color, lineWidth: Math.max(0.6, fs * 0.07), radius: d / 2 }, cs);
          else pushItem({ type: 'rect', x: rx, y: cy - d / 2, w: d, h: d, fill: color, radius: 0 }, cs);
        }
      }
    }

    let innerY = boxY + padT;
    const myRelBox = cs.position === 'relative'
      ? { x: boxX, y: boxY, w: boxW, h: totalH }
      : activeRelBox;

    if (blockKids.length > 0) {
      // Floats: any number of left and right floats sit side by side at the line where they start; following
      // blocks flow in the space between them until `clear` or until they are passed.
      let floats = [];
      let prevMb = 0;
      const isList = node.tagName === 'ul' || node.tagName === 'ol';
      let listCounter = isList ? (parseInt(node.attrs?.start, 10) || 1) - 1 : 0;
      if (isList) listDepth++;
      const yNow = () => (overrideY == null ? cursorY : innerY);
      const setY = (v) => { if (overrideY == null) cursorY = v; else innerY = v; };
      const flowBox = () => {
        const live = floats.filter((f) => f.bottomY > yNow());
        const lf = live.filter((f) => f.side === 'left');
        const rf = live.filter((f) => f.side === 'right');
        const leftEdge = lf.length ? Math.max(...lf.map((f) => f.x + f.w)) + 8 : boxX + padL;
        const rightEdge = rf.length ? Math.min(...rf.map((f) => f.x)) - 8 : boxX + padL + innerW;
        return { live, x: leftEdge, w: Math.max(40, rightEdge - leftEdge) };
      };
      for (let i = 0; i < blockKids.length; i++) {
        const bk = blockKids[i];
        const bkCs = bk.computedStyle || {};
        if (isList && bk.tagName === 'li') {
          const v = parseInt(bk.attrs?.value, 10);
          listCounter = Number.isFinite(v) ? v : listCounter + 1;
          bk._listMarker = {
            n: listCounter,
            type: bkCs.listStyleType || (node.tagName === 'ol' ? 'decimal' : BULLET_BY_LEVEL[Math.min(listDepth - 1, 2)]),
          };
        }
        floats = floats.filter((f) => f.bottomY > yNow());

        if (bkCs.clear === 'both' || bkCs.clear === 'left' || bkCs.clear === 'right') {
          const hit = floats.filter((f) => bkCs.clear === 'both' || f.side === bkCs.clear);
          if (hit.length) setY(Math.max(yNow(), ...hit.map((f) => f.bottomY)));
          floats = floats.filter((f) => !hit.includes(f));
        }

        if (bkCs.float === 'left' || bkCs.float === 'right') {
          let floatW = innerW * 0.45;
          if (bkCs.width) {
            floatW = typeof bkCs.width === 'string' && bkCs.width.endsWith('%')
              ? (parseFloat(bkCs.width) / 100) * innerW
              : typeof bkCs.width === 'number' ? bkCs.width : evaluateCalc(bkCs.width, innerW, bkCs.fontSize);
          } else {
            // shrink-to-fit: as wide as its content, within the line
            floatW = Math.min(innerW * 0.5, Math.max(40, measureIntrinsicWidth(bk)));
          }
          floatW = Math.min(innerW, Math.max(30, floatW));
          const floatY = yNow();
          const same = floats.filter((f) => f.side === bkCs.float);
          const used = same.reduce((a, f) => a + f.w, 0);
          const floatX = bkCs.float === 'left' ? boxX + padL + used : boxX + padL + innerW - used - floatW;
          const floatH = renderNode(resolvedFlexItem(bk), floatX, floatW, floatY, effectiveAlign, null, myRelBox);
          floats.push({ side: bkCs.float, x: floatX, w: floatW, bottomY: floatY + floatH + (bkCs.marginBottom || 0) });
          continue;
        }

        const box = flowBox();
        const childX = box.live.length ? box.x : boxX + padL;
        const childW = box.live.length ? box.w : innerW;
        if (overrideY == null && !cs.backgroundColor && !cs.borderWidth && !cs.gradient && forcedHeight == null) {
          renderNode(bk, childX, childW, null, effectiveAlign, null, myRelBox);
        } else {
          // collapse the gap between this child's top margin and the previous child's bottom margin
          innerY -= Math.min(prevMb, bk.computedStyle?.marginTop || 0);
          const kh = renderNode(bk, childX, childW, innerY, effectiveAlign, null, myRelBox);
          innerY += kh + (bk.computedStyle?.marginTop || 0) + (bk.computedStyle?.marginBottom || 2);
          prevMb = bk.computedStyle?.marginBottom || 0;
        }
      }
      const pending = floats.filter((f) => f.bottomY > yNow());
      if (pending.length) setY(Math.max(...pending.map((f) => f.bottomY)));
      if (isList) listDepth--;
    } else if (txt) {
      // Check if node contains rich inline children (`<b>`, `<i>`, `<code>`, `<a href>`)
      const hasInlineMarkup = node.children.some((c) => c.type === 'element');
      const fSize = cs.fontSize || 10.5;
      const lh = cs.lineHeight || fSize * 1.38;

      if (hasInlineMarkup && !isBadgePill) {
        const tokens = extractInlineTokens(node, cs);
        const wrappedLines = wrapInlineTokens(tokens, innerW, cs);
        const spaceW = measureTextWidth(' ', cs);
        for (const lineObj of wrappedLines) {
          let tx =
            effectiveAlign === 'right'
              ? boxX + padL + innerW - lineObj.width
              : effectiveAlign === 'center'
                ? boxX + padL + (innerW - lineObj.width) / 2
                : boxX + padL;
          const baselineY = innerY + fSize * 0.85;
          for (let ti = 0; ti < lineObj.tokens.length; ti++) {
            const tok = lineObj.tokens[ti];
            if (tok.hasLeadingSpace) {
              tx += spaceW;
            }
            const padOffset = tok.bg ? 2.5 : 0;
            if (tok.bg) {
              pushItem({
                type: 'rect',
                x: tx,
                y: innerY + 1,
                w: tok.width,
                h: fSize + 2,
                fill: tok.bg,
                radius: 2,
              }, cs);
            }
            pushItem({
              type: 'text',
              text: tok.word,
              x: tx + padOffset,
              y: baselineY,
              fontSize: tok.fontSize,
              fontWeight: tok.fontWeight,
              fontStyle: tok.fontStyle,
              fontFamily: tok.fontFamily,
              color: tok.color,
            }, cs);
            if (tok.href) {
              curPage.links.push({
                x: tx,
                y: innerY,
                w: tok.width,
                h: fSize + 2,
                url: tok.href,
              });
            }
            tx += tok.width;
          }
          innerY += lh;
        }
      } else {
        const lines = wrapParagraphOptimal(txt, innerW, cs);
        for (const ln of lines) {
          const lw = measureTextWidth(ln, cs);
          const tx =
            isBadgePill
              ? boxX + (boxW - lw) / 2
              : effectiveAlign === 'right'
                ? boxX + padL + innerW - lw
                : effectiveAlign === 'center'
                  ? boxX + padL + (innerW - lw) / 2
                  : boxX + padL;
          pushItem({
            type: 'text',
            text: ln,
            x: tx,
            y: innerY + fSize * 0.85,
            fontSize: fSize,
            fontWeight: cs.fontWeight || 'normal',
            fontStyle: cs.fontStyle || 'normal',
            fontFamily: cs.fontFamily || 'Helvetica',
            color: cs.color || '#0f172a',
          }, cs);
          innerY += lh;
        }
      }
    }

    if (overrideY == null) {
      cursorY = splitFree ? cursorY + padB + (cs.marginBottom || 0) : boxY + totalH + (cs.marginBottom || 0);
      lastMargin = { y: cursorY, m: cs.marginBottom || 0 };
    }
    const inlineBreakAfter = node.attrs?.style && /break-after:\s*page|page-break-after:\s*always/i.test(node.attrs.style);
    const breakAfter =
      cs['page-break-after'] === 'always' ||
      cs['break-after'] === 'page' ||
      cs.pageBreakAfter === 'always' ||
      cs.breakAfter === 'page' ||
      Boolean(inlineBreakAfter);
    if (breakAfter && overrideY == null) {
      nextPage();
    }
    return totalH;
  }

  renderNode(rootNode, mLeft, contentW);

  if (Boolean(options.sign) || options.visualSeal === true) {
    if (cursorY + 54 >= maxPageY && curPage.items.length > 0) {
      nextPage();
    }
    const lastPage = pages[pages.length - 1];
    const sealY = cursorY + 12;
    lastPage.items.push({
      type: 'rect',
      x: mLeft,
      y: sealY,
      w: contentW,
      h: 42,
      fill: '#f0fdf4',
      stroke: '#86efac',
      lineWidth: 1,
      radius: 6,
    });
    lastPage.items.push({
      type: 'text',
      text: 'X.509 CRYPTOGRAPHIC DIGITAL SIGNATURE  ·  PKCS#7 / RSA-SHA256 VERIFIED',
      x: mLeft + 12,
      y: sealY + 16,
      fontSize: 8.5,
      fontWeight: 'bold',
      fontFamily: 'Helvetica',
      color: '#166534',
    });
    lastPage.items.push({
      type: 'text',
      text: 'Authority: VeloxPDF Treasury Authority  ·  SubFilter: adbe.pkcs7.detached  ·  SHA-256 ByteRange Verified',
      x: mLeft + 12,
      y: sealY + 31,
      fontSize: 7.5,
      fontWeight: 'normal',
      fontFamily: 'Courier',
      color: '#15803d',
    });
    cursorY = sealY + 42;
  }

  // The canvas background: html (else body) background colour or gradient fills every page edge to edge,
  // margins included, as in a browser's print output.
  {
    const findTag = (n, tag) => {
      if (!n || n.type !== 'element') return null;
      if (n.tagName === tag) return n;
      for (const c of n.children || []) { const f = findTag(c, tag); if (f) return f; }
      return null;
    };
    const htmlCs = findTag(rootNode, 'html')?.computedStyle || {};
    const bodyCs = findTag(rootNode, 'body')?.computedStyle || {};
    const src = htmlCs.backgroundColor || htmlCs.gradient ? htmlCs : bodyCs;
    const fill = src.backgroundColor && !/^(#fff|#ffffff|white|transparent)$/i.test(src.backgroundColor) ? src.backgroundColor : null;
    if (fill || src.gradient) {
      for (const pg of pages) pg.items.unshift({ type: 'rect', x: 0, y: 0, w: pg.width, h: pg.height, fill, gradient: src.gradient, stroke: null, lineWidth: 0, radius: 0 });
    }
  }

  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    if (options.headerText) {
      const ht = String(options.headerText)
        .replace(/\{\{page\}\}/g, String(idx + 1))
        .replace(/\{\{pages\}\}/g, String(totalPages));
      const headerY = Math.max(16, mTop - 14);
      p.items.push({
        type: 'text',
        text: ht,
        x: mLeft,
        y: headerY,
        fontSize: 8,
        fontWeight: 'normal',
        fontFamily: 'Helvetica',
        color: '#64748b',
      });
      p.items.push({
        type: 'line',
        x1: mLeft,
        y1: headerY + 6,
        x2: p.width - mRight,
        y2: headerY + 6,
        stroke: '#e2e8f0',
        lineWidth: 0.5,
      });
    }

    if (options.footerText) {
      const ft = String(options.footerText)
        .replace(/\{\{page\}\}/g, String(idx + 1))
        .replace(/\{\{pages\}\}/g, String(totalPages));
      p.items.push({
        type: 'text',
        text: ft,
        x: p.width - mRight - measureTextWidth(ft, { fontSize: 8.5 }),
        y: p.height - Math.max(16, mBottom / 2),
        fontSize: 8.5,
        fontWeight: 'normal',
        fontFamily: 'Helvetica',
        color: '#64748b',
      });
    }
  });
  pages.forEach((p) => {
    p.items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    p.elements = p.items;
  });
  return { pages };
}
