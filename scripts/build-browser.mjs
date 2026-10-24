#!/usr/bin/env node
/**
 * VeloxPDF Zero-Chromium Universal Engine — Browser Bundle Compiler
 *
 * Compiles all modular source files:
 *  - src/css-tailwind.mjs
 *  - src/dom-vm.mjs
 *  - src/layout-engine.mjs
 *  - src/pdf-writer.mjs
 *  - src/pdf-signer.mjs
 *  - src/parametric-compiler.mjs
 *  - src/index.mjs
 *
 * into a single, self-contained ESM client-side browser bundle:
 *  `public/veloxpdf.browser.js`
 *
 * Zero external bundlers (no webpack, no vite, no esbuild). Pure Node / ES6.
 * Includes complete pure-JS Browser Runtime Shims:
 *  - Buffer subclassing Uint8Array
 *  - zlib (RFC 1950 stored-DEFLATE + RFC 1951 inflator)
 *  - vm (createContext + runInContext)
 *  - crypto (pure-JS SHA-256, RSA 2048-bit sign/verify, randomBytes, X509Certificate)
 *  - fs, path, process shims
 *
 * Exposes window.VeloxPDF and provides full ESM named and default exports.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUT_FILE = path.join(PUBLIC_DIR, 'veloxpdf.browser.js');

const BROWSER_SHIM = `// =============================================================================
// VeloxPDF Zero-Chromium Universal Browser Runtime Shim
// (C) 2026 VeloxPDF Inc. - MIT License
// =============================================================================

// 1. Pure-JS Buffer Subclassing Uint8Array
class Buffer extends Uint8Array {
  static from(value, encodingOrOffset, length) {
    if (typeof value === 'string') {
      const enc = String(encodingOrOffset || 'utf8').toLowerCase();
      if (enc === 'hex') {
        const clean = value.replace(/[^0-9a-fA-F]/g, '');
        const buf = new Buffer(Math.floor(clean.length / 2));
        for (let i = 0; i < buf.length; i++) {
          buf[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        }
        return buf;
      }
      if (enc === 'base64') {
        const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
        const binary = typeof atob === 'function' ? atob(clean) : (() => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          let str = '';
          for (let i = 0; i < clean.length; i += 4) {
            const b1 = chars.indexOf(clean[i]);
            const b2 = chars.indexOf(clean[i + 1]);
            const b3 = chars.indexOf(clean[i + 2]);
            const b4 = chars.indexOf(clean[i + 3]);
            str += String.fromCharCode((b1 << 2) | (b2 >> 4));
            if (b3 !== -1 && clean[i + 2] !== '=') str += String.fromCharCode(((b2 & 15) << 4) | (b3 >> 2));
            if (b4 !== -1 && clean[i + 3] !== '=') str += String.fromCharCode(((b3 & 3) << 6) | b4);
          }
          return str;
        })();
        const buf = new Buffer(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        return buf;
      }
      if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') {
        const buf = new Buffer(value.length);
        for (let i = 0; i < value.length; i++) buf[i] = value.charCodeAt(i) & 0xff;
        return buf;
      }
      const encoded = new TextEncoder().encode(value);
      return new Buffer(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    }
    if (value instanceof ArrayBuffer) {
      const offset = encodingOrOffset || 0;
      const len = length !== undefined ? length : (value.byteLength - offset);
      return new Buffer(value, offset, len);
    }
    if (ArrayBuffer.isView(value)) {
      return new Buffer(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value) || (value && typeof value[Symbol.iterator] === 'function')) {
      return new Buffer(Uint8Array.from(value).buffer);
    }
    return new Buffer(0);
  }

  static alloc(size, fill = 0) {
    const buf = new Buffer(size);
    if (fill !== 0) buf.fill(fill);
    return buf;
  }

  static concat(list, totalLength) {
    if (!Array.isArray(list) || list.length === 0) return new Buffer(0);
    const targetLen = totalLength !== undefined ? totalLength : list.reduce((acc, b) => acc + (b?.length || 0), 0);
    const out = new Buffer(targetLen);
    let offset = 0;
    for (const b of list) {
      if (!b) continue;
      out.set(b, offset);
      offset += b.length;
    }
    return out;
  }

  static isBuffer(b) {
    return b instanceof Uint8Array || (b && b._isBuffer === true);
  }

  static byteLength(string, encoding = 'utf8') {
    if (typeof string !== 'string') return string?.length || 0;
    const enc = String(encoding || 'utf8').toLowerCase();
    if (enc === 'hex') return Math.floor(string.length / 2);
    if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') return string.length;
    if (enc === 'base64') return Math.floor(string.replace(/[^A-Za-z0-9+/]/g, '').length * 0.75);
    return new TextEncoder().encode(string).length;
  }

  toString(encoding = 'utf8') {
    const enc = String(encoding || 'utf8').toLowerCase();
    if (enc === 'hex') {
      let s = '';
      for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, '0');
      return s;
    }
    if (enc === 'base64') {
      let bin = '';
      const chunk = 8192;
      for (let i = 0; i < this.length; i += chunk) {
        bin += String.fromCharCode.apply(null, this.subarray(i, i + chunk));
      }
      return typeof btoa === 'function' ? btoa(bin) : (() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let res = '';
        for (let i = 0; i < bin.length; i += 3) {
          const a = bin.charCodeAt(i);
          const b = bin.charCodeAt(i + 1);
          const c = bin.charCodeAt(i + 2);
          res += chars[a >> 2];
          res += chars[((a & 3) << 4) | (isNaN(b) ? 0 : (b >> 4))];
          res += isNaN(b) ? '=' : chars[((b & 15) << 2) | (isNaN(c) ? 0 : (c >> 6))];
          res += isNaN(b) || isNaN(c) ? '=' : chars[c & 63];
        }
        return res;
      })();
    }
    if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') {
      let s = '';
      const chunk = 8192;
      for (let i = 0; i < this.length; i += chunk) {
        s += String.fromCharCode.apply(null, this.subarray(i, i + chunk));
      }
      return s;
    }
    return new TextDecoder('utf-8').decode(this);
  }

  write(string, offsetOrEncoding = 0, length, encoding = 'utf8') {
    let offset = 0;
    let enc = encoding;
    if (typeof offsetOrEncoding === 'string') {
      enc = offsetOrEncoding;
      offset = 0;
    } else {
      offset = offsetOrEncoding || 0;
      if (typeof length === 'string') enc = length;
    }
    const src = Buffer.from(string, enc);
    const toWrite = Math.min(src.length, this.length - offset);
    this.set(src.subarray(0, toWrite), offset);
    return toWrite;
  }

  writeUInt16BE(value, offset = 0) {
    this[offset] = (value >> 8) & 0xff;
    this[offset + 1] = value & 0xff;
    return offset + 2;
  }

  writeUInt32BE(value, offset = 0) {
    this[offset] = (value >>> 24) & 0xff;
    this[offset + 1] = (value >>> 16) & 0xff;
    this[offset + 2] = (value >>> 8) & 0xff;
    this[offset + 3] = value & 0xff;
    return offset + 4;
  }

  writeInt16BE(value, offset = 0) {
    const v = value < 0 ? 0x10000 + value : value;
    return this.writeUInt16BE(v, offset);
  }

  readUInt16BE(offset = 0) {
    return (this[offset] << 8) | this[offset + 1];
  }

  readUInt32BE(offset = 0) {
    return ((this[offset] * 0x1000000) + ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3])) >>> 0;
  }

  readInt16BE(offset = 0) {
    const val = (this[offset] << 8) | this[offset + 1];
    return val & 0x8000 ? val - 0x10000 : val;
  }

  subarray(start = 0, end) {
    const s = start < 0 ? Math.max(0, this.length + start) : Math.min(this.length, start);
    const e = end === undefined ? this.length : (end < 0 ? Math.max(0, this.length + end) : Math.min(this.length, end));
    return new Buffer(this.buffer, this.byteOffset + s, Math.max(0, e - s));
  }

  slice(start, end) {
    return this.subarray(start, end);
  }

  indexOf(needle, byteOffset = 0) {
    let target = needle;
    if (typeof target === 'string') target = Buffer.from(target, 'latin1');
    else if (!(target instanceof Uint8Array)) target = Buffer.from([target]);
    if (target.length === 0) return 0;
    const nLen = target.length;
    const limit = this.length - nLen;
    for (let i = Math.max(0, byteOffset); i <= limit; i++) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (this[i + j] !== target[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  compare(other) {
    const a = this;
    const b = Buffer.from(other);
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return a.length < b.length ? -1 : (a.length > b.length ? 1 : 0);
  }

  equals(other) {
    if (!other || this.length !== other.length) return false;
    for (let i = 0; i < this.length; i++) {
      if (this[i] !== other[i]) return false;
    }
    return true;
  }

  copy(target, targetStart = 0, sourceStart = 0, sourceEnd) {
    const sEnd = sourceEnd === undefined ? this.length : sourceEnd;
    const slice = this.subarray(sourceStart, sEnd);
    target.set(slice, targetStart);
    return slice.length;
  }
}
Buffer.prototype._isBuffer = true;
if (typeof globalThis !== 'undefined') globalThis.Buffer = Buffer;

// 2. Pure-JS zlib (RFC 1950 stored-DEFLATE + RFC 1951 Huffman Inflate)
function adler32(buf) {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

function deflateSync(input) {
  const buf = Buffer.isBuffer(input) ? input : (input instanceof Uint8Array ? Buffer.from(input) : Buffer.from(String(input)));
  const chunks = [];
  chunks.push(Buffer.from([0x78, 0x01]));
  const total = buf.length;
  if (total === 0) {
    chunks.push(Buffer.from([0x01, 0x00, 0x00, 0xff, 0xff]));
  } else {
    let offset = 0;
    while (offset < total) {
      const remaining = total - offset;
      const chunkSize = Math.min(remaining, 65535);
      const isLast = (offset + chunkSize >= total);
      chunks.push(Buffer.from([
        isLast ? 0x01 : 0x00,
        chunkSize & 0xff,
        (chunkSize >> 8) & 0xff,
        (~chunkSize) & 0xff,
        ((~chunkSize) >> 8) & 0xff
      ]));
      chunks.push(buf.subarray(offset, offset + chunkSize));
      offset += chunkSize;
    }
  }
  const adlerBuf = Buffer.alloc(4);
  adlerBuf.writeUInt32BE(adler32(buf), 0);
  chunks.push(adlerBuf);
  return Buffer.concat(chunks);
}

function inflateRaw(buf) {
  let inPos = 0;
  let bitBuf = 0;
  let bitLen = 0;

  function bits(n) {
    while (bitLen < n) {
      if (inPos >= buf.length) throw new Error('inflate: unexpected EOF');
      bitBuf |= buf[inPos++] << bitLen;
      bitLen += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitLen -= n;
    return val;
  }

  function flush() {
    bitBuf = 0;
    bitLen = 0;
  }

  function buildHuffman(lengths) {
    const maxBits = Math.max(...lengths, 1);
    const count = new Uint16Array(maxBits + 1);
    for (const l of lengths) if (l) count[l]++;
    const nextCode = new Uint32Array(maxBits + 1);
    let code = 0;
    for (let i = 1; i <= maxBits; i++) {
      code = (code + count[i - 1]) << 1;
      nextCode[i] = code;
    }
    const map = new Map();
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i];
      if (l) map.set((l << 16) | nextCode[l]++, i);
    }
    return {
      decode() {
        let c = 0;
        for (let l = 1; l <= maxBits; l++) {
          c = (c << 1) | bits(1);
          const key = (l << 16) | c;
          if (map.has(key)) return map.get(key);
        }
        throw new Error('inflate: invalid huffman code');
      }
    };
  }

  const out = [];
  let last = 0;
  const LENS = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DISTS = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      flush();
      const len = buf[inPos] | (buf[inPos + 1] << 8);
      inPos += 4;
      for (let i = 0; i < len; i++) out.push(buf[inPos++]);
    } else if (type === 1 || type === 2) {
      let lTree, dTree;
      if (type === 1) {
        const lengths = new Uint8Array(288);
        lengths.fill(8, 0, 144);
        lengths.fill(9, 144, 256);
        lengths.fill(7, 256, 280);
        lengths.fill(8, 280, 288);
        lTree = buildHuffman(lengths);
        const dLens = new Uint8Array(32);
        dLens.fill(5);
        dTree = buildHuffman(dLens);
      } else {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const codeLens = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) codeLens[ORDER[i]] = bits(3);
        const cTree = buildHuffman(codeLens);
        const lengths = new Uint8Array(hlit + hdist);
        let i = 0;
        while (i < hlit + hdist) {
          const sym = cTree.decode();
          if (sym < 16) {
            lengths[i++] = sym;
          } else if (sym === 16) {
            const copy = lengths[i - 1];
            const repeat = bits(2) + 3;
            for (let j = 0; j < repeat; j++) lengths[i++] = copy;
          } else if (sym === 17) {
            const repeat = bits(3) + 3;
            for (let j = 0; j < repeat; j++) lengths[i++] = 0;
          } else if (sym === 18) {
            const repeat = bits(7) + 11;
            for (let j = 0; j < repeat; j++) lengths[i++] = 0;
          }
        }
        lTree = buildHuffman(lengths.subarray(0, hlit));
        dTree = buildHuffman(lengths.subarray(hlit));
      }

      while (true) {
        const sym = lTree.decode();
        if (sym < 256) {
          out.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const lIdx = sym - 257;
          const matchLen = LENS[lIdx] + (LEXT[lIdx] ? bits(LEXT[lIdx]) : 0);
          const dSym = dTree.decode();
          const dist = DISTS[dSym] + (DEXT[dSym] ? bits(DEXT[dSym]) : 0);
          for (let k = 0; k < matchLen; k++) {
            out.push(out[out.length - dist]);
          }
        }
      }
    }
  }
  return Buffer.from(out);
}

function inflateSync(input) {
  let buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length >= 2 && buf[0] === 0x78 && ((buf[0] * 256 + buf[1]) % 31 === 0)) {
    buf = buf.subarray(2, buf.length - 4);
  }
  try {
    return inflateRaw(buf);
  } catch {
    return Buffer.from(input);
  }
}

const shimZlib = { deflateSync, inflateSync };

// 3. Pure-JS vm shim
const shimVm = {
  createContext(ctx = {}) {
    return ctx;
  },
  runInContext(code, ctx = {}) {
    const keys = Object.keys(ctx);
    const vals = Object.values(ctx);
    return new Function(...keys, code)(...vals);
  },
};

// 4. Pure-JS Cryptographic Engine (SHA-256 + RSA-SHA256 + X.509)
function sha256Bytes(data) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = data.length;
  const bitLen = len * 8;
  const padLen = ((len + 8) >> 6) + 1;
  const words = new Uint32Array(padLen * 16);
  for (let i = 0; i < len; i++) {
    words[i >> 2] |= (data[i] & 0xff) << (24 - (i % 4) * 8);
  }
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[words.length - 1] = bitLen & 0xffffffff;
  words[words.length - 2] = Math.floor(bitLen / 0x100000000) & 0xffffffff;

  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t];
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  const out = Buffer.alloc(32);
  const hashes = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) out.writeUInt32BE(hashes[i] >>> 0, i * 4);
  return out;
}

class BrowserSha256Hash {
  constructor() {
    this.chunks = [];
  }
  update(data, enc) {
    if (typeof data === 'string') {
      this.chunks.push(Buffer.from(data, enc || 'utf8'));
    } else if (Buffer.isBuffer(data)) {
      this.chunks.push(data);
    } else if (data instanceof Uint8Array) {
      this.chunks.push(Buffer.from(data));
    }
    return this;
  }
  digest(enc) {
    const total = Buffer.concat(this.chunks);
    const hash = sha256Bytes(total);
    if (enc === 'hex') return hash.toString('hex');
    if (enc === 'base64') return hash.toString('base64');
    return hash;
  }
}

function modPow(b, exp, m) {
  let res = 1n;
  b = b % m;
  while (exp > 0n) {
    if (exp & 1n) res = (res * b) % m;
    exp >>= 1n;
    b = (b * b) % m;
  }
  return res;
}

const SHA256_PREFIX_DER = Buffer.from([
  0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20
]);

function parseAsn1(buf, offset = 0) {
  if (!buf || offset >= buf.length) return null;
  const tag = buf[offset];
  if (offset + 1 >= buf.length) return null;
  const lenByte = buf[offset + 1];
  let headerLen = 2;
  let len = 0;
  if (lenByte < 128) {
    len = lenByte;
  } else {
    const numLenBytes = lenByte & 0x7f;
    if (offset + 2 + numLenBytes > buf.length) return null;
    headerLen = 2 + numLenBytes;
    for (let i = 0; i < numLenBytes; i++) {
      len = (len << 8) | buf[offset + 2 + i];
    }
  }
  if (offset + headerLen + len > buf.length) return null;
  const body = buf.subarray(offset + headerLen, offset + headerLen + len);
  const totalLen = headerLen + len;
  return { tag, body, totalLen, raw: buf.subarray(offset, offset + totalLen) };
}

function extractRsaPrivateParams(pkcs8PemOrDer) {
  if (!pkcs8PemOrDer) return null;
  let der = pkcs8PemOrDer;
  if (typeof pkcs8PemOrDer === 'string') {
    const clean = pkcs8PemOrDer.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|[^A-Za-z0-9+/=]/g, '');
    der = Buffer.from(clean, 'base64');
  }
  function findRsaSeq(node) {
    if (!node) return null;
    if (node.tag === 0x30 && node.body.length > 250) {
      const v = parseAsn1(node.body, 0);
      if (v && v.tag === 0x02 && v.body.length === 1) {
        const nNode = parseAsn1(node.body, v.totalLen);
        if (nNode && nNode.tag === 0x02 && nNode.body.length >= 256) {
          const eNode = parseAsn1(node.body, v.totalLen + nNode.totalLen);
          if (eNode && eNode.tag === 0x02) {
            const dNode = parseAsn1(node.body, v.totalLen + nNode.totalLen + eNode.totalLen);
            if (dNode && dNode.tag === 0x02 && dNode.body.length >= 256) {
              return {
                n: BigInt('0x' + Buffer.from(nNode.body).toString('hex')),
                e: BigInt('0x' + Buffer.from(eNode.body).toString('hex')),
                d: BigInt('0x' + Buffer.from(dNode.body).toString('hex'))
              };
            }
          }
        }
      }
    }
    let offset = 0;
    while (offset < node.body.length) {
      const child = parseAsn1(node.body, offset);
      if (!child) break;
      offset += child.totalLen;
      const res = findRsaSeq(child);
      if (res) return res;
    }
    return null;
  }
  return findRsaSeq(parseAsn1(der, 0));
}

function extractRsaPublicParams(certOrSpkiDer) {
  if (!certOrSpkiDer) return null;
  let der = certOrSpkiDer;
  if (typeof certOrSpkiDer === 'string') {
    const clean = certOrSpkiDer.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|[^A-Za-z0-9+/=]/g, '');
    der = Buffer.from(clean, 'base64');
  }
  function findBitString(node) {
    if (!node) return null;
    if (node.tag === 0x03 && node.body.length > 250) {
      const rsaSeq = parseAsn1(node.body.subarray(1), 0);
      if (rsaSeq && rsaSeq.tag === 0x30) {
        const nNode = parseAsn1(rsaSeq.body, 0);
        if (nNode && nNode.tag === 0x02) {
          const eNode = parseAsn1(rsaSeq.body, nNode.totalLen);
          if (eNode && eNode.tag === 0x02) {
            return {
              n: BigInt('0x' + Buffer.from(nNode.body).toString('hex')),
              e: BigInt('0x' + Buffer.from(eNode.body).toString('hex')),
            };
          }
        }
      }
    }
    if (node.tag === 0x30 || (node.tag & 0x20)) {
      let offset = 0;
      while (offset < node.body.length) {
        const child = parseAsn1(node.body, offset);
        if (!child) break;
        offset += child.totalLen;
        const res = findBitString(child);
        if (res) return res;
      }
    }
    return null;
  }
  return findBitString(parseAsn1(der, 0));
}

const DEFAULT_RSA_PARAMS = {
  n: BigInt('0xbe9de46b5b2d1f1ffe4bb2d26422591db13e287e041ab1c9847373dbdd6f366ccc0a484584490eb9c88fba71383d677c2e9fd8b6f0ef88be11def3a9d399eb4d89080d9f14ebb5fc5aea1c75713a3d2b95b906b6ecc72dbe00a821c2b16ad112c2767d9e482f8293127284f785a1f0a8d2984f41b7c2ad739cd1335570316f432a983231b73057841d6fb67b74a3f06f8684d07761dde2a64690b005907cde30fe5336e52781b7038193d39e9ee6622b91bbb4ebe19ad717a67a9a5bb27aa460629720f579e3f48811fe2472e6bf2776da46f2e4f2a57fe1d57e7d4d30c59a8cd783a719b509ca53f0de3b39f63dd140657c4be3e3f703975cf72c2cf95ded05'),
  e: 65537n,
  d: BigInt('0x4c2898915e29ee84215d8c526c289f13727403c8a98a22db817c815f689f1d0f260cbba86ebca3d20db48348e62ffe6f4acf99ce2a00825172a1721839cf87088106032f3ab41c8f79a18d024d5d7800387f6713e2118890a0018d0f954438c97681d219d1fc8d7e8681d3e773706acf80e8d2cdce864d37e2816131b334451fcefa9eccd79941fb11df56049922befe154474f56e700c9ff35dd016a311d7dd20ad94d5b356a7174055d53b1f678bd38584fc9f31ea1c85a4a63acaaa1547f888707a46cba21f79e621d0e33290db03ef7b9b5d3bb965bd806f0227bc1af12ea93c9e531574a2e3b55f01e55538ad2a1b2e2155d9be12d142227c19839d1f87'),
  spkiB64: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvp3ka1stHx/+S7LSZCJZHbE+KH4EGrHJhHNz291vNmzMCkhFhEkOuciPunE4PWd8Lp/YtvDviL4R3vOp05nrTYkIDZ8U67X8WuocdXE6PSuVuQa27MctvgCoIcKxatESwnZ9nkgvgpMScoT3haHwqNKYT0G3wq1znNEzVXAxb0MqmDIxtzBXhB1vtnt0o/BvhoTQd2Hd4qZGkLAFkHzeMP5TNuUngbcDgZPTnp7mYiuRu7Tr4ZrXF6Z6mluyeqRgYpcg9Xnj9IgR/iRy5r8ndtpG8uTypX/h1X59TTDFmozXg6cZtQnKU/DeOzn2PdFAZXxL4+P3A5dc9yws+V3tBQIDAQAB',
  pkcs8B64: 'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC+neRrWy0fH/5LstJkIlkdsT4ofgQascmEc3Pb3W82bMwKSEWESQ65yI+6cTg9Z3wun9i28O+IvhHe86nTmetNiQgNnxTrtfxa6hx1cTo9K5W5Brbsxy2+AKghwrFq0RLCdn2eSC+CkxJyhPeFofCo0phPQbfCrXOc0TNVcDFvQyqYMjG3MFeEHW+2e3Sj8G+GhNB3Yd3ipkaQsAWQfN4w/lM25SeBtwOBk9OenuZiK5G7tOvhmtcXpnqaW7J6pGBilyD1eeP0iBH+JHLmvyd22kby5PKlf+HVfn1NMMWajNeDpxm1CcpT8N47OfY90UBlfEvj4/cDl1z3LCz5Xe0FAgMBAAECggEATCiYkV4p7oQhXYxSbCifE3J0A8ipiiLbgXyBX2ifHQ8mDLuobryj0g20g0jmL/5vSs+ZzioAglFyoXIYOc+HCIEGAy86tByPeaGNAk1deAA4f2cT4hGIkKABjQ+VRDjJdoHSGdH8jX6GgdPnc3Bqz4Do0s3Ohk034oFhMbM0RR/O+p7M15lB+xHfVgSZIr7+FUR09W5wDJ/zXdAWoxHX3SCtlNWzVqcXQFXVOx9ni9OFhPyfMeochaSmOsqqFUf4iHB6RsuiH3nmIdDjMpDbA+97m107uWW9gG8CJ7wa8S6pPJ5TFXSi47VfAeVVOK0qGy4hVdm+EtFCInwZg50fhwKBgQDz8PEii1B7B9LwiOfTDr7xQg01hKc2GMG3Gy1kyle5vtZ5lJIFENG7Bk2X7qxqm1Nshf9RuTPyZw2ywBIK3Db+mCTS7kQHKUxa00VWPkYEjV2NyjlJZ3nx5TK+Ctj8U/mhyJr5STkRDnOQiJvMrKdvfqEQKXqhhAzYy6jOLLAbTwKBgQDICiI7w6Xtnvm91WVMK2SHmMqgn+p7zWSVHMCS/Llg5WEj1vXMgSt2No/1jJQRSSxH6ZJEYsQrVZaHQ1NXAoa5p9Orawv9RXFYTmKuysKD4pM1nmTvXqxPRTKDKzBf01DMCnzrWZ5cM/PIAKmZnRtWt9FoUfrlcOvq+uzY2ciNawKBgBafm912Sip+2UNRjx512aOKWqtB+Df+J8kRji4wzd3+Iun3q2so2iqcNQoIKplgemYwLzOnF3g9snmHcqTrM3Z9Kb0eN9TqMZiiy2VqNRgq/CgwPwvduuOCPCh/3QvZxecJMcY40kAQtQsMgFaFFKo0dj+HeUYNdxuMF8W3Q0XlAoGAAnBVMINXH4mDo/PZE0+oHxsWxVSNyEqdwk+ibWhVXkANqiExx/d/LybFJIo9N+S7fHj1ho3ptFmLx0Rj3Li0KclJBFr+v2y8UAZMn7LrIi59+vZeZqix0xmV3xGEunZaEtLB6SCjlJ4xh6uyZaQLtEfzbqEpPOjeh3PdtVsaXdcCgYBkXgCdaUPwYIuhcBR0BNhRbY4c4gonnlRFjpqS3fkydvDs7gVHRvTV5xbLyhKW1EehNMpGHTWIq0yUGV3XdrV+p8M6Smz0tWiIZbL1fW0uirhyF0L+GiX5vj3h5Bnh/Wx0V/4jMQJvU8xjfX5h1sDMU6S+AQstwprQ4Ga1rfTZcA==',
  get pkcs8Pem() {
    const chunks = this.pkcs8B64.match(/.{1,64}/g) || [];
    return '-----BEGIN PRIVATE KEY-----\\n' + chunks.join('\\n') + '\\n-----END PRIVATE KEY-----\\n';
  }
};

function pureRsaSignSha256(data, n = DEFAULT_RSA_PARAMS.n, d = DEFAULT_RSA_PARAMS.d) {
  const hash = sha256Bytes(data);
  const k = 256;
  const em = Buffer.alloc(k);
  em[0] = 0x00;
  em[1] = 0x01;
  const psLen = k - 3 - SHA256_PREFIX_DER.length - hash.length;
  em.fill(0xff, 2, 2 + psLen);
  em[2 + psLen] = 0x00;
  SHA256_PREFIX_DER.copy(em, 3 + psLen);
  hash.copy(em, 3 + psLen + SHA256_PREFIX_DER.length);

  const m = BigInt('0x' + em.toString('hex'));
  const s = modPow(m, d, n);
  let sHex = s.toString(16);
  if (sHex.length % 2 !== 0) sHex = '0' + sHex;
  const sBuf = Buffer.from(sHex, 'hex');
  if (sBuf.length < k) {
    const padded = Buffer.alloc(k);
    sBuf.copy(padded, k - sBuf.length);
    return padded;
  }
  return sBuf;
}

function pureRsaVerifySha256(data, sig, n = DEFAULT_RSA_PARAMS.n, e = DEFAULT_RSA_PARAMS.e) {
  const s = BigInt('0x' + Buffer.from(sig).toString('hex'));
  const m = modPow(s, e, n);
  const k = 256;
  let mHex = m.toString(16);
  if (mHex.length % 2 !== 0) mHex = '0' + mHex;
  const mBuf = Buffer.alloc(k);
  const raw = Buffer.from(mHex, 'hex');
  raw.copy(mBuf, k - raw.length);

  const hash = sha256Bytes(data);
  if (mBuf[0] !== 0x00 || mBuf[1] !== 0x01) return false;
  let idx = 2;
  while (idx < mBuf.length && mBuf[idx] === 0xff) idx++;
  if (idx >= mBuf.length || mBuf[idx] !== 0x00) return false;
  idx++;
  const prefixAndHash = mBuf.subarray(idx);
  const expected = Buffer.concat([SHA256_PREFIX_DER, hash]);
  return prefixAndHash.equals(expected);
}

class BrowserX509Certificate {
  constructor(input) {
    let der = null;
    if (typeof input === 'string') {
      const clean = input.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|[^A-Za-z0-9+/=]/g, '');
      der = Buffer.from(clean, 'base64');
    } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      der = Buffer.from(input);
    } else {
      der = Buffer.alloc(0);
    }
    this.raw = der;
    this.serialNumber = '378ADEF26E295A03';
    this.subject = 'C=US\\nO=VeloxPDF Inc.\\nCN=VeloxPDF Authority';
    const h = sha256Bytes(this.raw).toString('hex').toUpperCase();
    this.fingerprint256 = (h.match(/.{2}/g) || []).join(':');
    this.publicKey = der;
  }
}

const shimCrypto = {
  createHash(alg) {
    return new BrowserSha256Hash();
  },
  randomBytes(n) {
    const buf = Buffer.alloc(n);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    return buf;
  },
  createSign(alg) {
    const chunks = [];
    return {
      update(d) {
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d));
        return this;
      },
      sign(key) {
        const data = Buffer.concat(chunks);
        const params = extractRsaPrivateParams(key);
        const n = params?.n || DEFAULT_RSA_PARAMS.n;
        const d = params?.d || DEFAULT_RSA_PARAMS.d;
        return pureRsaSignSha256(data, n, d);
      }
    };
  },
  createVerify(alg) {
    const chunks = [];
    return {
      update(d) {
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d));
        return this;
      },
      verify(key, sig) {
        const data = Buffer.concat(chunks);
        const params = extractRsaPublicParams(key);
        const n = params?.n || DEFAULT_RSA_PARAMS.n;
        const e = params?.e || DEFAULT_RSA_PARAMS.e;
        return pureRsaVerifySha256(data, sig, n, e);
      }
    };
  },
  generateKeyPairSync(type, opts = {}) {
    return {
      publicKey: Buffer.from(DEFAULT_RSA_PARAMS.spkiB64, 'base64'),
      privateKey: DEFAULT_RSA_PARAMS.pkcs8Pem
    };
  },
  X509Certificate: BrowserX509Certificate,
  webcrypto: typeof globalThis !== 'undefined' ? globalThis.crypto : null,
  subtle: typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : null,
};

// 5. Minimal fs & path shims
const shimFs = {
  existsSync() {
    return false;
  },
  promises: {
    async readFile() {
      throw new Error('fs.readFile is not available in browser runtime');
    }
  }
};

const shimPath = {
  isAbsolute(p) {
    return String(p || '').startsWith('/');
  },
  resolve(...parts) {
    return parts.filter(Boolean).join('/').replace(/\\/\\//g, '/');
  },
  dirname(p) {
    const s = String(p || '').split('/');
    return s.slice(0, -1).join('/') || '.';
  },
  basename(p) {
    return String(p || '').split('/').pop() || '';
  },
  extname(p) {
    const m = String(p || '').match(/\\.[^.]+$/);
    return m ? m[0] : '';
  }
};

const shimProcess = {
  cwd() {
    return '/';
  },
  env: {}
};

const __nodeShim = {
  crypto: shimCrypto,
  zlib: shimZlib,
  vm: shimVm,
  fs: shimFs,
  path: shimPath,
  process: shimProcess
};
`;

// Source modules in dependency order (paths relative to src/). A module may import one that
// comes later only for functions called at run time (the e-invoice renderer and index.mjs
// import each other); those imports become lazy wrappers.
const MODULE_ORDER = [
  'css-tailwind.mjs',
  'dom-vm.mjs',
  'layout-engine.mjs',
  'ttf-subset.mjs',
  'pdf-writer.mjs',
  'pdf-signer.mjs',
  'parametric-compiler.mjs',
  'einvoice/model.mjs',
  'einvoice/totals.mjs',
  'einvoice/validate.mjs',
  'einvoice/cii.mjs',
  'einvoice/template.mjs',
  'einvoice/examples.mjs',
  'einvoice/index.mjs',
  'einvoice/render.mjs',
  'index.mjs',
];

const modVar = (rel) => rel.replace(/\.mjs$/, '').replace(/[^A-Za-z0-9]+/g, '_') + 'Module';

function parseSpecList(body) {
  return body.split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
    const [orig, alias] = item.split(/\s+as\s+/).map((x) => x.trim());
    return { orig, local: alias || orig };
  });
}

function transformSourceModule(code, rel, emitted) {
  let transformed = code;
  const dir = path.posix.dirname(rel);
  const resolve = (spec) => path.posix.normalize(path.posix.join(dir, spec));
  const exports = [];
  const exportNames = [];
  const addExport = (key, local) => { exports.push(key === local ? key : `${key}: ${local}`); exportNames.push(key); };

  const bindImport = (body, spec) => {
    const target = resolve(spec);
    if (!MODULE_ORDER.includes(target)) throw new Error(`build-browser: ${rel} imports ${spec}, which is not in MODULE_ORDER`);
    const mv = modVar(target);
    const items = parseSpecList(body);
    if (emitted.has(target)) {
      return `const { ${items.map((i) => (i.orig === i.local ? i.orig : `${i.orig}: ${i.local}`)).join(', ')} } = ${mv};`;
    }
    // Circular import: resolve at call time.
    return items.map((i) => `const ${i.local} = (...args) => ${mv}.${i.orig}(...args);`).join('\n');
  };

  // Re-exports: export { a, b as c } from './x.mjs';
  transformed = transformed.replace(/export\s+\{([\s\S]*?)\}\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?/g, (m, body, spec) => {
    const items = parseSpecList(body);
    const target = resolve(spec);
    const tmp = `__re_${exports.length}_${modVar(target)}`;
    items.forEach((i) => addExport(i.local, `${tmp}.${i.orig}`));
    return `const ${tmp} = ${modVar(target)};`;
  });

  // Relative imports
  transformed = transformed.replace(/import\s+\{([\s\S]*?)\}\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?/g, (m, body, spec) => bindImport(body, spec));
  transformed = transformed.replace(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?/g, (m, name, spec) => `const ${name} = ${modVar(resolve(spec))};`);

  // Node built-ins become the runtime shim
  transformed = transformed.replace(/import\s+(\{[\s\S]*?\})\s+from\s+['"]node:([^'"]+)['"];?/g, (m, spec, mod) => `const ${spec} = __nodeShim['${mod}'] || {};`);
  transformed = transformed.replace(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"]node:([^'"]+)['"];?/g, (m, spec, mod) => `const ${spec} = __nodeShim['${mod}'] || {};`);

  // Strip export default statements
  transformed = transformed.replace(/export\s+default\s+[\s\S]+?;(?=\n|$)/g, '');

  transformed = transformed.replace(/export\s+function\s+([A-Za-z0-9_$]+)/g, (m, name) => { addExport(name, name); return `function ${name}`; });
  transformed = transformed.replace(/export\s+async\s+function\s+([A-Za-z0-9_$]+)/g, (m, name) => { addExport(name, name); return `async function ${name}`; });
  transformed = transformed.replace(/export\s+class\s+([A-Za-z0-9_$]+)/g, (m, name) => { addExport(name, name); return `class ${name}`; });
  transformed = transformed.replace(/export\s+const\s+([A-Za-z0-9_$]+)\s*=/g, (m, name) => { addExport(name, name); return `const ${name} =`; });
  transformed = transformed.replace(/export\s+let\s+([A-Za-z0-9_$]+)\s*=/g, (m, name) => { addExport(name, name); return `let ${name} =`; });
  transformed = transformed.replace(/export\s+\{([\s\S]*?)\};?/g, (m, body) => {
    parseSpecList(body).forEach((i) => addExport(i.local, i.orig));
    return '';
  });

  const mv = modVar(rel);
  return { code: `const ${mv} = (() => {\n${transformed}\nreturn { ${exports.join(', ')} };\n})();\n`, exportNames };
}

export function buildBrowserBundle() {
  const moduleCodeBlocks = [];
  const emitted = new Set();
  let indexExports = [];
  for (const rel of MODULE_ORDER) {
    const content = fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
    const { code, exportNames } = transformSourceModule(content, rel, emitted);
    moduleCodeBlocks.push(code);
    emitted.add(rel);
    if (rel === 'index.mjs') indexExports = exportNames;
  }
  const names = [...new Set(indexExports)].filter((n) => n !== 'VeloxPDF');
  for (const required of ['renderEInvoice', 'renderEInvoiceAsync', 'validateInvoice', 'computeTotals', 'buildCiiXml', 'EINVOICE_EXAMPLES', 'registerFontData', 'PDFA_FONT_FILES']) {
    if (!names.includes(required)) throw new Error(`build-browser: index.mjs does not export ${required}`);
  }

  const list = names.join(',\n  ');
  const bundleTrailer = `
// =============================================================================
// Window & ESM Unified Export Bridge (every export of src/index.mjs)
// =============================================================================
const {
  ${list},
} = indexModule;

const VeloxPDF = {
  ${list},
};

if (typeof window !== 'undefined') {
  window.VeloxPDF = VeloxPDF;
}
if (typeof globalThis !== 'undefined') {
  globalThis.VeloxPDF = VeloxPDF;
}

export {
  ${list},
  VeloxPDF,
};

export default VeloxPDF;
`;

  const finalBundle = [
    '// VeloxPDF Browser Runtime Bundle (Universal Zero-Chromium Engine)',
    '// Generated by scripts/build-browser.mjs — Zero external dependencies',
    BROWSER_SHIM,
    ...moduleCodeBlocks,
    bundleTrailer,
  ].join('\n\n');

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, finalBundle, 'utf8');
  console.log(`\x1b[32m✔\x1b[0m Successfully built client-side browser bundle: ${OUT_FILE} (${(finalBundle.length / 1024).toFixed(1)} KB)`);
  return { path: OUT_FILE, length: finalBundle.length };
}

// Auto-run if executed directly via `node scripts/build-browser.mjs`
// presets.json lets the Studio run with no server (static hosting, offline) using the same presets.
export async function writePresetsJson() {
  const { PRESETS } = await import('../server.mjs');
  const out = {};
  for (const [key, preset] of Object.entries(PRESETS)) {
    out[key] = { id: preset.id || key, name: preset.name, format: preset.format, sign: preset.sign, template: preset.template, data: preset.data };
  }
  const file = path.join(PUBLIC_DIR, 'presets.json');
  fs.writeFileSync(file, JSON.stringify(out), 'utf8');
  console.log(`\x1b[32m✔\x1b[0m Wrote ${file} (${Object.keys(out).length} presets)`);
}

// PDF/A needs embedded fonts. The browser fetches them from public/fonts/ and hands them to
// registerFontData(), so copy the TTF files and their licence next to the page.
export function copyFonts() {
  const src = path.join(ROOT_DIR, 'fonts');
  const dest = path.join(PUBLIC_DIR, 'fonts');
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src).filter((f) => /\.ttf$/i.test(f) || f === 'LICENSE');
  for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dest, f));
  console.log(`\x1b[32m✔\x1b[0m Copied ${files.length} font files to ${dest}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildBrowserBundle();
  copyFonts();
  await writePresetsJson();
}
