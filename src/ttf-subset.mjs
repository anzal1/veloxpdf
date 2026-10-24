// Zero-dependency TrueType (glyf-based) subsetter for PDF embedding.
//
// subsetTrueType(fontBytes, glyphIds, { unicodes }) keeps only the requested glyphs and
// renumbers them densely: new glyph id i is glyphIds[i] (glyphIds[0] must be 0, .notdef).
// Components of composite glyphs that are not already in the list are appended after the
// requested glyphs, and the composite records are rewritten to point at the new ids, so the
// ids the caller already wrote into content streams never move.
//
// Rebuilt tables: glyf, loca, hmtx, hhea, maxp, post (format 3, no glyph names) and a small
// (3,1) format 4 cmap for the kept BMP code points. Copied as is: head (patched), OS/2, name,
// cvt, fpgm, prep. Everything else (GSUB, GPOS, kern, hdmx, LTSH, VDMX, DSIG, ...) is dropped
// because it either indexes glyphs by the old ids or is not used by PDF renderers.

const KEEP_AS_IS = ['OS/2', 'name', 'cvt ', 'fpgm', 'prep', 'gasp'];

function readTables(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    tables[tag] = { offset: view.getUint32(o + 8), length: view.getUint32(o + 12) };
  }
  return { view, tables };
}

function slice(bytes, t) {
  return bytes.subarray(t.offset, t.offset + t.length);
}

function checksum(buf) {
  let sum = 0;
  const n = buf.length;
  for (let i = 0; i < n; i += 4) {
    const v = ((buf[i] << 24) | ((buf[i + 1] || 0) << 16) | ((buf[i + 2] || 0) << 8) | (buf[i + 3] || 0)) >>> 0;
    sum = (sum + v) >>> 0;
  }
  return sum;
}

function pad4(len) {
  return (len + 3) & ~3;
}

// Composite glyph flags (OpenType spec, glyf table)
const ARG_1_AND_2_ARE_WORDS = 0x0001;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

// Walks the component records of a composite glyph. cb(componentGlyphIdOffset, glyphId).
function forEachComponent(glyph, cb) {
  if (glyph.length < 10) return;
  const nContours = (glyph[0] << 8 | glyph[1]) << 16 >> 16;
  if (nContours >= 0) return;
  let p = 10;
  for (;;) {
    if (p + 4 > glyph.length) return;
    const flags = glyph[p] << 8 | glyph[p + 1];
    const gid = glyph[p + 2] << 8 | glyph[p + 3];
    cb(p + 2, gid);
    p += 4;
    p += (flags & ARG_1_AND_2_ARE_WORDS) ? 4 : 2;
    if (flags & WE_HAVE_A_SCALE) p += 2;
    else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) p += 4;
    else if (flags & WE_HAVE_A_TWO_BY_TWO) p += 8;
    if (!(flags & MORE_COMPONENTS)) return;
  }
}

function buildCmap(pairs) {
  // pairs: sorted [codePoint, newGid] with codePoint <= 0xFFFF. One segment per code point
  // (plus the 0xFFFF terminator) keeps the encoder trivial; subset fonts hold few glyphs.
  const segs = pairs.map(([c, g]) => ({ start: c, end: c, delta: (g - c) & 0xFFFF }));
  segs.push({ start: 0xFFFF, end: 0xFFFF, delta: 1 });
  const segCount = segs.length;
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= segCount) { searchRange *= 2; entrySelector++; }
  searchRange *= 2;
  const subLen = 16 + segCount * 8;
  const buf = new Uint8Array(12 + subLen);
  const v = new DataView(buf.buffer);
  v.setUint16(0, 0); v.setUint16(2, 1); // version, numTables
  v.setUint16(4, 3); v.setUint16(6, 1); v.setUint32(8, 12); // (3,1) at offset 12
  let o = 12;
  v.setUint16(o, 4); v.setUint16(o + 2, subLen); v.setUint16(o + 4, 0);
  v.setUint16(o + 6, segCount * 2); v.setUint16(o + 8, searchRange);
  v.setUint16(o + 10, entrySelector); v.setUint16(o + 12, segCount * 2 - searchRange);
  o += 14;
  for (const s of segs) { v.setUint16(o, s.end); o += 2; }
  o += 2; // reservedPad
  for (const s of segs) { v.setUint16(o, s.start); o += 2; }
  for (const s of segs) { v.setUint16(o, s.delta); o += 2; }
  for (let i = 0; i < segCount; i++) { v.setUint16(o, 0); o += 2; }
  return buf;
}

/**
 * @param {Uint8Array} fontBytes   original TrueType font
 * @param {number[]}   glyphIds    old glyph ids in new-id order; glyphIds[0] should be 0
 * @param {object}     [opts]
 * @param {Map<number,number>} [opts.unicodes] code point -> NEW glyph id, for the cmap
 * @returns {{ bytes: Uint8Array, glyphIds: number[], numGlyphs: number }}
 *   glyphIds is the final old-id list (requested ids plus appended composite components).
 */
export function subsetTrueType(fontBytes, glyphIds, opts = {}) {
  const bytes = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
  const { view, tables } = readTables(bytes);
  for (const req of ['head', 'hhea', 'maxp', 'hmtx', 'loca', 'glyf']) {
    if (!tables[req]) throw new Error(`ttf-subset: missing required table ${req}`);
  }
  const head = tables.head.offset;
  const longLoca = view.getInt16(head + 50) === 1;
  const numGlyphs = view.getUint16(tables.maxp.offset + 4);
  const numHMetrics = view.getUint16(tables.hhea.offset + 34);
  const locaOff = tables.loca.offset;
  const glyfOff = tables.glyf.offset;
  const loca = (g) => (longLoca ? view.getUint32(locaOff + g * 4) : view.getUint16(locaOff + g * 2) * 2);
  const glyphData = (g) => {
    if (g >= numGlyphs) return new Uint8Array(0);
    const a = loca(g);
    const b = loca(g + 1);
    return b > a ? bytes.subarray(glyfOff + a, glyfOff + b) : new Uint8Array(0);
  };

  // 1. Close over composite components, appending new ones at the end.
  const order = glyphIds.length && glyphIds[0] === 0 ? glyphIds.slice() : [0, ...glyphIds.filter((g) => g !== 0)];
  const newIdOf = new Map();
  order.forEach((g, i) => { if (!newIdOf.has(g)) newIdOf.set(g, i); });
  for (let i = 0; i < order.length; i++) {
    forEachComponent(glyphData(order[i]), (_, comp) => {
      if (!newIdOf.has(comp)) { newIdOf.set(comp, order.length); order.push(comp); }
    });
  }
  const n = order.length;

  // 2. glyf + loca
  const glyphCopies = order.map((g) => {
    const src = glyphData(g);
    if (!src.length) return src;
    const copy = new Uint8Array(src);
    forEachComponent(copy, (p, comp) => {
      const nid = newIdOf.get(comp) ?? 0;
      copy[p] = nid >> 8; copy[p + 1] = nid & 0xFF;
    });
    return copy;
  });
  const glyfLen = glyphCopies.reduce((s, g) => s + pad4(g.length), 0);
  const useLong = glyfLen > 0x1FFFC;
  const glyf = new Uint8Array(glyfLen);
  const locaBuf = new Uint8Array((n + 1) * (useLong ? 4 : 2));
  const lv = new DataView(locaBuf.buffer);
  let pos = 0;
  for (let i = 0; i < n; i++) {
    if (useLong) lv.setUint32(i * 4, pos); else lv.setUint16(i * 2, pos / 2);
    glyf.set(glyphCopies[i], pos);
    pos += pad4(glyphCopies[i].length);
  }
  if (useLong) lv.setUint32(n * 4, pos); else lv.setUint16(n * 2, pos / 2);

  // 3. hmtx (one full metric per glyph)
  const hmtx = new Uint8Array(n * 4);
  const hv = new DataView(hmtx.buffer);
  const hmtxOff = tables.hmtx.offset;
  let maxAdv = 0;
  order.forEach((g, i) => {
    const m = Math.min(g, numHMetrics - 1);
    const adv = view.getUint16(hmtxOff + m * 4);
    const lsb = g < numHMetrics
      ? view.getInt16(hmtxOff + g * 4 + 2)
      : view.getInt16(hmtxOff + numHMetrics * 4 + (g - numHMetrics) * 2);
    hv.setUint16(i * 4, adv);
    hv.setInt16(i * 4 + 2, lsb);
    if (adv > maxAdv) maxAdv = adv;
  });

  // 4. hhea, maxp, head, post
  const hhea = new Uint8Array(slice(bytes, tables.hhea));
  new DataView(hhea.buffer).setUint16(34, n);
  const maxp = new Uint8Array(slice(bytes, tables.maxp));
  new DataView(maxp.buffer).setUint16(4, n);
  const headBuf = new Uint8Array(slice(bytes, tables.head));
  const headView = new DataView(headBuf.buffer);
  headView.setUint32(8, 0); // checkSumAdjustment, patched below
  headView.setInt16(50, useLong ? 1 : 0);
  const post = new Uint8Array(32);
  if (tables.post) post.set(bytes.subarray(tables.post.offset, tables.post.offset + Math.min(32, tables.post.length)));
  new DataView(post.buffer).setUint32(0, 0x00030000);

  const out = {
    head: headBuf, hhea, maxp, hmtx, loca: locaBuf, glyf, post,
  };
  if (opts.unicodes && opts.unicodes.size) {
    const pairs = [...opts.unicodes.entries()].filter(([c, g]) => c <= 0xFFFE && g < n).sort((a, b) => a[0] - b[0]);
    out.cmap = buildCmap(pairs);
  }
  for (const tag of KEEP_AS_IS) if (tables[tag]) out[tag] = slice(bytes, tables[tag]);

  // 5. Assemble the sfnt
  const tags = Object.keys(out).sort();
  const numTables = tags.length;
  let es = 0;
  while ((1 << (es + 1)) <= numTables) es++;
  const sr = (1 << es) * 16;
  let total = 12 + numTables * 16;
  for (const t of tags) total += pad4(out[t].length);
  const font = new Uint8Array(total);
  const fv = new DataView(font.buffer);
  fv.setUint32(0, 0x00010000);
  fv.setUint16(4, numTables); fv.setUint16(6, sr); fv.setUint16(8, es); fv.setUint16(10, numTables * 16 - sr);
  let off = 12 + numTables * 16;
  let headPos = 0;
  tags.forEach((t, i) => {
    const data = out[t];
    const rec = 12 + i * 16;
    for (let k = 0; k < 4; k++) font[rec + k] = t.charCodeAt(k);
    fv.setUint32(rec + 4, checksum(data));
    fv.setUint32(rec + 8, off);
    fv.setUint32(rec + 12, data.length);
    font.set(data, off);
    if (t === 'head') headPos = off;
    off += pad4(data.length);
  });
  fv.setUint32(headPos + 8, (0xB1B0AFBA - checksum(font)) >>> 0);
  return { bytes: font, glyphIds: order, numGlyphs: n };
}

// Six capital letters derived from the glyph set, as PDF subset tags require (ISO 32000-1 9.6.4).
export function subsetTag(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let tag = '';
  for (let i = 0; i < 6; i++) { tag += String.fromCharCode(65 + (h % 26)); h = Math.floor(h / 26) ^ Math.imul(h, 31); h >>>= 0; }
  return tag;
}
