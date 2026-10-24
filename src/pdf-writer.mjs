import zlib from 'node:zlib';
import { subsetTrueType, subsetTag } from './ttf-subset.mjs';

export function parseHexColor(c, currentColorRgb = null) {
  if (!c || c === 'transparent' || c === 'none') return null;
  const s = String(c).trim();
  if (s.toLowerCase() === 'currentcolor') {
    return currentColorRgb || [0.06, 0.09, 0.16];
  }
  if (s === 'white') return [1, 1, 1];
  if (s === 'black') return [0, 0, 0];
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
    }
  }
  const rgbMatch = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10) / 255,
      parseInt(rgbMatch[2], 10) / 255,
      parseInt(rgbMatch[3], 10) / 255,
    ];
  }
  return [0.06, 0.09, 0.16];
}

const WIN_ANSI_MAP = {
  '€': '\\200', '‚': '\\202', 'ƒ': '\\203', '„': '\\204', '…': '\\205', '†': '\\206', '‡': '\\207',
  'ˆ': '\\210', '‰': '\\211', 'Š': '\\212', '‹': '\\213', 'Œ': '\\214', 'Ž': '\\216', '‘': '\\221',
  '’': '\\222', '“': '\\223', '”': '\\224', '•': '\\225', '–': '\\226', '—': '\\227', '˜': '\\230',
  '™': '\\231', 'š': '\\232', '›': '\\233', 'œ': '\\234', 'ž': '\\236', 'Ÿ': '\\237', ' ': '\\240',
  '¡': '\\241', '¢': '\\242', '£': '\\243', '¤': '\\244', '¥': '\\245', '¦': '\\246', '§': '\\247',
  '¨': '\\250', '©': '\\251', 'ª': '\\252', '«': '\\253', '®': '\\256', '°': '\\260', '±': '\\261',
  '²': '\\262', '³': '\\263', '´': '\\264', 'µ': '\\265', '¶': '\\266', '·': '\\267', '¸': '\\270',
  '¹': '\\271', 'º': '\\272', '»': '\\273', '¼': '\\274', '½': '\\275', '¾': '\\276', '¿': '\\277',
  'À': '\\300', 'Á': '\\301', 'Â': '\\302', 'Ã': '\\303', 'Ä': '\\304', 'Å': '\\305', 'Æ': '\\306', 'Ç': '\\307',
  'È': '\\310', 'É': '\\311', 'Ê': '\\312', 'Ë': '\\313', 'Ì': '\\314', 'Í': '\\315', 'Î': '\\316', 'Ï': '\\317',
  'Ð': '\\320', 'Ñ': '\\321', 'Ò': '\\322', 'Ó': '\\323', 'Ô': '\\324', 'Õ': '\\325', 'Ö': '\\326', '×': '\\327',
  'Ø': '\\330', 'Ù': '\\331', 'Ú': '\\332', 'Û': '\\333', 'Ü': '\\334', 'Ý': '\\335', 'Þ': '\\336', 'ß': '\\337',
  'à': '\\340', 'á': '\\341', 'â': '\\342', 'ã': '\\343', 'ä': '\\344', 'å': '\\345', 'æ': '\\346', 'ç': '\\347',
  'è': '\\350', 'é': '\\351', 'ê': '\\352', 'ë': '\\353', 'ì': '\\354', 'í': '\\355', 'î': '\\356', 'ï': '\\357',
  'ð': '\\360', 'ñ': '\\361', 'ò': '\\362', 'ó': '\\363', 'ô': '\\364', 'õ': '\\365', 'ö': '\\366', '÷': '\\367',
  'ø': '\\370', 'ù': '\\371', 'ú': '\\372', 'û': '\\373', 'ü': '\\374', 'ý': '\\375', 'þ': '\\376', 'ÿ': '\\377',
  '₹': 'Rs.',
  '✓': '[v]', '✔': '[v]',
  '✗': '[x]', '✖': '[x]',
  '→': '->', '←': '<-', '↑': '^', '↓': 'v', '↔': '<->',
  '⚡': '*', '★': '*', '☆': '*', '✦': '*', '✧': '*',
  '♥': '<3', '❤': '<3',
  '\u00A0': '\\240',
  '\u200B': '',
};

export function pdfEscapeText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (WIN_ANSI_MAP[ch]) return WIN_ANSI_MAP[ch];
      const code = ch.charCodeAt(0);
      if (code >= 160 && code <= 255) {
        return '\\' + code.toString(8).padStart(3, '0');
      }
      return ' ';
    });
}

// =============================================================================
// ISO/IEC 18004 QR Code Generator (Versions 1–10, Byte Mode, up to 271 bytes)
// =============================================================================
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(dataBytes, ecLen) {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], root);
    }
    gen = next;
  }
  const msg = new Uint8Array(dataBytes.length + ecLen);
  msg.set(dataBytes, 0);
  for (let i = 0; i < dataBytes.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.subarray(dataBytes.length);
}

// Table of QR specifications for Versions 1-10 (Level L)
const QR_SPECS = {
  1: { totalCw: 26, ecPerBlock: 7, blocks: [{ count: 1, dataCw: 19 }], align: [] },
  2: { totalCw: 44, ecPerBlock: 10, blocks: [{ count: 1, dataCw: 34 }], align: [6, 18] },
  3: { totalCw: 70, ecPerBlock: 15, blocks: [{ count: 1, dataCw: 55 }], align: [6, 22] },
  4: { totalCw: 100, ecPerBlock: 20, blocks: [{ count: 1, dataCw: 80 }], align: [6, 26] },
  5: { totalCw: 134, ecPerBlock: 26, blocks: [{ count: 1, dataCw: 108 }], align: [6, 30] },
  6: { totalCw: 172, ecPerBlock: 18, blocks: [{ count: 2, dataCw: 68 }], align: [6, 34] },
  7: { totalCw: 196, ecPerBlock: 20, blocks: [{ count: 2, dataCw: 78 }], align: [6, 22, 38], verBits: 0x07c94 },
  8: { totalCw: 242, ecPerBlock: 24, blocks: [{ count: 2, dataCw: 97 }], align: [6, 24, 42], verBits: 0x085bc },
  9: { totalCw: 292, ecPerBlock: 30, blocks: [{ count: 2, dataCw: 116 }], align: [6, 26, 46], verBits: 0x09a99 },
  10: { totalCw: 346, ecPerBlock: 18, blocks: [{ count: 2, dataCw: 68 }, { count: 2, dataCw: 69 }], align: [6, 28, 50], verBits: 0x0a4d3 },
};

export function generateQrMatrix(value = 'https://veloxpdf.dev') {
  const rawBytes = Buffer.from(String(value), 'utf8');

  // Dynamically select smallest version (1 to 10) that can fit the payload
  let ver = 1;
  while (ver <= 10) {
    const spec = QR_SPECS[ver];
    let totalData = 0;
    for (const b of spec.blocks) totalData += b.count * b.dataCw;
    const headerBits = ver < 10 ? 12 : 20; // 4 bit mode + 8/16 bit count
    const maxB = Math.floor((totalData * 8 - headerBits - 4) / 8);
    if (rawBytes.length <= maxB || ver === 10) break;
    ver++;
  }

  const spec = QR_SPECS[ver];
  let totalDataCw = 0;
  for (const b of spec.blocks) totalDataCw += b.count * b.dataCw;
  const headerBits = ver < 10 ? 12 : 20;
  const maxBytes = Math.floor((totalDataCw * 8 - headerBits - 4) / 8);
  const bytes = rawBytes.subarray(0, maxBytes);

  const N = 17 + 4 * ver;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(bytes.length, ver < 10 ? 8 : 16); // Character count indicator
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, Math.min(4, totalDataCw * 8 - bits.length)); // Terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCw = new Uint8Array(totalDataCw);
  for (let i = 0; i < bits.length / 8 && i < totalDataCw; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i * 8 + b] || 0);
    dataCw[i] = v;
  }
  const padBytes = [0xec, 0x11];
  for (let i = Math.floor(bits.length / 8); i < totalDataCw; i++) {
    dataCw[i] = padBytes[(i - Math.floor(bits.length / 8)) % 2];
  }

  // Partition into Reed-Solomon blocks and generate EC codewords
  const blockData = [];
  const blockEc = [];
  let cwOffset = 0;
  for (const group of spec.blocks) {
    for (let c = 0; c < group.count; c++) {
      const bCw = dataCw.subarray(cwOffset, cwOffset + group.dataCw);
      cwOffset += group.dataCw;
      blockData.push(bCw);
      blockEc.push(rsEncode(bCw, spec.ecPerBlock));
    }
  }

  // Interleave data codewords across blocks
  const interleavedData = [];
  let maxDataLen = 0;
  for (const b of blockData) if (b.length > maxDataLen) maxDataLen = b.length;
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blockData) {
      if (i < b.length) interleavedData.push(b[i]);
    }
  }

  // Interleave EC codewords across blocks
  const interleavedEc = [];
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const b of blockEc) {
      if (i < b.length) interleavedEc.push(b[i]);
    }
  }

  const allCodewords = interleavedData.concat(interleavedEc);
  const allBits = [];
  for (const cw of allCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((cw >>> i) & 1);
  }

  const grid = Array.from({ length: N }, () => new Array(N).fill(0));
  const reserved = Array.from({ length: N }, () => new Uint8Array(N));

  const placeFinder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        reserved[rr][cc] = 1;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))) {
          grid[rr][cc] = 1;
        }
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  // Alignment patterns
  if (spec.align && spec.align.length > 0) {
    const coords = spec.align;
    for (const r of coords) {
      for (const c of coords) {
        if ((r === 6 && c === 6) || (r === 6 && c === N - 7) || (r === N - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            reserved[rr][cc] = 1;
            if (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) {
              grid[rr][cc] = 1;
            }
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    reserved[6][i] = reserved[i][6] = 1;
    grid[6][i] = grid[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Format info areas
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = reserved[i][8] = 1;
    if (i < 8) {
      reserved[8][N - 1 - i] = 1;
      reserved[N - 1 - i][8] = 1;
    }
  }
  grid[N - 8][8] = 1; // Dark module

  // Version information for Versions >= 7
  if (spec.verBits !== undefined) {
    const vb = spec.verBits;
    for (let i = 0; i < 18; i++) {
      const bit = (vb >>> i) & 1;
      const r1 = Math.floor(i / 3), c1 = N - 11 + (i % 3);
      reserved[r1][c1] = 1;
      grid[r1][c1] = bit;

      const r2 = N - 11 + (i % 3), c2 = Math.floor(i / 3);
      reserved[r2][c2] = 1;
      grid[r2][c2] = bit;
    }
  }

  // Zigzag data placement
  let bitIdx = 0;
  let upward = true;
  for (let right = N - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < N; vert++) {
      const r = upward ? N - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!reserved[r][c]) {
          let bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          if ((r + c) % 2 === 0) bit ^= 1; // Mask 0: (row + col) % 2 === 0
          grid[r][c] = bit;
        }
      }
    }
    upward = !upward;
  }

  // Format bits for Level L (01) + Mask 0 (000) -> 0x77c4
  const fmt = 0x77c4;
  const fBits = [];
  for (let i = 0; i < 15; i++) fBits.push((fmt >>> i) & 1);
  for (let i = 0; i <= 5; i++) grid[8][i] = fBits[i];
  grid[8][7] = fBits[6];
  grid[8][8] = fBits[7];
  grid[7][8] = fBits[8];
  for (let i = 9; i < 15; i++) grid[14 - i][8] = fBits[i];
  for (let i = 0; i < 8; i++) grid[N - 1 - i][8] = fBits[i];
  for (let i = 8; i < 15; i++) grid[8][N - 15 + i] = fBits[i];

  grid.version = ver;
  return grid;
}

// =============================================================================
// ISO/IEC 15417 Code 128 Barcode Generator (Set B)
// =============================================================================
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export function generateCode128Bars(value = 'INV-2026') {
  const str = String(value || '');
  const symbols = [104]; // Start B = 104
  let sum = 104;
  for (let i = 0; i < str.length; i++) {
    let val = str.charCodeAt(i) - 32;
    if (val < 0 || val > 95) val = 0;
    symbols.push(val);
    sum += val * (i + 1);
  }
  symbols.push(sum % 103); // Modulo 103 checksum
  symbols.push(106); // Stop pattern = 106

  const bars = [];
  let totalModules = 0;
  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym];
    for (let j = 0; j < pattern.length; j++) {
      const w = Number(pattern[j]);
      bars.push(w);
      totalModules += w;
    }
  }
  bars.totalModules = totalModules;
  bars.symbols = symbols;
  bars.value = str;
  return bars;
}

// =============================================================================
// TrueType (.ttf) Binary Font Parser & Minimal Generator
// =============================================================================

export function parseTrueTypeFont(ttfBytes) {
  if (!ttfBytes) return { embedded: false, byteLength: 0 };
  const rawBytes = ttfBytes instanceof Uint8Array
    ? ttfBytes
    : Buffer.isBuffer(ttfBytes)
      ? new Uint8Array(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength)
      : new Uint8Array(ttfBytes);
  if (rawBytes.byteLength < 12) return { embedded: false, byteLength: rawBytes.byteLength };

  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const numTables = view.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    if (o + 16 > rawBytes.byteLength) break;
    const tag = String.fromCharCode(
      view.getUint8(o),
      view.getUint8(o + 1),
      view.getUint8(o + 2),
      view.getUint8(o + 3)
    );
    const offset = view.getUint32(o + 8);
    const length = view.getUint32(o + 12);
    tables[tag] = { offset, length };
  }

  // head
  let unitsPerEm = 1000;
  let bbox = [-200, -200, 1000, 1000];
  if (tables['head'] && tables['head'].offset + 54 <= rawBytes.byteLength) {
    const ho = tables['head'].offset;
    unitsPerEm = view.getUint16(ho + 18) || 1000;
    bbox = [
      view.getInt16(ho + 36),
      view.getInt16(ho + 38),
      view.getInt16(ho + 40),
      view.getInt16(ho + 42),
    ];
  }

  // hhea
  let ascent = 800;
  let descent = -200;
  let numberOfHMetrics = 1;
  if (tables['hhea'] && tables['hhea'].offset + 36 <= rawBytes.byteLength) {
    const hho = tables['hhea'].offset;
    ascent = view.getInt16(hho + 4);
    descent = view.getInt16(hho + 6);
    numberOfHMetrics = view.getUint16(hho + 34) || 1;
  }

  // maxp
  let numGlyphs = 1;
  if (tables['maxp'] && tables['maxp'].offset + 6 <= rawBytes.byteLength) {
    numGlyphs = view.getUint16(tables['maxp'].offset + 4) || 1;
  }

  // OS/2
  let capHeight = Math.round(ascent * 0.88);
  if (tables['OS/2']) {
    const oo = tables['OS/2'].offset;
    const os2Len = tables['OS/2'].length;
    if (os2Len >= 90 && oo + 90 <= rawBytes.byteLength) {
      const ch = view.getInt16(oo + 88);
      if (ch > 0) capHeight = ch;
    }
  }

  // post
  let italicAngle = 0;
  if (tables['post'] && tables['post'].offset + 8 <= rawBytes.byteLength) {
    italicAngle = view.getInt32(tables['post'].offset + 4) / 65536.0;
  }

  // name
  let fontName = 'CustomTTF';
  if (tables['name'] && tables['name'].offset + 6 <= rawBytes.byteLength) {
    const no = tables['name'].offset;
    const count = view.getUint16(no + 2);
    const stringOffset = no + view.getUint16(no + 4);
    for (let i = 0; i < count; i++) {
      const rec = no + 6 + i * 12;
      if (rec + 12 > rawBytes.byteLength) break;
      const platformId = view.getUint16(rec);
      const nameId = view.getUint16(rec + 6);
      const len = view.getUint16(rec + 8);
      const strOff = view.getUint16(rec + 10);
      if (nameId === 6 || (nameId === 4 && fontName === 'CustomTTF')) {
        let str = '';
        const strStart = stringOffset + strOff;
        if (strStart + len <= rawBytes.byteLength) {
          if (platformId === 0 || platformId === 3) {
            for (let j = 0; j + 1 < len; j += 2) {
              str += String.fromCharCode(view.getUint16(strStart + j));
            }
          } else {
            for (let j = 0; j < len; j++) {
              str += String.fromCharCode(view.getUint8(strStart + j));
            }
          }
          const clean = str.replace(/[^A-Za-z0-9_-]/g, '');
          if (clean.length > 0) {
            fontName = clean;
            if (nameId === 6) break;
          }
        }
      }
    }
  }

  // hmtx
  const widths = new Map();
  if (tables['hmtx']) {
    const ho = tables['hmtx'].offset;
    let lastAdv = 0;
    for (let gid = 0; gid < numGlyphs; gid++) {
      let adv;
      if (gid < numberOfHMetrics && ho + gid * 4 + 2 <= rawBytes.byteLength) {
        adv = view.getUint16(ho + gid * 4);
        lastAdv = adv;
      } else {
        adv = lastAdv;
      }
      const w1000 = Math.round((adv / unitsPerEm) * 1000);
      widths.set(gid, w1000);
    }
  }

  // cmap
  const cmap = new Map();
  if (tables['cmap'] && tables['cmap'].offset + 4 <= rawBytes.byteLength) {
    const co = tables['cmap'].offset;
    const numSubtables = view.getUint16(co + 2);
    let f4Offset = 0;
    let f12Offset = 0;
    for (let i = 0; i < numSubtables; i++) {
      const rec = co + 4 + i * 8;
      if (rec + 8 > rawBytes.byteLength) break;
      const subOffset = view.getUint32(rec + 4);
      const subPos = co + subOffset;
      if (subPos + 2 <= rawBytes.byteLength) {
        const fmt = view.getUint16(subPos);
        if (fmt === 4 && !f4Offset) f4Offset = subPos;
        if (fmt === 12 && !f12Offset) f12Offset = subPos;
      }
    }

    if (f12Offset && f12Offset + 16 <= rawBytes.byteLength) {
      const numGroups = view.getUint32(f12Offset + 12);
      for (let g = 0; g < numGroups; g++) {
        const grp = f12Offset + 16 + g * 12;
        if (grp + 12 > rawBytes.byteLength) break;
        const startCharCode = view.getUint32(grp);
        const endCharCode = view.getUint32(grp + 4);
        const startGlyphId = view.getUint32(grp + 8);
        for (let c = startCharCode; c <= endCharCode; c++) {
          cmap.set(c, startGlyphId + (c - startCharCode));
        }
      }
    } else if (f4Offset && f4Offset + 14 <= rawBytes.byteLength) {
      const segCount = Math.floor(view.getUint16(f4Offset + 6) / 2);
      const endCodes = [];
      for (let i = 0; i < segCount; i++) {
        const p = f4Offset + 14 + i * 2;
        if (p + 2 <= rawBytes.byteLength) endCodes.push(view.getUint16(p));
      }
      const scBase = f4Offset + 16 + segCount * 2;
      const startCodes = [];
      for (let i = 0; i < segCount; i++) {
        const p = scBase + i * 2;
        if (p + 2 <= rawBytes.byteLength) startCodes.push(view.getUint16(p));
      }
      const deltaBase = scBase + segCount * 2;
      const idDeltas = [];
      for (let i = 0; i < segCount; i++) {
        const p = deltaBase + i * 2;
        if (p + 2 <= rawBytes.byteLength) idDeltas.push(view.getInt16(p));
      }
      const roBase = deltaBase + segCount * 2;
      const idRangeOffsets = [];
      for (let i = 0; i < segCount; i++) {
        const p = roBase + i * 2;
        if (p + 2 <= rawBytes.byteLength) idRangeOffsets.push(view.getUint16(p));
      }

      for (let i = 0; i < segCount && i < endCodes.length && i < startCodes.length; i++) {
        const start = startCodes[i];
        const end = endCodes[i];
        const delta = idDeltas[i] || 0;
        const ro = idRangeOffsets[i] || 0;
        for (let c = start; c <= end; c++) {
          if (c === 0xFFFF) continue;
          let gid = 0;
          if (ro === 0) {
            gid = (c + delta) & 0xFFFF;
          } else {
            const roAddr = roBase + i * 2 + ro + (c - start) * 2;
            if (roAddr + 2 <= rawBytes.byteLength) {
              gid = view.getUint16(roAddr);
              if (gid !== 0) gid = (gid + delta) & 0xFFFF;
            }
          }
          if (gid !== 0) cmap.set(c, gid);
        }
      }
    }
  }

  return {
    embedded: true,
    byteLength: rawBytes.byteLength,
    fontName,
    unitsPerEm,
    ascent,
    descent,
    bbox,
    capHeight,
    italicAngle,
    stemV: 80,
    numGlyphs,
    numberOfHMetrics,
    cmap,
    widths,
    rawBytes,
    tables,
    measureChar(codePoint, fontSize = 10) {
      const cp = typeof codePoint === 'string' ? codePoint.codePointAt(0) : codePoint;
      const gid = cmap.get(cp) || 0;
      const w1000 = widths.get(gid) ?? 600;
      return (w1000 / 1000) * fontSize;
    },
  };
}

export function buildMinimalTrueTypeFont(options = {}) {
  const fontName = options.fontName || 'VeloxSans';
  const unitsPerEm = options.unitsPerEm || 1000;
  const ascent = options.ascent || 800;
  const descent = options.descent || -200;

  const extraChars = [
    0x00A3, // £
    0x00A5, // ¥
    0x00A9, // ©
    0x00AE, // ®
    0x00B0, // °
    0x00B1, // ±
    0x00D7, // ×
    0x00F7, // ÷
    0x2013, // –
    0x2014, // —
    0x2022, // •
    0x20AC, // €
    0x20B9, // ₹
    0x2122, // ™
    0x2190, // ←
    0x2192, // →
    0x26A1, // ⚡
    0x2713, // ✓
    0x2714, // ✔
    0x2717, // ✗
    0x2718, // ✖
  ];

  const charList = [];
  for (let c = 32; c <= 126; c++) charList.push(c);
  for (const c of extraChars) {
    if (!charList.includes(c)) charList.push(c);
  }
  charList.sort((a, b) => a - b);

  const segments = [];
  let curStart = charList[0];
  let curEnd = charList[0];
  for (let i = 1; i < charList.length; i++) {
    if (charList[i] === curEnd + 1) {
      curEnd = charList[i];
    } else {
      segments.push({ start: curStart, end: curEnd });
      curStart = charList[i];
      curEnd = charList[i];
    }
  }
  segments.push({ start: curStart, end: curEnd });
  segments.push({ start: 0xFFFF, end: 0xFFFF });

  let nextGid = 1;
  const glyphCount = 1 + charList.length;

  const segCount = segments.length;
  const segCountX2 = segCount * 2;
  const idDeltas = [];
  const idRangeOffsets = [];

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    if (seg.start === 0xFFFF) {
      idDeltas.push(1);
      idRangeOffsets.push(0);
    } else {
      const segLen = seg.end - seg.start + 1;
      const gidStart = nextGid;
      nextGid += segLen;
      const rawDelta = (gidStart - seg.start) & 0xFFFF;
      const signedDelta = (rawDelta << 16) >> 16;
      idDeltas.push(signedDelta);
      idRangeOffsets.push(0);
    }
  }

  const cmapSub4 = Buffer.alloc(16 + segCount * 8);
  cmapSub4.writeUInt16BE(4, 0);
  cmapSub4.writeUInt16BE(cmapSub4.length, 2);
  cmapSub4.writeUInt16BE(0, 4);
  cmapSub4.writeUInt16BE(segCountX2, 6);
  const entrySelector = Math.floor(Math.log2(segCount));
  const searchRange = 2 * (1 << entrySelector);
  const rangeShift = segCountX2 - searchRange;
  cmapSub4.writeUInt16BE(searchRange, 8);
  cmapSub4.writeUInt16BE(entrySelector, 10);
  cmapSub4.writeUInt16BE(rangeShift, 12);

  for (let i = 0; i < segCount; i++) {
    cmapSub4.writeUInt16BE(segments[i].end, 14 + i * 2);
  }
  cmapSub4.writeUInt16BE(0, 14 + segCount * 2);
  const scBase = 16 + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    cmapSub4.writeUInt16BE(segments[i].start, scBase + i * 2);
  }
  const deltaBase = scBase + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    cmapSub4.writeInt16BE(idDeltas[i], deltaBase + i * 2);
  }
  const roBase = deltaBase + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    cmapSub4.writeUInt16BE(idRangeOffsets[i], roBase + i * 2);
  }

  const cmapHeader = Buffer.alloc(12);
  cmapHeader.writeUInt16BE(0, 0);
  cmapHeader.writeUInt16BE(1, 2);
  cmapHeader.writeUInt16BE(0, 4);
  cmapHeader.writeUInt16BE(3, 6);
  cmapHeader.writeUInt32BE(12, 8);
  const cmapTable = Buffer.concat([cmapHeader, cmapSub4]);

  const tables = {};
  tables['cmap'] = cmapTable;

  const head = Buffer.alloc(54);
  head.writeUInt16BE(1, 0);
  head.writeUInt16BE(0, 2);
  head.writeUInt32BE(0x5F0F3CF5, 12);
  head.writeUInt16BE(0x0001, 16);
  head.writeUInt16BE(unitsPerEm, 18);
  head.writeInt16BE(0, 36);
  head.writeInt16BE(descent, 38);
  head.writeInt16BE(unitsPerEm, 40);
  head.writeInt16BE(ascent, 42);
  head.writeInt16BE(0, 50);
  tables['head'] = head;

  const hhea = Buffer.alloc(36);
  hhea.writeUInt16BE(1, 0);
  hhea.writeInt16BE(ascent, 4);
  hhea.writeInt16BE(descent, 6);
  hhea.writeUInt16BE(unitsPerEm, 10);
  hhea.writeUInt16BE(glyphCount, 34);
  tables['hhea'] = hhea;

  const maxp = Buffer.alloc(32);
  maxp.writeUInt32BE(0x00010000, 0);
  maxp.writeUInt16BE(glyphCount, 4);
  tables['maxp'] = maxp;

  const os2 = Buffer.alloc(96);
  os2.writeUInt16BE(4, 0);
  os2.writeInt16BE(600, 2);
  os2.writeUInt16BE(400, 4);
  os2.writeUInt16BE(5, 6);
  os2.writeInt16BE(ascent, 68);
  os2.writeInt16BE(descent, 70);
  os2.writeUInt16BE(ascent, 74);
  os2.writeUInt16BE(-descent, 76);
  os2.writeInt16BE(Math.round(ascent * 0.88), 88);
  tables['OS/2'] = os2;

  const hmtx = Buffer.alloc(glyphCount * 4);
  for (let g = 0; g < glyphCount; g++) {
    const w = g === 1 ? 300 : 600;
    hmtx.writeUInt16BE(w, g * 4);
    hmtx.writeInt16BE(0, g * 4 + 2);
  }
  tables['hmtx'] = hmtx;

  tables['loca'] = Buffer.alloc((glyphCount + 1) * 2);
  tables['glyf'] = Buffer.alloc(4);

  const post = Buffer.alloc(32);
  post.writeUInt32BE(0x00030000, 0);
  tables['post'] = post;

  const psNameBuf = Buffer.from(fontName, 'ascii');
  const nameHeader = Buffer.alloc(6 + 12);
  nameHeader.writeUInt16BE(0, 0);
  nameHeader.writeUInt16BE(1, 2);
  nameHeader.writeUInt16BE(18, 4);
  nameHeader.writeUInt16BE(1, 6);
  nameHeader.writeUInt16BE(0, 8);
  nameHeader.writeUInt16BE(0, 10);
  nameHeader.writeUInt16BE(6, 12);
  nameHeader.writeUInt16BE(psNameBuf.length, 14);
  nameHeader.writeUInt16BE(0, 16);
  tables['name'] = Buffer.concat([nameHeader, psNameBuf]);

  const tags = Object.keys(tables).sort();
  const numTables = tags.length;
  const offsetTable = Buffer.alloc(12 + numTables * 16);
  offsetTable.writeUInt32BE(0x00010000, 0);
  offsetTable.writeUInt16BE(numTables, 4);

  let currentOffset = 12 + numTables * 16;
  const tableDataBuffers = [];
  tags.forEach((tag, idx) => {
    let tbuf = tables[tag];
    const pad = (4 - (tbuf.length % 4)) % 4;
    if (pad > 0) {
      tbuf = Buffer.concat([tbuf, Buffer.alloc(pad)]);
    }
    const recOffset = 12 + idx * 16;
    offsetTable.write(tag, recOffset, 4, 'ascii');
    let csum = 0;
    for (let i = 0; i < tbuf.length; i += 4) {
      csum = (csum + tbuf.readUInt32BE(i)) >>> 0;
    }
    offsetTable.writeUInt32BE(csum, recOffset + 4);
    offsetTable.writeUInt32BE(currentOffset, recOffset + 8);
    offsetTable.writeUInt32BE(tables[tag].length, recOffset + 12);
    tableDataBuffers.push(tbuf);
    currentOffset += tbuf.length;
  });

  return new Uint8Array(Buffer.concat([offsetTable, ...tableDataBuffers]));
}

export function generateToUnicodeCMap(cmapMap, fontName = 'VeloxSans') {
  const gidToCode = new Map();
  for (const [cp, gid] of (cmapMap || new Map()).entries()) {
    if (!gidToCode.has(gid)) {
      gidToCode.set(gid, cp);
    }
  }

  const entries = [];
  for (const [gid, cp] of gidToCode.entries()) {
    const gidHex = gid.toString(16).padStart(4, '0').toUpperCase();
    let uHex;
    if (cp <= 0xFFFF) {
      uHex = cp.toString(16).padStart(4, '0').toUpperCase();
    } else {
      const h = Math.floor((cp - 0x10000) / 0x400) + 0xD800;
      const l = ((cp - 0x10000) % 0x400) + 0xDC00;
      uHex = h.toString(16).padStart(4, '0').toUpperCase() + l.toString(16).padStart(4, '0').toUpperCase();
    }
    entries.push(`<${gidHex}> <${uHex}>`);
  }

  const chunks = [];
  chunks.push(
    '/CIDInit /ProcSet findresource begin\n' +
    '12 dict begin\n' +
    'begincmap\n' +
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
    `/CMapName /${fontName}-ToUnicode def\n` +
    '/CMapType 2 def\n' +
    '1 begincodespacerange\n' +
    '<0000> <FFFF>\n' +
    'endcodespacerange\n'
  );

  const BLOCK_SIZE = 100;
  for (let i = 0; i < entries.length; i += BLOCK_SIZE) {
    const slice = entries.slice(i, i + BLOCK_SIZE);
    chunks.push(`${slice.length} beginbfchar\n`);
    chunks.push(slice.join('\n') + '\n');
    chunks.push('endbfchar\n');
  }

  chunks.push(
    'endcmap\n' +
    'CMapName currentdict /CMap defineresource pop\n' +
    'end\n' +
    'end\n'
  );

  return chunks.join('');
}

export function extractEmbeddedData(pdfBytes) {
  if (!pdfBytes || pdfBytes.length === 0) return null;
  const buf = Buffer.isBuffer(pdfBytes)
    ? pdfBytes
    : Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);

  let streamIdx = -1;
  const needle = Buffer.from('/Subtype /application#2Fjson');
  const idx = buf.indexOf(needle);
  if (idx !== -1) {
    streamIdx = buf.indexOf(Buffer.from('stream'), idx);
  }

  if (streamIdx === -1) {
    const efNeedle = Buffer.from('/Type /EmbeddedFile');
    const efIdx = buf.indexOf(efNeedle);
    if (efIdx !== -1) {
      streamIdx = buf.indexOf(Buffer.from('stream'), efIdx);
    }
  }

  if (streamIdx === -1) {
    const nameNeedle = Buffer.from('velox-payload.json');
    const nameIdx = buf.indexOf(nameNeedle);
    if (nameIdx !== -1) {
      streamIdx = buf.indexOf(Buffer.from('stream'), nameIdx);
    }
  }

  if (streamIdx === -1) return null;

  let dataStart = streamIdx + 6;
  if (buf[dataStart] === 0x0D && buf[dataStart + 1] === 0x0A) {
    dataStart += 2;
  } else if (buf[dataStart] === 0x0A) {
    dataStart += 1;
  }

  const endStreamTag = Buffer.from('endstream');
  const dataEnd = buf.indexOf(endStreamTag, dataStart);
  if (dataEnd === -1 || dataEnd <= dataStart) return null;

  const rawStream = buf.subarray(dataStart, dataEnd);

  let decompressed;
  try {
    decompressed = zlib.inflateSync(rawStream);
  } catch {
    decompressed = rawStream;
  }

  try {
    const jsonStr = decompressed.toString('utf8').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// =============================================================================
// Rounded Rectangle Path Generator with per-corner radii [tl, tr, br, bl]
// =============================================================================
export function roundedRectPath(x, y, w, h, rOrRadii) {
  let rtl = 0, rtr = 0, rbr = 0, rbl = 0;
  if (Array.isArray(rOrRadii)) {
    rtl = Number(rOrRadii[0]) || 0;
    rtr = Number(rOrRadii[1]) || 0;
    rbr = Number(rOrRadii[2]) || 0;
    rbl = Number(rOrRadii[3]) || 0;
  } else if (typeof rOrRadii === 'number' && rOrRadii > 0) {
    rtl = rtr = rbr = rbl = rOrRadii;
  }

  if (rtl <= 0 && rtr <= 0 && rbr <= 0 && rbl <= 0) {
    return `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`;
  }

  const maxR = Math.min(w / 2, h / 2);
  rtl = Math.min(rtl, maxR);
  rtr = Math.min(rtr, maxR);
  rbr = Math.min(rbr, maxR);
  rbl = Math.min(rbl, maxR);

  const k_tl = 0.55228475 * rtl;
  const k_tr = 0.55228475 * rtr;
  const k_br = 0.55228475 * rbr;
  const k_bl = 0.55228475 * rbl;

  const x0 = x, y0 = y, x1 = x + w, y1 = y + h;
  const ops = [];
  ops.push(`${(x0 + rbl).toFixed(2)} ${y0.toFixed(2)} m`);
  ops.push(`${(x1 - rbr).toFixed(2)} ${y0.toFixed(2)} l`);
  if (rbr > 0) {
    ops.push(`${(x1 - rbr + k_br).toFixed(2)} ${y0.toFixed(2)} ${x1.toFixed(2)} ${(y0 + rbr - k_br).toFixed(2)} ${x1.toFixed(2)} ${(y0 + rbr).toFixed(2)} c`);
  }
  ops.push(`${x1.toFixed(2)} ${(y1 - rtr).toFixed(2)} l`);
  if (rtr > 0) {
    ops.push(`${x1.toFixed(2)} ${(y1 - rtr + k_tr).toFixed(2)} ${(x1 - rtr + k_tr).toFixed(2)} ${y1.toFixed(2)} ${(x1 - rtr).toFixed(2)} ${y1.toFixed(2)} c`);
  }
  ops.push(`${(x0 + rtl).toFixed(2)} ${y1.toFixed(2)} l`);
  if (rtl > 0) {
    ops.push(`${(x0 + rtl - k_tl).toFixed(2)} ${y1.toFixed(2)} ${x0.toFixed(2)} ${(y1 - rtl + k_tl).toFixed(2)} ${x0.toFixed(2)} ${(y1 - rtl).toFixed(2)} c`);
  }
  ops.push(`${x0.toFixed(2)} ${(y0 + rbl).toFixed(2)} l`);
  if (rbl > 0) {
    ops.push(`${x0.toFixed(2)} ${(y0 + rbl - k_bl).toFixed(2)} ${(x0 + rbl - k_bl).toFixed(2)} ${y0.toFixed(2)} ${(x0 + rbl).toFixed(2)} ${y0.toFixed(2)} c`);
  }
  ops.push('h');
  return ops.join(' ');
}

// =============================================================================
// SVG Path 'd' Parser & Vector Shape Compiler
// =============================================================================
function tokenizeSvgPath(d) {
  const tokens = [];
  const re = /([a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  let match;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

/**
 * Multiplies two 2D affine 3x3 transformation matrices [a, b, c, d, e, f].
 */
export function multiplySvgTransforms(m1, m2) {
  if (!m1) return m2;
  if (!m2) return m1;
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Parses SVG transform string into a 6-element affine matrix [a, b, c, d, e, f].
 * Supports translate(tx, ty), scale(sx, sy), rotate(deg, [cx, cy]), matrix(...), skewX, skewY.
 */
export function parseSvgTransform(transformStr) {
  if (!transformStr) return null;
  if (Array.isArray(transformStr) && transformStr.length === 6) {
    return transformStr;
  }
  if (typeof transformStr === 'object') {
    if (typeof transformStr.a === 'number') {
      return [
        transformStr.a, transformStr.b ?? 0,
        transformStr.c ?? 0, transformStr.d ?? 1,
        transformStr.e ?? 0, transformStr.f ?? 0,
      ];
    }
  }

  const str = String(transformStr).trim();
  if (!str) return null;

  let currentMat = [1, 0, 0, 1, 0, 0];
  const regex = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match;
  let hasMatch = false;

  while ((match = regex.exec(str)) !== null) {
    hasMatch = true;
    const type = match[1].toLowerCase();
    const args = match[2].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    let m = [1, 0, 0, 1, 0, 0];

    if (type === 'translate') {
      const tx = args[0] || 0;
      const ty = args[1] || 0;
      m = [1, 0, 0, 1, tx, ty];
    } else if (type === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      m = [sx, 0, 0, sy, 0, 0];
    } else if (type === 'rotate') {
      const deg = args[0] || 0;
      const rad = (deg * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      if (args.length >= 3) {
        const cx = args[1];
        const cy = args[2];
        const t1 = [1, 0, 0, 1, cx, cy];
        const rot = [cosR, sinR, -sinR, cosR, 0, 0];
        const t2 = [1, 0, 0, 1, -cx, -cy];
        m = multiplySvgTransforms(multiplySvgTransforms(t1, rot), t2);
      } else {
        m = [cosR, sinR, -sinR, cosR, 0, 0];
      }
    } else if (type === 'matrix' && args.length >= 6) {
      m = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (type === 'skewx') {
      const rad = ((args[0] || 0) * Math.PI) / 180;
      m = [1, 0, Math.tan(rad), 1, 0, 0];
    } else if (type === 'skewy') {
      const rad = ((args[0] || 0) * Math.PI) / 180;
      m = [1, Math.tan(rad), 0, 1, 0, 0];
    }
    currentMat = multiplySvgTransforms(currentMat, m);
  }

  return hasMatch ? currentMat : null;
}

/**
 * Standard W3C SVG 1.1 Appendix F.6 endpoint-to-center parameterization.
 * Converts an SVG elliptical arc segment into 1 or more cubic Bézier curves (each <= 90 deg).
 *
 * @param {number} x1 - start point x
 * @param {number} y1 - start point y
 * @param {number} rx - ellipse radius x
 * @param {number} ry - ellipse radius y
 * @param {number} angleDeg - x-axis rotation in degrees
 * @param {number|boolean} largeArcFlag - large arc flag (0 or 1)
 * @param {number|boolean} sweepFlag - sweep flag (0 or 1)
 * @param {number} x2 - endpoint x
 * @param {number} y2 - endpoint y
 * @returns {Array<{cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number}>}
 */
export function arcToCubicBeziers(x1, y1, rx, ry, angleDeg, largeArcFlag, sweepFlag, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];

  let absRx = Math.abs(rx);
  let absRy = Math.abs(ry);
  if (absRx === 0 || absRy === 0) {
    const seg = [
      x1 + (x2 - x1) / 3,
      y1 + (y2 - y1) / 3,
      x1 + (2 * (x2 - x1)) / 3,
      y1 + (2 * (y2 - y1)) / 3,
      x2,
      y2,
    ];
    seg.cp1x = seg[0]; seg.cp1y = seg[1];
    seg.cp2x = seg[2]; seg.cp2y = seg[3];
    seg.x1 = seg[0]; seg.y1 = seg[1];
    seg.x2 = seg[2]; seg.y2 = seg[3];
    seg.x = x2; seg.y = y2;
    return [seg];
  }

  const phi = ((angleDeg || 0) * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: Ensure radii are large enough
  const lambda = (x1p * x1p) / (absRx * absRx) + (y1p * y1p) / (absRy * absRy);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    absRx *= scale;
    absRy *= scale;
  }

  // Step 3: Compute center (cx', cy')
  const rxSq = absRx * absRx;
  const rySq = absRy * absRy;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const denom = rxSq * y1pSq + rySq * x1pSq;
  let numer = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  if (numer < 0) numer = 0;

  const fA = Boolean(largeArcFlag);
  const fS = Boolean(sweepFlag);
  let factor = denom > 0 ? Math.sqrt(numer / denom) : 0;
  if (fA === fS) factor = -factor;

  const cxp = factor * ((absRx * y1p) / absRy);
  const cyp = factor * ((-absRy * x1p) / absRx);

  // Step 4: Compute center (cx, cy) in original coordinate space
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 5: Compute start angle theta1 and angular extent deltaTheta
  const vx1 = (x1p - cxp) / absRx;
  const vy1 = (y1p - cyp) / absRy;
  const vx2 = (-x1p - cxp) / absRx;
  const vy2 = (-y1p - cyp) / absRy;

  const theta1 = Math.atan2(vy1, vx1);

  const dot = vx1 * vx2 + vy1 * vy2;
  const cross = vx1 * vy2 - vy1 * vx2;
  let deltaTheta = Math.atan2(cross, dot);

  if (!fS && deltaTheta > 0) {
    deltaTheta -= 2 * Math.PI;
  } else if (fS && deltaTheta < 0) {
    deltaTheta += 2 * Math.PI;
  }

  // Step 6: Split arc into segments <= 90 deg (PI / 2)
  const numSegments = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2)));
  const dTheta = deltaTheta / numSegments;
  const kappa = (4 / 3) * Math.tan(dTheta / 4);

  const segments = [];
  for (let segIdx = 0; segIdx < numSegments; segIdx++) {
    const startAngle = theta1 + segIdx * dTheta;
    const endAngle = theta1 + (segIdx + 1) * dTheta;

    const cosStart = Math.cos(startAngle);
    const sinStart = Math.sin(startAngle);
    const cosEnd = Math.cos(endAngle);
    const sinEnd = Math.sin(endAngle);

    const p0x = absRx * cosStart;
    const p0y = absRy * sinStart;
    const p3x = absRx * cosEnd;
    const p3y = absRy * sinEnd;

    const d0x = -absRx * sinStart;
    const d0y = absRy * cosStart;
    const d3x = -absRx * sinEnd;
    const d3y = absRy * cosEnd;

    const cp1xp = p0x + kappa * d0x;
    const cp1yp = p0y + kappa * d0y;
    const cp2xp = p3x - kappa * d3x;
    const cp2yp = p3y - kappa * d3y;

    const mapPoint = (xp, yp) => [
      cosPhi * xp - sinPhi * yp + cx,
      sinPhi * xp + cosPhi * yp + cy,
    ];

    const [cp1x, cp1y] = mapPoint(cp1xp, cp1yp);
    const [cp2x, cp2y] = mapPoint(cp2xp, cp2yp);

    let endX, endY;
    if (segIdx === numSegments - 1) {
      endX = x2;
      endY = y2;
    } else {
      [endX, endY] = mapPoint(p3x, p3y);
    }

    const seg = [cp1x, cp1y, cp2x, cp2y, endX, endY];
    seg.cp1x = cp1x; seg.cp1y = cp1y;
    seg.cp2x = cp2x; seg.cp2y = cp2y;
    seg.x1 = cp1x; seg.y1 = cp1y;
    seg.x2 = cp2x; seg.y2 = cp2y;
    seg.x = endX; seg.y = endY;
    segments.push(seg);
  }

  return segments;
}

export function parseSvgPath(d, transformPtOrScaleX, scaleY, offsetX, offsetY, pdfH) {
  let transformPt;
  if (typeof transformPtOrScaleX === 'function') {
    transformPt = transformPtOrScaleX;
  } else if (typeof transformPtOrScaleX === 'number' && typeof scaleY === 'number') {
    const sX = transformPtOrScaleX;
    const sY = scaleY;
    const offX = typeof offsetX === 'number' ? offsetX : 0;
    const offY = typeof offsetY === 'number' ? offsetY : 0;
    const pH = typeof pdfH === 'number' ? pdfH : 0;
    transformPt = (x, y) => {
      const px = offX + x * sX;
      const py = pH > 0 ? (pH - offY - y * sY) : (offY + y * sY);
      return [px, py];
    };
  } else {
    transformPt = (x, y) => [x, y];
  }

  const tokens = tokenizeSvgPath(d);
  let i = 0;
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;
  let lastControlX = 0, lastControlY = 0;
  let lastCmd = '';
  const pdfOps = [];

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (/^[a-df-z]$/i.test(cmd)) {
      i++;
    } else {
      cmd = lastCmd;
      if (cmd === 'M') cmd = 'L';
      else if (cmd === 'm') cmd = 'l';
    }

    const nextNum = () => {
      if (i >= tokens.length || /^[a-df-z]$/i.test(tokens[i])) return 0;
      return parseFloat(tokens[i++]);
    };

    const nextFlag = () => {
      if (i >= tokens.length || /^[a-df-z]$/i.test(tokens[i])) return 0;
      const tok = tokens[i];
      if (typeof tok === 'string' && tok.length > 1 && (tok[0] === '0' || tok[0] === '1') && !tok.includes('.')) {
        const val = parseInt(tok[0], 10);
        tokens[i] = tok.slice(1);
        return val;
      }
      return parseFloat(tokens[i++]);
    };

    switch (cmd) {
      case 'M': {
        const x = nextNum(), y = nextNum();
        curX = x; curY = y;
        startX = x; startY = y;
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} m`);
        lastCmd = 'M';
        break;
      }
      case 'm': {
        const dx = nextNum(), dy = nextNum();
        curX += dx; curY += dy;
        startX = curX; startY = curY;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} m`);
        lastCmd = 'm';
        break;
      }
      case 'L': {
        const x = nextNum(), y = nextNum();
        curX = x; curY = y;
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'L';
        break;
      }
      case 'l': {
        const dx = nextNum(), dy = nextNum();
        curX += dx; curY += dy;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'l';
        break;
      }
      case 'H': {
        const x = nextNum();
        curX = x;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'H';
        break;
      }
      case 'h': {
        const dx = nextNum();
        curX += dx;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'h';
        break;
      }
      case 'V': {
        const y = nextNum();
        curY = y;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'V';
        break;
      }
      case 'v': {
        const dy = nextNum();
        curY += dy;
        const [px, py] = transformPt(curX, curY);
        pdfOps.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
        lastCmd = 'v';
        break;
      }
      case 'C': {
        const x1 = nextNum(), y1 = nextNum();
        const x2 = nextNum(), y2 = nextNum();
        const x = nextNum(), y = nextNum();
        lastControlX = x2; lastControlY = y2;
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(x1, y1);
        const [p2x, p2y] = transformPt(x2, y2);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 'C';
        break;
      }
      case 'c': {
        const dx1 = nextNum(), dy1 = nextNum();
        const dx2 = nextNum(), dy2 = nextNum();
        const dx = nextNum(), dy = nextNum();
        const x1 = curX + dx1, y1 = curY + dy1;
        const x2 = curX + dx2, y2 = curY + dy2;
        const x = curX + dx, y = curY + dy;
        lastControlX = x2; lastControlY = y2;
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(x1, y1);
        const [p2x, p2y] = transformPt(x2, y2);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 'c';
        break;
      }
      case 'S': {
        let x1 = curX, y1 = curY;
        if (lastCmd === 'C' || lastCmd === 'c' || lastCmd === 'S' || lastCmd === 's') {
          x1 = 2 * curX - lastControlX;
          y1 = 2 * curY - lastControlY;
        }
        const x2 = nextNum(), y2 = nextNum();
        const x = nextNum(), y = nextNum();
        lastControlX = x2; lastControlY = y2;
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(x1, y1);
        const [p2x, p2y] = transformPt(x2, y2);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 'S';
        break;
      }
      case 's': {
        let x1 = curX, y1 = curY;
        if (lastCmd === 'C' || lastCmd === 'c' || lastCmd === 'S' || lastCmd === 's') {
          x1 = 2 * curX - lastControlX;
          y1 = 2 * curY - lastControlY;
        }
        const dx2 = nextNum(), dy2 = nextNum();
        const dx = nextNum(), dy = nextNum();
        const x2 = curX + dx2, y2 = curY + dy2;
        const x = curX + dx, y = curY + dy;
        lastControlX = x2; lastControlY = y2;
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(x1, y1);
        const [p2x, p2y] = transformPt(x2, y2);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 's';
        break;
      }
      case 'Q': {
        const qx1 = nextNum(), qy1 = nextNum();
        const x = nextNum(), y = nextNum();
        lastControlX = qx1; lastControlY = qy1;
        // Degree elevation from quadratic to cubic bezier:
        // cp1 = start + 2/3 * (ctrl - start), cp2 = end + 2/3 * (ctrl - end)
        const cp1x = curX + (2 / 3) * (qx1 - curX);
        const cp1y = curY + (2 / 3) * (qy1 - curY);
        const cp2x = x + (2 / 3) * (qx1 - x);
        const cp2y = y + (2 / 3) * (qy1 - y);
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(cp1x, cp1y);
        const [p2x, p2y] = transformPt(cp2x, cp2y);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 'Q';
        break;
      }
      case 'q': {
        const dqx1 = nextNum(), dqy1 = nextNum();
        const dx = nextNum(), dy = nextNum();
        const qx1 = curX + dqx1, qy1 = curY + dqy1;
        const x = curX + dx, y = curY + dy;
        lastControlX = qx1; lastControlY = qy1;
        const cp1x = curX + (2 / 3) * (qx1 - curX);
        const cp1y = curY + (2 / 3) * (qy1 - curY);
        const cp2x = x + (2 / 3) * (qx1 - x);
        const cp2y = y + (2 / 3) * (qy1 - y);
        curX = x; curY = y;
        const [p1x, p1y] = transformPt(cp1x, cp1y);
        const [p2x, p2y] = transformPt(cp2x, cp2y);
        const [px, py] = transformPt(x, y);
        pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
        lastCmd = 'q';
        break;
      }
      case 'A': {
        const rx = nextNum();
        const ry = nextNum();
        const rot = nextNum();
        const fA = nextFlag();
        const fS = nextFlag();
        const x = nextNum();
        const y = nextNum();
        const beziers = arcToCubicBeziers(curX, curY, rx, ry, rot, fA, fS, x, y);
        for (const b of beziers) {
          const [p1x, p1y] = transformPt(b.cp1x, b.cp1y);
          const [p2x, p2y] = transformPt(b.cp2x, b.cp2y);
          const [px, py] = transformPt(b.x, b.y);
          pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
          lastControlX = b.cp2x;
          lastControlY = b.cp2y;
          curX = b.x;
          curY = b.y;
        }
        if (beziers.length === 0) {
          curX = x;
          curY = y;
        }
        lastCmd = 'A';
        break;
      }
      case 'a': {
        const rx = nextNum();
        const ry = nextNum();
        const rot = nextNum();
        const fA = nextFlag();
        const fS = nextFlag();
        const dx = nextNum();
        const dy = nextNum();
        const x = curX + dx;
        const y = curY + dy;
        const beziers = arcToCubicBeziers(curX, curY, rx, ry, rot, fA, fS, x, y);
        for (const b of beziers) {
          const [p1x, p1y] = transformPt(b.cp1x, b.cp1y);
          const [p2x, p2y] = transformPt(b.cp2x, b.cp2y);
          const [px, py] = transformPt(b.x, b.y);
          pdfOps.push(`${p1x.toFixed(2)} ${p1y.toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
          lastControlX = b.cp2x;
          lastControlY = b.cp2y;
          curX = b.x;
          curY = b.y;
        }
        if (beziers.length === 0) {
          curX = x;
          curY = y;
        }
        lastCmd = 'a';
        break;
      }
      case 'Z':
      case 'z': {
        curX = startX; curY = startY;
        pdfOps.push('h');
        lastCmd = 'Z';
        break;
      }
      default:
        i++;
        break;
    }
  }
  return pdfOps;
}

function circleToPath(cx, cy, r, transformPt) {
  const k = 0.55228475 * r;
  const p0 = transformPt(cx, cy - r);
  const p1 = transformPt(cx + k, cy - r);
  const p2 = transformPt(cx + r, cy - k);
  const p3 = transformPt(cx + r, cy);
  const p4 = transformPt(cx + r, cy + k);
  const p5 = transformPt(cx + k, cy + r);
  const p6 = transformPt(cx, cy + r);
  const p7 = transformPt(cx - k, cy + r);
  const p8 = transformPt(cx - r, cy + k);
  const p9 = transformPt(cx - r, cy);
  const p10 = transformPt(cx - r, cy - k);
  const p11 = transformPt(cx - k, cy - r);
  return [
    `${p0[0].toFixed(2)} ${p0[1].toFixed(2)} m`,
    `${p1[0].toFixed(2)} ${p1[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} c`,
    `${p4[0].toFixed(2)} ${p4[1].toFixed(2)} ${p5[0].toFixed(2)} ${p5[1].toFixed(2)} ${p6[0].toFixed(2)} ${p6[1].toFixed(2)} c`,
    `${p7[0].toFixed(2)} ${p7[1].toFixed(2)} ${p8[0].toFixed(2)} ${p8[1].toFixed(2)} ${p9[0].toFixed(2)} ${p9[1].toFixed(2)} c`,
    `${p10[0].toFixed(2)} ${p10[1].toFixed(2)} ${p11[0].toFixed(2)} ${p11[1].toFixed(2)} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} c`,
    'h',
  ].join(' ');
}

function ellipseToPath(cx, cy, rx, ry, transformPt) {
  const kx = 0.55228475 * rx;
  const ky = 0.55228475 * ry;
  const p0 = transformPt(cx, cy - ry);
  const p1 = transformPt(cx + kx, cy - ry);
  const p2 = transformPt(cx + rx, cy - ky);
  const p3 = transformPt(cx + rx, cy);
  const p4 = transformPt(cx + rx, cy + ky);
  const p5 = transformPt(cx + kx, cy + ry);
  const p6 = transformPt(cx, cy + ry);
  const p7 = transformPt(cx - kx, cy + ry);
  const p8 = transformPt(cx - rx, cy + ky);
  const p9 = transformPt(cx - rx, cy);
  const p10 = transformPt(cx - rx, cy - ky);
  const p11 = transformPt(cx - kx, cy - ry);
  return [
    `${p0[0].toFixed(2)} ${p0[1].toFixed(2)} m`,
    `${p1[0].toFixed(2)} ${p1[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} c`,
    `${p4[0].toFixed(2)} ${p4[1].toFixed(2)} ${p5[0].toFixed(2)} ${p5[1].toFixed(2)} ${p6[0].toFixed(2)} ${p6[1].toFixed(2)} c`,
    `${p7[0].toFixed(2)} ${p7[1].toFixed(2)} ${p8[0].toFixed(2)} ${p8[1].toFixed(2)} ${p9[0].toFixed(2)} ${p9[1].toFixed(2)} c`,
    `${p10[0].toFixed(2)} ${p10[1].toFixed(2)} ${p11[0].toFixed(2)} ${p11[1].toFixed(2)} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} c`,
    'h',
  ].join(' ');
}

function parseSvgPoints(ptsStr) {
  const nums = String(ptsStr || '').trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
      pts.push([nums[i], nums[i + 1]]);
    }
  }
  return pts;
}

// =============================================================================
// Raster Image Decoders (JPEG & PNG with SMask Alpha Separation)
// =============================================================================
function parseJpegDimensions(buf) {
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      const channels = buf[offset + 9];
      return { width, height, channels };
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  return null;
}

function parsePng(buf) {
  let offset = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6;
  const idatChunks = [];
  let plte = null;
  let trns = null;

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') {
      plte = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  let bpp = 3;
  if (colorType === 6) bpp = 4;
  else if (colorType === 2) bpp = 3;
  else if (colorType === 0) bpp = 1;
  else if (colorType === 4) bpp = 2;
  else if (colorType === 3) bpp = 1;

  const stride = width * bpp;
  const rgb = Buffer.alloc(width * height * 3);
  const hasAlpha = colorType === 6 || colorType === 4 || (colorType === 3 && trns !== null);
  const alpha = hasAlpha ? Buffer.alloc(width * height) : null;

  const prevRow = Buffer.alloc(stride);
  const curRow = Buffer.alloc(stride);
  let srcOffset = 0;
  let dstRgb = 0;
  let dstAlpha = 0;

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOffset++];
    for (let i = 0; i < stride; i++) {
      const x = decompressed[srcOffset++];
      const a = i >= bpp ? curRow[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;

      let val = 0;
      if (filter === 0) val = x;
      else if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (x + pr) & 0xff;
      }
      curRow[i] = val;
    }
    prevRow.set(curRow);

    if (colorType === 6) { // RGBA
      for (let x = 0; x < width; x++) {
        const idx = x * 4;
        rgb[dstRgb++] = curRow[idx];
        rgb[dstRgb++] = curRow[idx + 1];
        rgb[dstRgb++] = curRow[idx + 2];
        if (alpha) alpha[dstAlpha++] = curRow[idx + 3];
      }
    } else if (colorType === 2) { // RGB
      for (let x = 0; x < width; x++) {
        const idx = x * 3;
        rgb[dstRgb++] = curRow[idx];
        rgb[dstRgb++] = curRow[idx + 1];
        rgb[dstRgb++] = curRow[idx + 2];
      }
    } else if (colorType === 0) { // Grayscale
      for (let x = 0; x < width; x++) {
        const g = curRow[x];
        rgb[dstRgb++] = g;
        rgb[dstRgb++] = g;
        rgb[dstRgb++] = g;
      }
    } else if (colorType === 4) { // Grayscale + Alpha
      for (let x = 0; x < width; x++) {
        const g = curRow[x * 2];
        rgb[dstRgb++] = g;
        rgb[dstRgb++] = g;
        rgb[dstRgb++] = g;
        if (alpha) alpha[dstAlpha++] = curRow[x * 2 + 1];
      }
    } else if (colorType === 3 && plte) { // Indexed
      for (let x = 0; x < width; x++) {
        const pIdx = curRow[x];
        rgb[dstRgb++] = plte[pIdx * 3] || 0;
        rgb[dstRgb++] = plte[pIdx * 3 + 1] || 0;
        rgb[dstRgb++] = plte[pIdx * 3 + 2] || 0;
        if (alpha) alpha[dstAlpha++] = trns ? (trns[pIdx] ?? 255) : 255;
      }
    }
  }

  return { width, height, rgb, alpha };
}

function resolveFontRef(item) {
  if (item.fontRef) return item.fontRef;
  const fam = String(item.fontFamily || '').toLowerCase();
  const weight = String(item.fontWeight || '').toLowerCase();
  const style = String(item.fontStyle || '').toLowerCase();
  const isBold = weight === 'bold' || weight === '700' || weight === '800' || weight === '900';
  const isItalic = style === 'italic' || style === 'oblique';

  if (fam.includes('times') || fam.includes('serif')) {
    if (isBold) return '/F6'; // Times-Bold
    if (isItalic) return '/F7'; // Times-Italic
    return '/F5'; // Times-Roman
  }
  if (fam.includes('courier') || fam.includes('mono')) {
    if (isBold) return '/F8'; // Courier-Bold
    return '/F3'; // Courier
  }
  if (isBold) return '/F2'; // Helvetica-Bold
  if (isItalic) return '/F4'; // Helvetica-Oblique
  return '/F1'; // Helvetica
}

// =============================================================================
// PDF/A-3b support (only active with options.pdfa = '3b'; default output is untouched)
// =============================================================================
//
// Options read by compilePagesToPdf when pdfa is on:
// - `pdfa: '3b'`        turn the mode on (true is accepted as '3b')
// - `title`             dc:title and Info /Title (index.mjs fills it from <title> when absent)
// - `author`            dc:creator and Info /Author (default 'VeloxPDF')
// - `creationDate`      Date or ISO string for CreateDate/ModifyDate/MetadataDate (default now);
//                        a fixed date makes the output byte-reproducible
// - `extraXmp`          string or array of strings, each a complete raw
//                        `<rdf:Description rdf:about="" xmlns:...>...</rdf:Description>` block,
//                        inserted verbatim inside rdf:RDF. This is the hook for Factur-X / ZUGFeRD:
//                        the e-invoice module passes its `fx:` Description plus the
//                        `pdfaExtension:schemas` Description that declares the fx schema.
//
// Fonts: the base-14 families are replaced by the metric-compatible Liberation fonts
// (Helvetica -> Liberation Sans, Times -> Liberation Serif, Courier -> Liberation Mono),
// subset and embedded as Type0 / CIDFontType2 (Identity-H, CIDToGIDMap Identity) with a
// ToUnicode CMap. In Node the TTF files load from ../fonts next to this module. In the browser
// (or any runtime without node:fs) call registerFontData(fileName, bytes) for each file in
// PDFA_FONT_FILES before rendering with pdfa on, or pass options.pdfaFonts = { [fileName]: bytes }.
// Without either, pdfa rendering throws an Error naming the missing file and both fixes.

const PDFA_FONT_MAP = {
  '/F1': { file: 'LiberationSans-Regular.ttf', flags: 32 },
  '/F2': { file: 'LiberationSans-Bold.ttf', flags: 32 },
  '/F3': { file: 'LiberationMono-Regular.ttf', flags: 32 | 1 },
  '/F4': { file: 'LiberationSans-Italic.ttf', flags: 32 | 64 },
  '/F5': { file: 'LiberationSerif-Regular.ttf', flags: 32 | 2 },
  '/F6': { file: 'LiberationSerif-Bold.ttf', flags: 32 | 2 },
  '/F7': { file: 'LiberationSerif-Italic.ttf', flags: 32 | 2 | 64 },
  '/F8': { file: 'LiberationMono-Bold.ttf', flags: 32 | 1 },
};
export const PDFA_FONT_FILES = [...new Set(Object.values(PDFA_FONT_MAP).map((f) => f.file)), 'LiberationSans-BoldItalic.ttf'];

// sRGB v2 "micro" ICC profile (456 bytes, CC0), from github.com/saucecontrol/Compact-ICC-Profiles.
// Source file: assets/sRGB-v2-micro.icc (see assets/README.md).
const SRGB_ICC_BASE64 =
  'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//';

const registeredFontData = new Map();
/** Supplies font bytes for runtimes without node:fs (browser bundle). name = file name, e.g. 'LiberationSans-Regular.ttf'. */
export function registerFontData(name, bytes) {
  registeredFontData.set(String(name), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

const parsedPdfaFonts = new Map();
// Only reached when options.pdfa is set; non-pdfa rendering never calls this.
// Lookup order: options.pdfaFonts[file], registerFontData(file, ...), then ../fonts/<file> via node:fs.
function loadPdfaFont(file, perCallFonts) {
  const perCall = perCallFonts && perCallFonts[file];
  if (perCall) return parseTrueTypeFont(perCall instanceof Uint8Array ? perCall : new Uint8Array(perCall));
  if (parsedPdfaFonts.has(file)) return parsedPdfaFonts.get(file);
  let bytes = registeredFontData.get(file) || null;
  if (!bytes) {
    try {
      const fsMod = globalThis.process?.getBuiltinModule?.('node:fs');
      if (fsMod) bytes = new Uint8Array(fsMod.readFileSync(new URL(`../fonts/${file}`, import.meta.url)));
    } catch {
      bytes = null;
    }
  }
  if (!bytes) {
    throw new Error(
      `VeloxPDF pdfa: font ${file} could not be loaded from disk and was not registered. ` +
      `Before rendering with pdfa: '3b', call registerFontData('${file}', bytes) ` +
      `(or pass options.pdfaFonts = { '${file}': bytes }). Needed files: ${PDFA_FONT_FILES.join(', ')}.`,
    );
  }
  const parsed = parseTrueTypeFont(bytes);
  parsedPdfaFonts.set(file, parsed);
  return parsed;
}

// Unicode text that the WinAnsi path would have shown for `str` (same substitutions as
// pdfEscapeText), so pdfa output displays and extracts exactly the same characters.
function winAnsiVisibleText(str) {
  const s = String(str || '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) { out += ch; continue; }
    const mapped = WIN_ANSI_MAP[ch];
    if (mapped !== undefined && mapped !== '') {
      out += mapped.startsWith('\\') ? (ch === ' ' || ch === ' ' ? ' ' : ch) : mapped;
      continue;
    }
    if (mapped === '') continue;
    out += code >= 160 && code <= 255 ? ch : ' ';
  }
  return out;
}

// 128-bit non-cryptographic digest (four FNV-1a lanes with murmur finalisation). Used for the
// trailer /ID and xmpMM ids, which need uniqueness, not secrecy.
function digest128(chunks) {
  const seeds = [0x811c9dc5, 0x01000193 ^ 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const h = seeds.slice();
  for (const chunk of chunks) {
    const b = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    for (let i = 0; i < b.length; i++) {
      const v = b[i];
      h[0] = Math.imul(h[0] ^ v, 16777619);
      h[1] = Math.imul(h[1] ^ v, 0x01000193) ^ (h[1] >>> 15);
      h[2] = Math.imul(h[2] ^ (v + i), 0x27d4eb2d);
      h[3] = Math.imul(h[3] ^ v, 0x165667b1) + (h[3] >>> 13);
    }
  }
  const out = Buffer.alloc(16);
  for (let k = 0; k < 4; k++) {
    let x = h[k] ^ h[(k + 1) & 3];
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    out.writeUInt32BE(x >>> 0, k * 4);
  }
  return out;
}

function pdfaDates(dateOpt) {
  const d = dateOpt ? new Date(dateOpt) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const p2 = (n) => String(n).padStart(2, '0');
  const offMin = -date.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const oh = p2(Math.floor(Math.abs(offMin) / 60));
  const om = p2(Math.abs(offMin) % 60);
  const Y = date.getFullYear();
  const M = p2(date.getMonth() + 1);
  const D = p2(date.getDate());
  const h = p2(date.getHours());
  const m = p2(date.getMinutes());
  const s = p2(date.getSeconds());
  return {
    xmp: `${Y}-${M}-${D}T${h}:${m}:${s}${sign}${oh}:${om}`,
    pdf: `D:${Y}${M}${D}${h}${m}${s}${sign}${oh}'${om}'`,
  };
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// PDF text string: literal for ASCII, UTF-16BE with BOM otherwise.
function pdfTextString(s) {
  const str = String(s);
  if (/^[\x20-\x7e]*$/.test(str)) return `(${str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
  let hex = 'FEFF';
  for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function uuidFromBytes(b) {
  const h = Buffer.from(b).toString('hex');
  return `uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// MD5 (RFC 1321), pure JS, for the embedded file /CheckSum. Not used for security.
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5Hex(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Buffer.from(bytes);
  const n = b.length;
  const total = (((n + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(total);
  m.set(b);
  m[n] = 0x80;
  const bits = n * 8;
  for (let i = 0; i < 8; i++) m[total - 8 + i] = Math.floor(bits / 2 ** (8 * i)) & 0xff;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const w = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = m[off + i * 4] | (m[off + i * 4 + 1] << 8) | (m[off + i * 4 + 2] << 16) | (m[off + i * 4 + 3] << 24);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      const tmp = D;
      D = C;
      C = B;
      const x = (A + F + MD5_K[i] + w[g]) >>> 0;
      const sh = MD5_S[(i >> 4) * 4 + (i & 3)];
      B = (B + ((x << sh) | (x >>> (32 - sh)))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  let hex = '';
  for (const v of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) hex += ((v >>> (8 * i)) & 0xff).toString(16).padStart(2, '0');
  return hex.toUpperCase();
}

/** Builds the PDF/A XMP packet. Exported so other modules (e-invoice) can reuse the exact layout. */
export function buildPdfaXmp({ title, author, producer, creatorTool, dates, documentId, instanceId, extraXmp, part = 3, conformance = 'B' }) {
  const extras = Array.isArray(extraXmp) ? extraXmp : extraXmp ? [extraXmp] : [];
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
<pdfaid:part>${part}</pdfaid:part>
<pdfaid:conformance>${conformance}</pdfaid:conformance>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:format>application/pdf</dc:format>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${xmlEscape(author)}</rdf:li></rdf:Seq></dc:creator>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
<xmp:CreatorTool>${xmlEscape(creatorTool)}</xmp:CreatorTool>
<xmp:CreateDate>${dates.xmp}</xmp:CreateDate>
<xmp:ModifyDate>${dates.xmp}</xmp:ModifyDate>
<xmp:MetadataDate>${dates.xmp}</xmp:MetadataDate>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdf:Producer>${xmlEscape(producer)}</pdf:Producer>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">
<xmpMM:DocumentID>${documentId}</xmpMM:DocumentID>
<xmpMM:InstanceID>${instanceId}</xmpMM:InstanceID>
</rdf:Description>
${extras.join('\n')}${extras.length ? '\n' : ''}</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// =============================================================================
// Primary PDF 1.7 Compiler
// =============================================================================
function hasNonAscii(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) return true;
  }
  return false;
}

export function compilePagesToPdf(layoutResult, options = {}) {
  const pages = layoutResult.pages || [];
  const objects = [];

  function addObj(bodyOrObj) {
    const id = objects.length + 1;
    if (typeof bodyOrObj === 'object' && bodyOrObj !== null && bodyOrObj.stream !== undefined) {
      objects.push({ id, dict: bodyOrObj.dict, stream: bodyOrObj.stream });
    } else {
      objects.push({ id, body: bodyOrObj });
    }
    return id;
  }

  const catalogId = addObj('');
  const pagesRootId = addObj('');

  // Standard 14 Fonts
  const pdfa = options.pdfa ? String(options.pdfa === true ? '3b' : options.pdfa).toLowerCase() : null;
  if (pdfa && pdfa !== '3b') throw new Error(`VeloxPDF: unsupported pdfa level ${options.pdfa} (only '3b')`);
  const fontRegularId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // /F1
  const fontBoldId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // /F2
  const fontMonoId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'); // /F3
  const fontItalicId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'); // /F4
  const fontTimesId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>'); // /F5
  const fontTimesBoldId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>'); // /F6
  const fontTimesItalicId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>'); // /F7
  const fontMonoBoldId = pdfa ? 0 : addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'); // /F8

  // PDF/A: base-14 refs (/F1../F8) become subset Liberation Type0 fonts, created on first use.
  const pdfaFontStates = new Map();
  let pageFontsUsed = null;
  function pdfaFontState(ref) {
    let st = pdfaFontStates.get(ref);
    if (!st) {
      const spec = PDFA_FONT_MAP[ref] || PDFA_FONT_MAP['/F1'];
      st = { ref, spec, font: loadPdfaFont(spec.file, options.pdfaFonts), id: addObj(''), order: [0], newOf: new Map([[0, 0]]), unicodes: new Map() };
      pdfaFontStates.set(ref, st);
    }
    return st;
  }
  // Text show operator for a base-14 ref. Without pdfa this is exactly the historic WinAnsi literal.
  function showBase14(ref, text) {
    if (!pdfa) return `(${pdfEscapeText(text)}) Tj`;
    const st = pdfaFontState(ref);
    if (pageFontsUsed) pageFontsUsed.add(ref);
    let hex = '';
    for (const ch of winAnsiVisibleText(text)) {
      const cp = ch.codePointAt(0);
      const oldGid = st.font.cmap.get(cp) || 0;
      let gid = st.newOf.get(oldGid);
      if (gid === undefined) {
        gid = st.order.length;
        st.order.push(oldGid);
        st.newOf.set(oldGid, gid);
      }
      if (oldGid !== 0 && !st.unicodes.has(cp)) st.unicodes.set(cp, gid);
      hex += gid.toString(16).padStart(4, '0');
    }
    return `<${hex}> Tj`;
  }

  // Register custom TrueType /Type0 fonts if passed in options.fonts, options.font, options.ttf, or layoutResult.fonts
  const ttfFontRegistry = new Map();
  const customFontEntries = [];
  let defaultCustomFont = null;
  let defaultCustomFontRef = null;
  let nextFontIdx = 9; // /F9, /F10, ...

  const rawFonts = [];
  if (options.fonts) {
    if (Array.isArray(options.fonts)) {
      rawFonts.push(...options.fonts);
    } else if (typeof options.fonts === 'object') {
      for (const [name, val] of Object.entries(options.fonts)) {
        rawFonts.push({ name, data: val });
      }
    }
  }
  if (options.font) rawFonts.push(options.font);
  if (options.ttf) rawFonts.push(options.ttf);
  if (layoutResult.fonts) {
    if (Array.isArray(layoutResult.fonts)) {
      rawFonts.push(...layoutResult.fonts);
    } else if (typeof layoutResult.fonts === 'object') {
      for (const [name, val] of Object.entries(layoutResult.fonts)) {
        rawFonts.push({ name, data: val });
      }
    }
  }

  for (const entry of rawFonts) {
    const rawData = entry?.data || entry;
    const customName = entry?.name || null;
    let parsedFont = null;

    if (rawData && rawData.embedded && rawData.cmap && rawData.widths) {
      parsedFont = rawData;
    } else if (rawData instanceof Uint8Array || Buffer.isBuffer(rawData)) {
      parsedFont = parseTrueTypeFont(rawData);
    }

    if (parsedFont && parsedFont.embedded) {
      const fRef = `/F${nextFontIdx++}`;
      const compressedTtf = zlib.deflateSync(Buffer.from(parsedFont.rawBytes));
      const fontFileId = addObj({
        dict: `<< /Filter /FlateDecode /Length ${compressedTtf.length} /Length1 ${parsedFont.rawBytes.length} >>`,
        stream: compressedTtf,
      });

      const bboxStr = `[${parsedFont.bbox.join(' ')}]`;
      const fontDescId = addObj(
        `<< /Type /FontDescriptor /FontName /${parsedFont.fontName} /Flags 32 /FontBBox ${bboxStr} /ItalicAngle ${parsedFont.italicAngle} /Ascent ${parsedFont.ascent} /Descent ${parsedFont.descent} /CapHeight ${parsedFont.capHeight} /StemV ${parsedFont.stemV || 80} /FontFile2 ${fontFileId} 0 R >>`
      );

      const wArr = [];
      for (let g = 0; g < parsedFont.numGlyphs; g++) {
        wArr.push(parsedFont.widths.get(g) || 600);
      }
      const wStr = `[ 0 [ ${wArr.join(' ')} ] ]`;

      const cidFontId = addObj(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${parsedFont.fontName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fontDescId} 0 R /CIDToGIDMap /Identity /W ${wStr} >>`
      );

      const toUnicodeStream = generateToUnicodeCMap(parsedFont.cmap, parsedFont.fontName);
      const toUnicodeBuf = Buffer.from(toUnicodeStream, 'utf8');
      const toUnicodeId = addObj({
        dict: `<< /Length ${toUnicodeBuf.length} >>`,
        stream: toUnicodeBuf,
      });

      const type0Id = addObj(
        `<< /Type /Font /Subtype /Type0 /BaseFont /${parsedFont.fontName} /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`
      );

      customFontEntries.push(`${fRef} ${type0Id} 0 R`);
      const record = { ref: fRef, id: type0Id, font: parsedFont };
      if (customName) ttfFontRegistry.set(String(customName).toLowerCase().trim(), record);
      if (parsedFont.fontName) ttfFontRegistry.set(String(parsedFont.fontName).toLowerCase().trim(), record);

      if (!defaultCustomFont) {
        defaultCustomFont = parsedFont;
        defaultCustomFontRef = fRef;
      }
    }
  }

  // Shared ExtGState dictionary cache
  const globalExtGStates = {};
  function getExtGStateAlpha(alpha) {
    const clamped = Math.max(0, Math.min(1, Number(alpha)));
    const key = `GS_a${Math.round(clamped * 1000)}`;
    if (!globalExtGStates[key]) {
      const objId = addObj(`<< /Type /ExtGState /ca ${clamped.toFixed(3)} /CA ${clamped.toFixed(3)} >>`);
      globalExtGStates[key] = { id: objId, name: key, alpha: clamped };
    }
    return globalExtGStates[key];
  }

  // Machine-readable JSON payload attachment (plain embedded file, not PDF/A-3 Factur-X)
  let filespecId = null;
  const embeddedData = options.embedData !== false ? (options.data || layoutResult.embeddedData) : null;
  if (embeddedData) {
    try {
      const jsonStr = typeof embeddedData === 'string' ? embeddedData : JSON.stringify(embeddedData);
      const jsonBuf = Buffer.from(jsonStr, 'utf8');
      const compressedJson = zlib.deflateSync(jsonBuf);
      const embeddedStreamId = addObj({
        dict: `<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${compressedJson.length} /Filter /FlateDecode /Params << /Size ${jsonBuf.length} >> >>`,
        stream: compressedJson,
      });
      filespecId = addObj(
        `<< /Type /Filespec /F (velox-payload.json) /UF (velox-payload.json) /EF << /F ${embeddedStreamId} 0 R >> /AFRelationship /Data /Desc (Embedded JSON data) >>`
      );
    } catch {
      filespecId = null;
    }
  }

  // Associated files (PDF/A-3 /AF), e.g. the Factur-X / XRechnung XML. Each entry:
  // { name, data: string|Uint8Array, mimeType, afRelationship = 'Data', description, modDate }.
  // Only used when options.embeddedFiles is given, so default output is unchanged.
  const extraFilespecs = [];
  for (const ef of Array.isArray(options.embeddedFiles) ? options.embeddedFiles : []) {
    const name = String(ef.name || 'attachment.bin');
    const raw = typeof ef.data === 'string' ? Buffer.from(ef.data, 'utf8') : Buffer.from(ef.data || []);
    const packed = zlib.deflateSync(raw);
    const mime = String(ef.mimeType || 'application/octet-stream').replace(/[^A-Za-z0-9.+-]/g, (c) => `#${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`);
    const modDate = pdfaDates(ef.modDate || options.creationDate).pdf;
    const streamId = addObj({
      dict: `<< /Type /EmbeddedFile /Subtype /${mime} /Filter /FlateDecode /Length ${packed.length} /Params << /Size ${raw.length} /CheckSum <${md5Hex(raw)}> /ModDate (${modDate}) >> >>`,
      stream: packed,
    });
    const fsId = addObj(
      `<< /Type /Filespec /F ${pdfTextString(name)} /UF ${pdfTextString(name)} /Desc ${pdfTextString(ef.description || name)} /AFRelationship /${String(ef.afRelationship || 'Data').replace(/[^A-Za-z]/g, '')} /EF << /F ${streamId} 0 R /UF ${streamId} 0 R >> >>`,
    );
    extraFilespecs.push({ name, id: fsId });
  }

  const pageIds = [];

  for (const page of pages) {
    const H = page.height;
    const cmds = [];
    if (pdfa) pageFontsUsed = new Set();
    const pageImageXObjects = {};
    const pageExtGStates = {};
    let pageImageSeq = 1;

    for (const item of page.items || []) {
      const itype = item.type || item.op;

      if (itype === 'rect') {
        const py = H - item.y - item.h;
        const radii = item.radii || item.radius || 0;
        const fillRgb = parseHexColor(item.fill);
        const strokeRgb = parseHexColor(item.stroke);
        const hasOpacity = item.opacity !== undefined && item.opacity !== null && item.opacity < 1.0;
        const hasRotate = typeof item.rotate === 'number' && item.rotate !== 0;

        let gsName = null;
        if (hasOpacity) {
          const gs = getExtGStateAlpha(item.opacity);
          pageExtGStates[gs.name] = gs.id;
          gsName = gs.name;
        }

        if (hasRotate) {
          const rad = (item.rotate * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = item.x + item.w / 2;
          const cy = py + item.h / 2;
          const pathStr = roundedRectPath(-item.w / 2, -item.h / 2, item.w, item.h, radii);

          cmds.push(`q ${cos.toFixed(6)} ${sin.toFixed(6)} ${(-sin).toFixed(6)} ${cos.toFixed(6)} ${cx.toFixed(2)} ${cy.toFixed(2)} cm`);
          if (gsName) cmds.push(`/${gsName} gs`);
          if (fillRgb && strokeRgb && item.lineWidth > 0) {
            cmds.push(`${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} B`);
          } else if (fillRgb) {
            cmds.push(`${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${pathStr} f`);
          } else if (strokeRgb && item.lineWidth > 0) {
            cmds.push(`${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} S`);
          }
          cmds.push('Q');
        } else if (hasOpacity) {
          const pathStr = roundedRectPath(item.x, py, item.w, item.h, radii);
          cmds.push(`q /${gsName} gs`);
          if (fillRgb && strokeRgb && item.lineWidth > 0) {
            cmds.push(`${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} B`);
          } else if (fillRgb) {
            cmds.push(`${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${pathStr} f`);
          } else if (strokeRgb && item.lineWidth > 0) {
            cmds.push(`${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} S`);
          }
          cmds.push('Q');
        } else {
          const pathStr = roundedRectPath(item.x, py, item.w, item.h, radii);
          if (item.gradient && item.gradient.from && item.gradient.to) {
            const c0 = parseHexColor(item.gradient.from) || [0.06, 0.09, 0.16];
            const c1 = parseHexColor(item.gradient.to) || [0.19, 0.18, 0.51];
            const bands = 28;
            cmds.push(`q ${pathStr} W n`);
            for (let b = 0; b < bands; b++) {
              const t = b / (bands - 1);
              const r = c0[0] + (c1[0] - c0[0]) * t;
              const g = c0[1] + (c1[1] - c0[1]) * t;
              const bl = c0[2] + (c1[2] - c0[2]) * t;
              const bx = item.x + (item.w / bands) * b;
              const bw = item.w / bands + 0.8;
              cmds.push(`${r.toFixed(3)} ${g.toFixed(3)} ${bl.toFixed(3)} rg ${bx.toFixed(2)} ${py.toFixed(2)} ${bw.toFixed(2)} ${item.h.toFixed(2)} re f`);
            }
            cmds.push('Q');
          } else if (fillRgb && strokeRgb && item.lineWidth > 0) {
            cmds.push(`q ${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} B Q`);
          } else if (fillRgb) {
            cmds.push(`q ${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${pathStr} f Q`);
          } else if (strokeRgb && item.lineWidth > 0) {
            cmds.push(`q ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${item.lineWidth.toFixed(2)} w ${pathStr} S Q`);
          }
        }
      } else if (itype === 'shadow') {
        // Soft shadow: concentric stroked rings whose alpha follows a Gaussian edge,
        // clipped (even-odd) so nothing paints inside the box itself.
        const rgb = parseHexColor(item.color) || [0, 0, 0];
        const rgbStr = rgb.map((v) => v.toFixed(3)).join(' ');
        const r0 = Array.isArray(item.radius) ? Math.max(...item.radius.map((v) => Number(v) || 0)) : Number(item.radius) || 0;
        const sx = item.x + item.dx - item.spread;
        const sTop = item.y + item.dy - item.spread;
        const sw = item.w + 2 * item.spread;
        const sh = item.h + 2 * item.spread;
        const rect = (grow, rr) => {
          const gw = sw + 2 * grow;
          const gh = sh + 2 * grow;
          if (gw <= 0 || gh <= 0) return null;
          return roundedRectPath(sx - grow, H - (sTop - grow) - gh, gw, gh, Math.min(Math.max(0, rr), gw / 2, gh / 2));
        };
        const boxPath = roundedRectPath(item.x, H - item.y - item.h, item.w, item.h, item.radius || 0);
        const pad = item.blur + Math.abs(item.dx) + Math.abs(item.dy) + Math.abs(item.spread) + 4;
        const outer = `${(item.x - pad).toFixed(2)} ${(H - item.y - item.h - pad).toFixed(2)} ${(item.w + 2 * pad).toFixed(2)} ${(item.h + 2 * pad).toFixed(2)} re`;
        const useGs = (a) => {
          const gs = getExtGStateAlpha(a);
          pageExtGStates[gs.name] = gs.id;
          return `/${gs.name} gs`;
        };
        cmds.push(`q ${outer} ${boxPath} W* n ${rgbStr} rg ${rgbStr} RG`);
        if (item.blur <= 0) {
          const pth = rect(0, r0);
          if (pth) cmds.push(`${useGs(item.alpha)} ${pth} f`);
        } else {
          const sigma = item.blur / 2;
          const erf = (z) => {
            const t = 1 / (1 + 0.3275911 * Math.abs(z));
            const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
            return z >= 0 ? y : -y;
          };
          const cover = (d) => 0.5 * (1 - erf(d / (sigma * Math.SQRT2))); // d = outward distance from shadow edge
          const core = rect(-item.blur, r0 - item.blur);
          if (core) cmds.push(`${useGs(item.alpha)} ${core} f`);
          const n = Math.max(6, Math.min(40, Math.ceil((2 * item.blur) / 0.8)));
          const step = (2 * item.blur) / n;
          for (let k = 0; k < n; k++) {
            const d = -item.blur + (k + 0.5) * step;
            const a = item.alpha * cover(d);
            if (a < 0.002) continue;
            const pth = rect(d, r0 + d);
            if (pth) cmds.push(`${useGs(a)} ${(step + 0.15).toFixed(2)} w ${pth} S`);
          }
        }
        cmds.push('Q');
      } else if (itype === 'line') {
        const rgb = parseHexColor(item.stroke) || [0.88, 0.91, 0.94];
        const hasOpacity = item.opacity !== undefined && item.opacity !== null && item.opacity < 1.0;
        let gsStr = '';
        if (hasOpacity) {
          const gs = getExtGStateAlpha(item.opacity);
          pageExtGStates[gs.name] = gs.id;
          gsStr = `/${gs.name} gs `;
        }
        cmds.push(`q ${gsStr}${rgb.map((v) => v.toFixed(3)).join(' ')} RG ${(item.lineWidth || 0.7).toFixed(2)} w ${item.x1.toFixed(2)} ${(H - item.y1).toFixed(2)} m ${item.x2.toFixed(2)} ${(H - item.y2).toFixed(2)} l S Q`);
      } else if (itype === 'text') {
        const rgb = parseHexColor(item.color) || [0.06, 0.09, 0.16];
        const rgbStr = rgb.map((v) => v.toFixed(3)).join(' ');
        const py = H - item.y;
        const fontSize = (item.fontSize || 10).toFixed(2);
        const hasOpacity = item.opacity !== undefined && item.opacity !== null && item.opacity < 1.0;
        const hasRotate = typeof item.rotate === 'number' && item.rotate !== 0;

        let gsName = null;
        if (hasOpacity) {
          const gs = getExtGStateAlpha(item.opacity);
          pageExtGStates[gs.name] = gs.id;
          gsName = gs.name;
        }

        let fRef = resolveFontRef(item);
        let fontObj = null;
        const reqFam = String(item.fontFamily || '').toLowerCase().trim();
        if (ttfFontRegistry.has(reqFam)) {
          const reg = ttfFontRegistry.get(reqFam);
          fRef = reg.ref;
          fontObj = reg.font;
        } else if (defaultCustomFont && (hasNonAscii(item.text) || options.font || options.ttf)) {
          fRef = defaultCustomFontRef;
          fontObj = defaultCustomFont;
        }
        // Glyph-coverage fallback: if the chosen custom font lacks glyphs for this run, use the
        // registered font that covers the most characters (otherwise missing glyphs become .notdef
        // and the text silently vanishes from both the page and text extraction).
        if (fontObj && fontObj.cmap && item.text) {
          const chars = Array.from(String(item.text)).filter((c) => c.trim() !== '');
          const covered = (f) => chars.reduce((n, c) => n + (f.cmap.get(c.codePointAt(0)) ? 1 : 0), 0);
          let best = { reg: null, n: covered(fontObj) };
          if (best.n < chars.length) {
            for (const reg of new Set(ttfFontRegistry.values())) {
              const n = covered(reg.font);
              if (n > best.n) best = { reg, n };
            }
            if (best.reg) { fRef = best.reg.ref; fontObj = best.reg.font; }
          }
        }

        let textOp;
        if (fontObj && fontObj.cmap) {
          let hex = '';
          for (const ch of String(item.text || '')) {
            const cp = ch.codePointAt(0);
            const gid = fontObj.cmap.get(cp) || 0;
            hex += gid.toString(16).padStart(4, '0');
          }
          textOp = `<${hex}> Tj`;
          if (pageFontsUsed) pageFontsUsed.add(fRef);
        } else {
          textOp = showBase14(fRef, item.text);
        }

        if (hasRotate || hasOpacity) {
          cmds.push('q');
          if (gsName) cmds.push(`/${gsName} gs`);
          if (hasRotate) {
            const rad = (item.rotate * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            cmds.push(`${cos.toFixed(6)} ${sin.toFixed(6)} ${(-sin).toFixed(6)} ${cos.toFixed(6)} ${item.x.toFixed(2)} ${py.toFixed(2)} cm`);
            cmds.push(`BT ${rgbStr} rg ${fRef} ${fontSize} Tf 0 0 Td ${textOp} ET`);
          } else {
            cmds.push(`BT ${rgbStr} rg ${fRef} ${fontSize} Tf ${item.x.toFixed(2)} ${py.toFixed(2)} Td ${textOp} ET`);
          }
          cmds.push('Q');
        } else {
          cmds.push(`BT ${rgbStr} rg ${fRef} ${fontSize} Tf ${item.x.toFixed(2)} ${py.toFixed(2)} Td ${textOp} ET`);
        }
      } else if (itype === 'canvas2d') {
        const scaleX = item.w / (item.rawW || 240);
        const scaleY = item.h / (item.rawH || 70);
        let curPath = [];
        let currentLineDash = [];
        let lastX = item.x;
        let lastY = H - item.y;
        for (const op of item.ops || []) {
          if (op.op === 'setLineDash') {
            currentLineDash = Array.isArray(op.segments) ? op.segments : Array.isArray(op.args?.[0]) ? op.args[0] : [];
          } else if (op.op === 'fillRect') {
            const rgb = parseHexColor(op.fillStyle) || [0.31, 0.27, 0.9];
            const rx = item.x + op.x * scaleX;
            const ry = H - (item.y + (op.y + op.h) * scaleY);
            const rw = op.w * scaleX;
            const rh = op.h * scaleY;
            cmds.push(`q ${rgb.map((v) => v.toFixed(3)).join(' ')} rg ${roundedRectPath(rx, ry, rw, rh, 2.2)} f Q`);
          } else if (op.op === 'strokeRect') {
            const rgb = parseHexColor(op.strokeStyle) || [0.8, 0.84, 0.9];
            const rx = item.x + op.x * scaleX;
            const ry = H - (item.y + (op.y + op.h) * scaleY);
            const rw = op.w * scaleX;
            const rh = op.h * scaleY;
            const dashCmd = currentLineDash.length > 0 ? `[${currentLineDash.map((s) => (s * scaleX).toFixed(2)).join(' ')}] 0 d ` : '';
            cmds.push(`q ${rgb.map((v) => v.toFixed(3)).join(' ')} RG ${(op.lineWidth || 1).toFixed(2)} w ${dashCmd}${rx.toFixed(2)} ${ry.toFixed(2)} ${rw.toFixed(2)} ${rh.toFixed(2)} re S Q`);
          } else if (op.op === 'beginPath') {
            curPath = [];
          } else if (op.op === 'moveTo') {
            const px = item.x + op.x * scaleX;
            const py = H - (item.y + op.y * scaleY);
            curPath.push(`${px.toFixed(2)} ${py.toFixed(2)} m`);
            lastX = px;
            lastY = py;
          } else if (op.op === 'lineTo') {
            const px = item.x + op.x * scaleX;
            const py = H - (item.y + op.y * scaleY);
            curPath.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
            lastX = px;
            lastY = py;
          } else if (op.op === 'bezierCurveTo') {
            const cp1x = item.x + (op.cp1x ?? op.args?.[0] ?? 0) * scaleX;
            const cp1y = H - (item.y + (op.cp1y ?? op.args?.[1] ?? 0) * scaleY);
            const cp2x = item.x + (op.cp2x ?? op.args?.[2] ?? 0) * scaleX;
            const cp2y = H - (item.y + (op.cp2y ?? op.args?.[3] ?? 0) * scaleY);
            const px = item.x + (op.x ?? op.args?.[4] ?? 0) * scaleX;
            const py = H - (item.y + (op.y ?? op.args?.[5] ?? 0) * scaleY);
            curPath.push(`${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
            lastX = px;
            lastY = py;
          } else if (op.op === 'quadraticCurveTo') {
            const cpx = item.x + (op.cpx ?? op.args?.[0] ?? 0) * scaleX;
            const cpy = H - (item.y + (op.cpy ?? op.args?.[1] ?? 0) * scaleY);
            const px = item.x + (op.x ?? op.args?.[2] ?? 0) * scaleX;
            const py = H - (item.y + (op.y ?? op.args?.[3] ?? 0) * scaleY);
            const cp1x = lastX + (2 / 3) * (cpx - lastX);
            const cp1y = lastY + (2 / 3) * (cpy - lastY);
            const cp2x = px + (2 / 3) * (cpx - px);
            const cp2y = py + (2 / 3) * (cpy - py);
            curPath.push(`${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)} c`);
            lastX = px;
            lastY = py;
          } else if (op.op === 'arc') {
            const cx = item.x + op.x * scaleX;
            const cy = H - (item.y + op.y * scaleY);
            const r = op.r * scaleX;
            curPath.push(roundedRectPath(cx - r, cy - r, r * 2, r * 2, r));
            lastX = cx + r;
            lastY = cy;
          } else if (op.op === 'stroke' && curPath.length > 0) {
            const rgb = parseHexColor(op.strokeStyle) || [0.31, 0.27, 0.9];
            const dashCmd = currentLineDash.length > 0 ? `[${currentLineDash.map((s) => (s * scaleX).toFixed(2)).join(' ')}] 0 d ` : '';
            cmds.push(`q ${rgb.map((v) => v.toFixed(3)).join(' ')} RG ${((op.lineWidth || 1.5) * scaleX).toFixed(2)} w 1 J 1 j ${dashCmd}${curPath.join(' ')} S Q`);
          } else if (op.op === 'fill' && curPath.length > 0) {
            const rgb = parseHexColor(op.fillStyle) || [0.31, 0.27, 0.9];
            cmds.push(`q ${rgb.map((v) => v.toFixed(3)).join(' ')} rg ${curPath.join(' ')} f Q`);
          } else if (op.op === 'fillText') {
            const rgb = parseHexColor(op.fillStyle) || [0.39, 0.45, 0.55];
            const tx = item.x + op.x * scaleX;
            const ty = H - (item.y + op.y * scaleY);
            cmds.push(`BT ${rgb.map((v) => v.toFixed(3)).join(' ')} rg /F1 7.5 Tf ${tx.toFixed(2)} ${ty.toFixed(2)} Td ${showBase14('/F1', op.text)} ET`);
          }
        }
      } else if (itype === 'qr') {
        const mat = generateQrMatrix(item.value);
        const N = mat.length;
        const cell = item.size / N;
        cmds.push('q 0.06 0.09 0.16 rg');
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            if (mat[r][c]) {
              const qx = item.x + c * cell;
              const qy = H - (item.y + (r + 1) * cell);
              cmds.push(`${qx.toFixed(2)} ${qy.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re`);
            }
          }
        }
        cmds.push('f Q');
      } else if (itype === 'barcode') {
        const barVal = item.value || item.code || item.text || 'INV-2026';
        const bars = generateCode128Bars(barVal);
        const totalModules = bars.totalModules || 123;
        const totalBarcodeW = item.w || totalModules * 1.2;
        const modW = totalBarcodeW / totalModules;
        const hasLabel = item.label !== undefined ? Boolean(item.label) : (item.showText !== false);
        const labelText = typeof item.label === 'string' ? item.label : String(barVal);
        const fontSize = item.fontSize || 8;
        const H_total = item.h || 40;
        const barH = hasLabel ? Math.max(12, H_total - fontSize - 4) : H_total;
        const barY = H - item.y - barH;
        const textY = H - item.y - H_total + 2;

        const rgb = parseHexColor(item.color || item.fill) || [0.06, 0.09, 0.16];
        cmds.push(`q ${rgb.map((v) => v.toFixed(3)).join(' ')} rg`);
        let curModule = 0;
        for (let i = 0; i < bars.length; i++) {
          const w = bars[i];
          if (i % 2 === 0) {
            const bx = item.x + curModule * modW;
            const bw = w * modW;
            cmds.push(`${bx.toFixed(2)} ${barY.toFixed(2)} ${bw.toFixed(2)} ${barH.toFixed(2)} re`);
          }
          curModule += w;
        }
        cmds.push('f Q');

        if (hasLabel && labelText) {
          const textW = labelText.length * (fontSize * 0.55);
          const tx = item.x + Math.max(0, (totalBarcodeW - textW) / 2);
          cmds.push(`BT ${rgb.map((v) => v.toFixed(3)).join(' ')} rg /F3 ${fontSize.toFixed(2)} Tf ${tx.toFixed(2)} ${textY.toFixed(2)} Td ${showBase14('/F3', labelText)} ET`);
        }
      } else if (itype === 'svg') {
        let vx0 = 0, vy0 = 0, vw = item.w || 100, vh = item.h || 100;
        if (typeof item.viewBox === 'string') {
          const parts = item.viewBox.trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            [vx0, vy0, vw, vh] = parts;
          }
        } else if (Array.isArray(item.viewBox) && item.viewBox.length === 4) {
          [vx0, vy0, vw, vh] = item.viewBox;
        } else if (item.viewBox && typeof item.viewBox === 'object') {
          vx0 = item.viewBox.x ?? item.viewBox.minX ?? 0;
          vy0 = item.viewBox.y ?? item.viewBox.minY ?? 0;
          vw = item.viewBox.w ?? item.viewBox.width ?? item.w;
          vh = item.viewBox.h ?? item.viewBox.height ?? item.h;
        }

        const scaleX = (item.w || vw) / vw;
        const scaleY = (item.h || vh) / vh;
        const transformPt = (x, y) => {
          const px = item.x + (x - vx0) * scaleX;
          const py = H - item.y - (y - vy0) * scaleY;
          return [px, py];
        };

        const clipY = H - item.y - item.h;
        cmds.push(`q ${item.x.toFixed(2)} ${clipY.toFixed(2)} ${item.w.toFixed(2)} ${item.h.toFixed(2)} re W n`);

        const currentColorRgb = parseHexColor(item.color || item.fill || item.stroke || '#0f172a') || [0.06, 0.09, 0.16];

        const renderElements = (elements, parentMat = null, inheritedFill = undefined, inheritedStroke = undefined, inheritedStrokeWidth = undefined) => {
          if (!elements) return;
          const list = Array.isArray(elements) ? elements : [elements];
          for (const p of list) {
            if (!p) continue;
            const elemMat = parseSvgTransform(p.transform ?? p.attrs?.transform);
            const fullMat = elemMat && parentMat ? multiplySvgTransforms(parentMat, elemMat) : (elemMat || parentMat);
            const tag = (p.tag || (p.d ? 'path' : '')).toLowerCase();

            if (tag === 'g' || (p.children && p.children.length > 0 && !p.d && !p.attrs?.d && tag !== 'text')) {
              const gFill = p.fill ?? p.attrs?.fill ?? inheritedFill;
              const gStroke = p.stroke ?? p.attrs?.stroke ?? inheritedStroke;
              const gStrokeW = p.strokeWidth ?? p.attrs?.['stroke-width'] ?? inheritedStrokeWidth;
              renderElements(p.children, fullMat, gFill, gStroke, gStrokeW);
              continue;
            }

            const localTransformPt = fullMat
              ? (x, y) => {
                  const tx = fullMat[0] * x + fullMat[2] * y + fullMat[4];
                  const ty = fullMat[1] * x + fullMat[3] * y + fullMat[5];
                  return transformPt(tx, ty);
                }
              : transformPt;

            if (tag === 'text') {
              const textContent = p.text ?? p.content ?? p.attrs?.text ?? (Array.isArray(p.children) ? p.children.map((c) => c.text || '').join('') : '');
              if (textContent) {
                const tx = Number(p.x ?? p.attrs?.x ?? 0);
                const ty = Number(p.y ?? p.attrs?.y ?? 0);
                let [px, py] = localTransformPt(tx, ty);
                const fs = Number(p.fontSize ?? p.attrs?.['font-size'] ?? p.attrs?.fontSize ?? 12) * Math.min(scaleX, scaleY);
                const anchor = (p.textAnchor ?? p.attrs?.['text-anchor'] ?? 'start').toLowerCase();
                if (anchor === 'middle' || anchor === 'center') {
                  px -= (textContent.length * fs * 0.52) / 2;
                } else if (anchor === 'end' || anchor === 'right') {
                  px -= (textContent.length * fs * 0.52);
                }
                const rawFill = p.fill ?? p.attrs?.fill ?? inheritedFill ?? '#000000';
                const fillRgb = parseHexColor(rawFill, currentColorRgb) || [0.06, 0.09, 0.16];
                const fontRef = (p.fontWeight === 'bold' || p.attrs?.['font-weight'] === 'bold') ? '/F2' : '/F1';
                cmds.push(`BT ${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${fontRef} ${fs.toFixed(2)} Tf ${px.toFixed(2)} ${py.toFixed(2)} Td ${showBase14(fontRef, textContent)} ET`);
              }
              continue;
            }

            let pathStr = '';
            if (tag === 'path' || p.d || p.attrs?.d) {
              const dStr = p.d || p.attrs?.d || '';
              const subOps = parseSvgPath(dStr, localTransformPt);
              if (subOps.length > 0) pathStr = subOps.join(' ');
            } else if (tag === 'circle') {
              const cx = Number(p.cx ?? p.attrs?.cx ?? 0);
              const cy = Number(p.cy ?? p.attrs?.cy ?? 0);
              const r = Number(p.r ?? p.attrs?.r ?? 0);
              if (r > 0) pathStr = circleToPath(cx, cy, r, localTransformPt);
            } else if (tag === 'ellipse') {
              const cx = Number(p.cx ?? p.attrs?.cx ?? 0);
              const cy = Number(p.cy ?? p.attrs?.cy ?? 0);
              const rx = Number(p.rx ?? p.attrs?.rx ?? 0);
              const ry = Number(p.ry ?? p.attrs?.ry ?? 0);
              if (rx > 0 && ry > 0) pathStr = ellipseToPath(cx, cy, rx, ry, localTransformPt);
            } else if (tag === 'rect') {
              const rx0 = Number(p.x ?? p.attrs?.x ?? 0);
              const ry0 = Number(p.y ?? p.attrs?.y ?? 0);
              const rw = Number(p.width ?? p.attrs?.width ?? 0);
              const rh = Number(p.height ?? p.attrs?.height ?? 0);
              const crx = Number(p.rx ?? p.attrs?.rx ?? 0);
              const cry = Number(p.ry ?? p.attrs?.ry ?? 0);
              if ((crx > 0 || cry > 0) && !fullMat) {
                const [bx0, by0] = localTransformPt(rx0, ry0 + rh);
                pathStr = roundedRectPath(bx0, by0, rw * scaleX, rh * scaleY, Math.max(crx * scaleX, cry * scaleY));
              } else {
                const [p0x, p0y] = localTransformPt(rx0, ry0);
                const [p1x, p1y] = localTransformPt(rx0 + rw, ry0);
                const [p2x, p2y] = localTransformPt(rx0 + rw, ry0 + rh);
                const [p3x, p3y] = localTransformPt(rx0, ry0 + rh);
                pathStr = `${p0x.toFixed(2)} ${p0y.toFixed(2)} m ${p1x.toFixed(2)} ${p1y.toFixed(2)} l ${p2x.toFixed(2)} ${p2y.toFixed(2)} l ${p3x.toFixed(2)} ${p3y.toFixed(2)} l h`;
              }
            } else if (tag === 'line') {
              const x1 = Number(p.x1 ?? p.attrs?.x1 ?? 0);
              const y1 = Number(p.y1 ?? p.attrs?.y1 ?? 0);
              const x2 = Number(p.x2 ?? p.attrs?.x2 ?? 0);
              const y2 = Number(p.y2 ?? p.attrs?.y2 ?? 0);
              const [p1x, p1y] = localTransformPt(x1, y1);
              const [p2x, p2y] = localTransformPt(x2, y2);
              pathStr = `${p1x.toFixed(2)} ${p1y.toFixed(2)} m ${p2x.toFixed(2)} ${p2y.toFixed(2)} l`;
            } else if (tag === 'polyline' || tag === 'polygon') {
              const pts = parseSvgPoints(p.points ?? p.attrs?.points ?? '');
              if (pts.length > 0) {
                const ops = [];
                const [s0x, s0y] = localTransformPt(pts[0][0], pts[0][1]);
                ops.push(`${s0x.toFixed(2)} ${s0y.toFixed(2)} m`);
                for (let pi = 1; pi < pts.length; pi++) {
                  const [px, py] = localTransformPt(pts[pi][0], pts[pi][1]);
                  ops.push(`${px.toFixed(2)} ${py.toFixed(2)} l`);
                }
                if (tag === 'polygon') ops.push('h');
                pathStr = ops.join(' ');
              }
            }

            if (pathStr) {
              const rawFill = p.fill ?? p.attrs?.fill ?? inheritedFill;
              const rawStroke = p.stroke ?? p.attrs?.stroke ?? inheritedStroke;
              const rawStrokeW = p.strokeWidth ?? p.attrs?.['stroke-width'] ?? p.lineWidth ?? inheritedStrokeWidth;
              const strokeW = Number(rawStrokeW ?? 1) * Math.min(scaleX, scaleY);
              const fillRgb = parseHexColor(rawFill !== undefined ? rawFill : (rawStroke ? null : '#000000'), currentColorRgb);
              const strokeRgb = parseHexColor(rawStroke, currentColorRgb);
              const fillOp = (p.fillRule === 'evenodd' || p.clipRule === 'evenodd') ? 'f*' : 'f';
              const bOp = (p.fillRule === 'evenodd' || p.clipRule === 'evenodd') ? 'B*' : 'B';

              if (fillRgb && strokeRgb && strokeW > 0) {
                cmds.push(`q ${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${strokeW.toFixed(2)} w 1 J 1 j ${pathStr} ${bOp} Q`);
              } else if (fillRgb) {
                cmds.push(`q ${fillRgb.map((v) => v.toFixed(3)).join(' ')} rg ${pathStr} ${fillOp} Q`);
              } else if (strokeRgb && strokeW > 0) {
                cmds.push(`q ${strokeRgb.map((v) => v.toFixed(3)).join(' ')} RG ${strokeW.toFixed(2)} w 1 J 1 j ${pathStr} S Q`);
              }
            }
          }
        };

        const paths = item.paths || (item.d ? [item] : []);
        renderElements(paths);
        cmds.push('Q');
      } else if (itype === 'image') {
        let rawData = null;
        let mime = '';
        if (typeof item.src === 'string' && item.src.startsWith('data:')) {
          const m = item.src.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
          if (m) {
            mime = (m[1] || '').toLowerCase();
            rawData = Buffer.from(m[2], 'base64');
          }
        } else if (Buffer.isBuffer(item.data)) {
          rawData = item.data;
        } else if (item.data instanceof Uint8Array) {
          rawData = Buffer.from(item.data.buffer, item.data.byteOffset, item.data.byteLength);
        } else if (typeof item.data === 'string') {
          rawData = Buffer.from(item.data, 'base64');
        }

        if (rawData && rawData.length > 0) {
          const isJpeg = item.format === 'jpeg' || item.format === 'jpg' || mime.includes('jpeg') || (rawData[0] === 0xff && rawData[1] === 0xd8);
          const isPng = item.format === 'png' || mime.includes('png') || (rawData[0] === 0x89 && rawData[1] === 0x50 && rawData[2] === 0x4e && rawData[3] === 0x47);

          let imgObjId = 0;
          let imgW = item.widthPx || item.w || 100;
          let imgH = item.heightPx || item.h || 100;

          if (isJpeg) {
            const dims = parseJpegDimensions(rawData);
            if (dims) {
              imgW = item.widthPx || dims.width;
              imgH = item.heightPx || dims.height;
            }
            imgObjId = addObj({
              dict: `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${rawData.length} >>`,
              stream: rawData,
            });
          } else if (isPng) {
            try {
              const png = parsePng(rawData);
              imgW = item.widthPx || png.width;
              imgH = item.heightPx || png.height;

              let smaskRef = '';
              if (png.alpha) {
                const deflatedAlpha = zlib.deflateSync(png.alpha);
                const smaskId = addObj({
                  dict: `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${deflatedAlpha.length} >>`,
                  stream: deflatedAlpha,
                });
                smaskRef = ` /SMask ${smaskId} 0 R`;
              }

              const deflatedRgb = zlib.deflateSync(png.rgb);
              imgObjId = addObj({
                dict: `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8${smaskRef} /Filter /FlateDecode /Length ${deflatedRgb.length} >>`,
                stream: deflatedRgb,
              });
            } catch {
              // Fallback to raw DCT/Flate if PNG parsing fails
              const deflated = zlib.deflateSync(rawData);
              imgObjId = addObj({
                dict: `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${deflated.length} >>`,
                stream: deflated,
              });
            }
          }

          if (imgObjId > 0) {
            const imgRef = `Im${pageImageSeq++}`;
            pageImageXObjects[imgRef] = imgObjId;
            const py = H - item.y - item.h;
            const hasOpacity = item.opacity !== undefined && item.opacity !== null && item.opacity < 1.0;
            let gsStr = '';
            if (hasOpacity) {
              const gs = getExtGStateAlpha(item.opacity);
              pageExtGStates[gs.name] = gs.id;
              gsStr = `/${gs.name} gs `;
            }
            cmds.push(`q ${gsStr}${item.w.toFixed(2)} 0 0 ${item.h.toFixed(2)} ${item.x.toFixed(2)} ${py.toFixed(2)} cm /${imgRef} Do Q`);
          }
        }
      }
    }

    // Add clickable hyperlink annotations if present on page
    const annotIds = [];
    for (const lnk of page.links || []) {
      const ay0 = H - lnk.y - lnk.h;
      const ay1 = H - lnk.y;
      const aid = addObj(
        `<< /Type /Annot /Subtype /Link /Rect [${lnk.x.toFixed(2)} ${ay0.toFixed(2)} ${(lnk.x + lnk.w).toFixed(2)} ${ay1.toFixed(2)}] /Border [0 0 0]${pdfa ? ' /F 4' : ''} /A << /S /URI /URI (${pdfEscapeText(lnk.url)}) >> >>`,
      );
      annotIds.push(aid);
    }
    const annotsEntry = annotIds.length > 0 ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]` : '';

    const streamStr = cmds.join('\n');
    let contentId;
    if (options.compress === true) {
      const deflated = zlib.deflateSync(Buffer.from(streamStr, 'utf8'));
      contentId = addObj({
        dict: `<< /Filter /FlateDecode /Length ${deflated.length} >>`,
        stream: deflated,
      });
    } else {
      const len = Buffer.byteLength(streamStr, 'utf8');
      contentId = addObj(`<< /Length ${len} >>\nstream\n${streamStr}\nendstream`);
    }

    const xobjEntries = Object.entries(pageImageXObjects);
    const xobjStr = xobjEntries.length > 0
      ? ` /XObject << ${xobjEntries.map(([name, id]) => `/${name} ${id} 0 R`).join(' ')} >>`
      : '';

    const fontEntries = pdfa ? [
      ...[...pageFontsUsed].filter((r) => pdfaFontStates.has(r)).sort().map((r) => `${r} ${pdfaFontStates.get(r).id} 0 R`),
      ...customFontEntries.filter((e) => pageFontsUsed.has(e.split(' ')[0])),
    ].join(' ') : [
      `/F1 ${fontRegularId} 0 R`,
      `/F2 ${fontBoldId} 0 R`,
      `/F3 ${fontMonoId} 0 R`,
      `/F4 ${fontItalicId} 0 R`,
      `/F5 ${fontTimesId} 0 R`,
      `/F6 ${fontTimesBoldId} 0 R`,
      `/F7 ${fontTimesItalicId} 0 R`,
      `/F8 ${fontMonoBoldId} 0 R`,
      ...customFontEntries,
    ].join(' ');

    const extGStateEntries = Object.entries(pageExtGStates);
    const extGStateStr = extGStateEntries.length > 0
      ? ` /ExtGState << ${extGStateEntries.map(([name, id]) => `/${name} ${id} 0 R`).join(' ')} >>`
      : '';

    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Resources << /Font << ${fontEntries} >>${xobjStr}${extGStateStr} >> /Contents ${contentId} 0 R${annotsEntry} >>`,
    );
    pageIds.push(pageId);
  }

  if (extraFilespecs.length) {
    const all = [...extraFilespecs, ...(filespecId ? [{ name: 'velox-payload.json', id: filespecId }] : [])];
    const sorted = [...all].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    objects[catalogId - 1].body = `<< /Type /Catalog /Pages ${pagesRootId} 0 R /Names << /EmbeddedFiles << /Names [${sorted.map((e) => `${pdfTextString(e.name)} ${e.id} 0 R`).join(' ')}] >> >> /AF [${all.map((e) => `${e.id} 0 R`).join(' ')}] >>`;
  } else if (filespecId) {
    objects[catalogId - 1].body = `<< /Type /Catalog /Pages ${pagesRootId} 0 R /Names << /EmbeddedFiles << /Names [(velox-payload.json) ${filespecId} 0 R] >> >> /AF [${filespecId} 0 R] >>`;
  } else {
    objects[catalogId - 1].body = `<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`;
  }
  objects[pagesRootId - 1].body = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  // PDF/A-3b: embedded subset fonts, OutputIntent, XMP metadata, Info dictionary, trailer /ID.
  let pdfaTrailerExtra = '';
  if (pdfa) {
    for (const st of pdfaFontStates.values()) {
      const f = st.font;
      const requested = st.order.length;
      const unicodes = new Map(st.unicodes);
      const sub = subsetTrueType(f.rawBytes, st.order, { unicodes });
      const baseName = `${subsetTag(`${st.spec.file}:${st.order.join(',')}`)}+${f.fontName}`;
      const fontFile = zlib.deflateSync(Buffer.from(sub.bytes));
      const fontFileId = addObj({
        dict: `<< /Filter /FlateDecode /Length ${fontFile.length} /Length1 ${sub.bytes.length} >>`,
        stream: fontFile,
      });
      const k = 1000 / (f.unitsPerEm || 1000);
      const sc = (v) => Math.round(v * k);
      const descId = addObj(
        `<< /Type /FontDescriptor /FontName /${baseName} /Flags ${st.spec.flags} /FontBBox [${f.bbox.map(sc).join(' ')}] /ItalicAngle ${f.italicAngle} /Ascent ${sc(f.ascent)} /Descent ${sc(f.descent)} /CapHeight ${sc(f.capHeight)} /StemV ${st.spec.file.includes('Bold') ? 120 : 80} /FontFile2 ${fontFileId} 0 R >>`,
      );
      const widths = [];
      for (let g = 0; g < requested; g++) widths.push(f.widths.get(st.order[g]) ?? 0);
      const cidId = addObj(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descId} 0 R /CIDToGIDMap /Identity /DW 1000 /W [0 [${widths.join(' ')}]] >>`,
      );
      const toUni = Buffer.from(generateToUnicodeCMap(unicodes, f.fontName), 'utf8');
      const toUniId = addObj({ dict: `<< /Length ${toUni.length} >>`, stream: toUni });
      objects[st.id - 1].body = `<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUniId} 0 R >>`;
    }

    const icc = Buffer.from(SRGB_ICC_BASE64, 'base64');
    const iccId = addObj({ dict: `<< /N 3 /Length ${icc.length} >>`, stream: icc });
    const intentId = addObj(
      `<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /Info (sRGB IEC61966-2.1) /DestOutputProfile ${iccId} 0 R >>`,
    );

    const dates = pdfaDates(options.creationDate);
    const title = String(options.title || 'Untitled');
    const author = String(options.author || 'VeloxPDF');
    const producer = 'VeloxPDF';
    const creatorTool = 'VeloxPDF';
    // Document identity: digest of every object written so far plus the timestamp.
    const idBytes = digest128([
      dates.xmp,
      title,
      ...objects.map((o) => (o.stream !== undefined ? (Buffer.isBuffer(o.stream) ? o.stream : String(o.stream)) : (Buffer.isBuffer(o.body) ? o.body : String(o.body)))),
    ]);
    const idHex = idBytes.toString('hex').toUpperCase();
    const xmp = Buffer.from(buildPdfaXmp({
      title,
      author,
      producer,
      creatorTool,
      dates,
      documentId: uuidFromBytes(idBytes),
      instanceId: uuidFromBytes(digest128([idBytes, 'instance'])),
      extraXmp: options.extraXmp,
    }), 'utf8');
    const metadataId = addObj({ dict: `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>`, stream: xmp });
    const infoId = addObj(
      `<< /Title ${pdfTextString(title)} /Author ${pdfTextString(author)} /Creator (${creatorTool}) /Producer (${producer}) /CreationDate (${dates.pdf}) /ModDate (${dates.pdf}) >>`,
    );
    const catBody = objects[catalogId - 1].body;
    objects[catalogId - 1].body = `${catBody.slice(0, -2)}/Metadata ${metadataId} 0 R /OutputIntents [${intentId} 0 R] >>`;
    pdfaTrailerExtra = ` /Info ${infoId} 0 R /ID [<${idHex}> <${idHex}>]`;
  }

  const header = Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks = [header];
  let currentOffset = header.length;
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(currentOffset);
    let objBuf;
    if (obj.stream !== undefined) {
      const prefix = Buffer.from(`${obj.id} 0 obj\n${obj.dict}\nstream\n`, 'latin1');
      const streamBuf = Buffer.isBuffer(obj.stream) ? obj.stream : Buffer.from(obj.stream, 'latin1');
      const suffix = Buffer.from('\nendstream\nendobj\n', 'latin1');
      objBuf = Buffer.concat([prefix, streamBuf, suffix]);
    } else if (Buffer.isBuffer(obj.body)) {
      const prefix = Buffer.from(`${obj.id} 0 obj\n`, 'latin1');
      const suffix = Buffer.from('\nendobj\n', 'latin1');
      objBuf = Buffer.concat([prefix, obj.body, suffix]);
    } else {
      objBuf = Buffer.from(`${obj.id} 0 obj\n${obj.body}\nendobj\n`, 'latin1');
    }
    chunks.push(objBuf);
    currentOffset += objBuf.length;
  }

  const xrefPos = currentOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xrefStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R${pdfaTrailerExtra} >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  chunks.push(Buffer.from(xrefStr, 'latin1'));

  return new Uint8Array(Buffer.concat(chunks));
}

export const writePdfDocument = compilePagesToPdf;
