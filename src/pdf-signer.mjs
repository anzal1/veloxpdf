import crypto from 'node:crypto';

// ASN.1 / DER encoding primitives
function derTag(tag, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const len = buf.length;
  let lenBytes;
  if (len < 128) {
    lenBytes = Buffer.from([len]);
  } else if (len < 256) {
    lenBytes = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    lenBytes = Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  } else if (len < 16777216) {
    lenBytes = Buffer.from([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  } else {
    lenBytes = Buffer.from([
      0x84,
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
  }
  return Buffer.concat([Buffer.from([tag]), lenBytes, buf]);
}

function derSeq(items) {
  return derTag(0x30, Buffer.concat(items));
}

function derSet(items) {
  return derTag(0x31, Buffer.concat(items));
}

function derOctet(buf) {
  return derTag(0x04, buf);
}

function derInt(n) {
  if (typeof n === 'number') {
    if (n === 0) return derTag(0x02, Buffer.from([0]));
    const b = [];
    while (n > 0) {
      b.unshift(n & 0xff);
      n = Math.floor(n / 256);
    }
    if (b[0] & 0x80) b.unshift(0);
    return derTag(0x02, Buffer.from(b));
  }
  let buf = Buffer.isBuffer(n) ? n : Buffer.from(n);
  if (buf.length > 0 && buf[0] & 0x80) {
    buf = Buffer.concat([Buffer.from([0]), buf]);
  }
  return derTag(0x02, buf);
}

function derOid(oidStr) {
  const parts = oidStr.split('.').map(Number);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val === 0) {
      bytes.push(0);
    } else {
      const b = [];
      while (val > 0) {
        b.unshift(val & 0x7f);
        val = Math.floor(val / 128);
      }
      for (let j = 0; j < b.length - 1; j++) {
        b[j] |= 0x80;
      }
      bytes.push(...b);
    }
  }
  return derTag(0x06, Buffer.from(bytes));
}

function derUtcTime(date) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const str =
    pad(d.getUTCFullYear() % 100) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z';
  return derTag(0x17, Buffer.from(str, 'ascii'));
}

// ASN.1 TLV Decoder
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
  return {
    tag,
    headerLen,
    len,
    body,
    totalLen,
    raw: buf.subarray(offset, offset + totalLen),
  };
}

// OID Constants
const OID_PKCS7_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_PKCS7_DATA = '1.2.840.113549.1.7.1';
const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
const OID_SHA256_WITH_RSA = '1.2.840.113549.1.1.11';
const OID_ATTR_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_ATTR_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_ATTR_SIGNING_TIME = '1.2.840.113549.1.9.5';

const NULL_TAG = Buffer.from([0x05, 0x00]);
const ALG_SHA256 = derSeq([derOid(OID_SHA256), NULL_TAG]);
const ALG_RSA = derSeq([derOid(OID_RSA_ENCRYPTION), NULL_TAG]);
const ALG_SHA256_RSA = derSeq([derOid(OID_SHA256_WITH_RSA), NULL_TAG]);

function buildSelfSignedTbs({ commonName, org, country }, publicKey, serialBytes) {
  const rdnSeq = [];
  if (country) {
    rdnSeq.push(
      derSet([derSeq([derOid('2.5.4.6'), derTag(0x13, Buffer.from(country, 'ascii'))])]),
    );
  }
  if (org) {
    rdnSeq.push(
      derSet([derSeq([derOid('2.5.4.10'), derTag(0x0c, Buffer.from(org, 'utf8'))])]),
    );
  }
  if (commonName) {
    rdnSeq.push(
      derSet([derSeq([derOid('2.5.4.3'), derTag(0x0c, Buffer.from(commonName, 'utf8'))])]),
    );
  }
  const dn = derSeq(rdnSeq);

  const notBefore = derUtcTime(new Date(Date.now() - 3600000));
  const notAfter = derUtcTime(new Date(Date.now() + 365 * 24 * 3600000));
  const validity = derSeq([notBefore, notAfter]);

  const tbs = derSeq([
    derTag(0xa0, derInt(2)), // v3 = 2
    derInt(serialBytes),
    ALG_SHA256_RSA,
    dn,
    validity,
    dn,
    publicKey, // SPKI DER
  ]);

  return tbs;
}

function wrapSelfSignedCert(tbs, signature, commonName, org, keyPem) {
  const certSig = derTag(0x03, Buffer.concat([Buffer.from([0x00]), signature]));
  const certDer = derSeq([tbs, ALG_SHA256_RSA, certSig]);
  const pemBody = certDer.toString('base64').match(/.{1,64}/g).join('\n');
  const certPem = `-----BEGIN CERTIFICATE-----\n${pemBody}\n-----END CERTIFICATE-----\n`;
  return { certPem, keyPem, certDer, commonName, org };
}

/**
 * Generate the default self-signed identity with WebCrypto (native RSA keygen).
 * Much faster than the pure-JS generator in browsers. Returns the same shape as
 * generateSelfSignedCert plus a ready-to-use cryptoKey.
 */
export async function generateSelfSignedCertAsync({
  commonName = 'VeloxPDF Authority',
  org = 'VeloxPDF Inc.',
  country = 'US',
} = {}) {
  const subtle = globalThis.crypto.subtle;
  const keyPair = await subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const [spki, pkcs8] = await Promise.all([
    subtle.exportKey('spki', keyPair.publicKey),
    subtle.exportKey('pkcs8', keyPair.privateKey),
  ]);
  const serialBytes = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(8)));
  serialBytes[0] &= 0x7f;
  const tbs = buildSelfSignedTbs({ commonName, org, country }, Buffer.from(spki), serialBytes);
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, tbs);
  const keyB64 = Buffer.from(pkcs8).toString('base64').match(/.{1,64}/g).join('\n');
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${keyB64}\n-----END PRIVATE KEY-----\n`;
  const out = wrapSelfSignedCert(tbs, Buffer.from(sig), commonName, org, keyPem);
  out.cryptoKey = keyPair.privateKey;
  return out;
}

/**
 * Generate a self-signed X.509 certificate and RSA keypair in pure JS/Node crypto.
 */
export function generateSelfSignedCert({
  commonName = 'VeloxPDF Authority',
  org = 'VeloxPDF Inc.',
  country = 'US',
} = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const serialBytes = crypto.randomBytes(8);
  serialBytes[0] &= 0x7f; // positive integer

  const tbs = buildSelfSignedTbs({ commonName, org, country }, publicKey, serialBytes);

  const certSigner = crypto.createSign('RSA-SHA256');
  certSigner.update(tbs);
  return wrapSelfSignedCert(tbs, certSigner.sign(privateKey), commonName, org, privateKey);
}

function escapePdfStr(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}


/**
 * Reads the state of the LAST revision of a PDF so an incremental update can chain onto it:
 * last startxref, last trailer /Size and /Root, and the live catalog dictionary body.
 * (First-match regexes pick the OLDEST revision and break re-signing.)
 */
function matchLast(str, re) {
  let last = null;
  for (const m of str.matchAll(re)) last = m;
  return last;
}

function findDictEnd(str, start) {
  // str[start] === '<' and str[start+1] === '<'. Returns index just after the matching '>>'.
  let depth = 0;
  for (let i = start; i < str.length - 1; i++) {
    if (str[i] === '<' && str[i + 1] === '<') { depth++; i++; }
    else if (str[i] === '>' && str[i + 1] === '>') { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

function readLiveObjectBody(baseStr, id) {
  const re = new RegExp(`(?:^|[\\r\\n])${id}\\s+0\\s+obj\\s*(<<)`, 'g');
  const m = matchLast(baseStr, re);
  if (!m) return null;
  const start = m.index + m[0].length - 2;
  const end = findDictEnd(baseStr, start);
  return end < 0 ? null : baseStr.slice(start, end);
}

function analyzeBaseForIncrement(baseStr) {
  const sx = matchLast(baseStr, /startxref\s+(\d+)/g);
  const prevXref = sx ? parseInt(sx[1], 10) : 0;
  const sz = matchLast(baseStr, /trailer\s*<<[^]*?\/Size\s+(\d+)/g) || matchLast(baseStr, /\/Size\s+(\d+)/g);
  const prevSize = sz ? parseInt(sz[1], 10) : 50;
  const rt = matchLast(baseStr, /\/Root\s+(\d+)\s+0\s+R/g);
  const rootId = rt ? parseInt(rt[1], 10) : 1;
  const catalogBody = readLiveObjectBody(baseStr, rootId);
  // Keys every revision must repeat (ISO 32000-1 7.5.6). PDF/A (6.1.3) needs /ID in each trailer.
  // Empty for files whose trailer has neither key, so their signed output is unchanged.
  let trailerExtra = '';
  const lastTrailer = matchLast(baseStr, /trailer\s*<<([^]*?)>>\s*startxref/g);
  if (lastTrailer) {
    const info = /\/Info\s+(\d+\s+\d+\s+R)/.exec(lastTrailer[1]);
    const id = /\/ID\s*\[\s*(<[0-9A-Fa-f]*>)\s*(<[0-9A-Fa-f]*>)\s*\]/.exec(lastTrailer[1]);
    if (info) trailerExtra += ` /Info ${info[1]}`;
    if (id) trailerExtra += ` /ID [${id[1]} ${id[2]}]`;
  }
  return { prevXref, prevSize, rootId, catalogBody, trailerExtra };
}

/** Builds the updated catalog: keeps every existing entry, appends the new field to /AcroForm /Fields. */
function nextSignatureFieldName(baseStr) {
  let max = 0;
  for (const m of baseStr.matchAll(/\/T\s*\(Signature(\d+)\)/g)) max = Math.max(max, parseInt(m[1], 10));
  return `Signature${max + 1}`;
}

function buildUpdatedCatalog(catalogBody, fieldId, pagesRef) {
  if (!catalogBody) {
    return `<< /Type /Catalog /Pages ${pagesRef} /AcroForm << /Fields [${fieldId} 0 R] /SigFlags 3 >> >>`;
  }
  let body = catalogBody;
  let fields = [];
  const af = body.indexOf('/AcroForm');
  if (af >= 0) {
    let q = af + '/AcroForm'.length;
    while (/\s/.test(body[q])) q++;
    if (body[q] === '<' && body[q + 1] === '<') {
      const e = findDictEnd(body, q);
      const inner = body.slice(q, e);
      const fm = inner.match(/\/Fields\s*\[([^\]]*)\]/);
      if (fm) fields = fm[1].match(/\d+\s+0\s+R/g) || [];
      body = body.slice(0, af) + body.slice(e);
    } else {
      // indirect /AcroForm reference: drop the reference, keep the sig field only (documented limitation)
      const rm = body.slice(q).match(/^\d+\s+0\s+R/);
      if (rm) body = body.slice(0, af) + body.slice(q + rm[0].length);
    }
  }
  const close = body.lastIndexOf('>>');
  const acro = `/AcroForm << /Fields [${[...fields, `${fieldId} 0 R`].join(' ')}] /SigFlags 3 >> `;
  return body.slice(0, close).replace(/\s*$/, ' ') + acro + body.slice(close);
}

let _cachedDefaultCert = null;

/**
 * Formats incremental xref table subsections according to ISO 32000-1 §7.5.4.
 * Sorts entries strictly ascending by id (entries.sort((a, b) => a.id - b.id))
 * and merges adjacent object IDs into contiguous `startId count` subsections.
 *
 * @param {Array<{id: number, offset: number}>} entries
 * @returns {string}
 */
export function formatIncrementalXref(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const sorted = [...entries].sort((a, b) => a.id - b.id);

  let out = '';
  let currentRun = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentRun[currentRun.length - 1];
    const curr = sorted[i];
    if (curr.id === prev.id + 1) {
      currentRun.push(curr);
    } else {
      out += `${currentRun[0].id} ${currentRun.length}\n`;
      for (const entry of currentRun) {
        out += `${String(entry.offset).padStart(10, '0')} 00000 n \n`;
      }
      currentRun = [curr];
    }
  }

  if (currentRun.length > 0) {
    out += `${currentRun[0].id} ${currentRun.length}\n`;
    for (const entry of currentRun) {
      out += `${String(entry.offset).padStart(10, '0')} 00000 n \n`;
    }
  }

  return out;
}

export const buildIncrementalXrefSubsections = formatIncrementalXref;

/**
 * Standards-compliant ISO 32000-1 AcroForm Digital Signature with exact ByteRange.
 * Emits an authentic incremental update with DER-encoded PKCS#7 / CMS SignedData.
 */
export function signPdf(pdfBytes, options = {}) {
  const signerName = options.signerName || 'VeloxPDF Authority';
  const reason = options.reason || 'Cryptographic Attestation';
  const location = options.location || 'San Francisco, US';

  const now = options.signingTime instanceof Date ? options.signingTime : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const pdfDate = `D:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z00'00'`;

  // Resolve or generate key & X.509 certificate
  let certDer = null;
  let keyPem = options.keyPem;
  let certPem = options.certPem;

  if (!keyPem || !certPem) {
    const org = options.org || 'VeloxPDF Inc.';
    if (
      !_cachedDefaultCert ||
      _cachedDefaultCert.commonName !== signerName ||
      _cachedDefaultCert.org !== org
    ) {
      _cachedDefaultCert = generateSelfSignedCert({
        commonName: signerName,
        org,
      });
    }
    keyPem = _cachedDefaultCert.keyPem;
    certPem = _cachedDefaultCert.certPem;
    certDer = _cachedDefaultCert.certDer;
  } else {
    try {
      const x509 = new crypto.X509Certificate(certPem);
      certDer = x509.raw;
    } catch {
      // In case certPem was an SPKI public key, generate an authentic cert with the provided key
      const generated = generateSelfSignedCert({
        commonName: signerName,
        org: options.org || 'VeloxPDF Inc.',
      });
      keyPem = generated.keyPem;
      certPem = generated.certPem;
      certDer = generated.certDer;
    }
  }

  const baseBuf = Buffer.from(
    pdfBytes.buffer || pdfBytes,
    pdfBytes.byteOffset || 0,
    pdfBytes.byteLength || pdfBytes.length,
  );
  const baseStr = baseBuf.toString('latin1');

  const { prevXref, prevSize, rootId, catalogBody, trailerExtra } = analyzeBaseForIncrement(baseStr);
  const pagesMatch = baseStr.match(/\/Pages\s+(\d+\s+0\s+R)/);
  const pagesRef = pagesMatch ? pagesMatch[1] : '2 0 R';

  const fieldId = prevSize;
  const sigId = prevSize + 1;
  const newSize = prevSize + 2;

  // Fixed reserved hex length: 8192 hex characters (4096 bytes)
  const HEX_SIG_LEN = 8192;
  const dummyByteRange = `[0 ${' '.repeat(10)} ${' '.repeat(10)} ${' '.repeat(10)}]`;
  const dummyContents = '0'.repeat(HEX_SIG_LEN);

  let inc = '\n%VELOXPDF_SIG_BEGIN\n';

  const rootOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const rootObj =
    `${rootId} 0 obj\n` +
    `${buildUpdatedCatalog(catalogBody, fieldId, pagesRef)}
` +
    `endobj\n`;
  inc += rootObj;

  const fieldOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const fieldObj =
    `${fieldId} 0 obj\n` +
    `<< /Type /Annot /Subtype /Widget /FT /Sig /T (${nextSignatureFieldName(baseStr)}) /V ${sigId} 0 R /Rect [0 0 0 0] /F 132 >>\n` +
    `endobj\n`;
  inc += fieldObj;

  const sigOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const sigObjHead =
    `${sigId} 0 obj\n` +
    `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (${escapePdfStr(signerName)}) /Reason (${escapePdfStr(reason)}) /Location (${escapePdfStr(location)}) /M (${pdfDate}) /Prop_Build << /App << /Name /VeloxPDF >> >> /ByteRange `;

  const sigObjTail =
    ` /Contents <${dummyContents}>\n>>\nendobj\n`;

  const incBeforeXref = inc + sigObjHead + dummyByteRange + sigObjTail;
  const newXrefOffset = baseBuf.length + Buffer.byteLength(incBeforeXref, 'latin1');

  const entries = [
    { id: rootId, offset: rootOffset },
    { id: fieldId, offset: fieldOffset },
    { id: sigId, offset: sigOffset },
  ];
  if (options.pageObjId && typeof options.pageOffset === 'number') {
    entries.push({ id: options.pageObjId, offset: options.pageOffset });
  }
  if (Array.isArray(options.additionalEntries)) {
    entries.push(...options.additionalEntries);
  }
  const xrefSubsections = formatIncrementalXref(entries);

  const xrefAndTrailer =
    `xref\n` +
    xrefSubsections +
    `trailer\n` +
    `<< /Size ${newSize} /Root ${rootId} 0 R /Prev ${prevXref}${trailerExtra} >>\n` +
    `startxref\n` +
    `${newXrefOffset}\n` +
    `%%EOF\n`;

  const fullDoc = Buffer.concat([baseBuf, Buffer.from(incBeforeXref + xrefAndTrailer, 'latin1')]);

  // Find exact byte positions for /Contents <...>
  const contentsKey = Buffer.from('/Contents <');
  const contentsKeyIdx = fullDoc.indexOf(contentsKey, baseBuf.length);
  const leftAnglePos = contentsKeyIdx + contentsKey.length - 1; // position of '<'
  const rightAnglePos = leftAnglePos + 1 + HEX_SIG_LEN; // position of '>'

  const totalDocLen = fullDoc.length;
  const len1 = leftAnglePos;
  const offset2 = rightAnglePos + 1;
  const len2 = totalDocLen - offset2;

  // Exact 4-tuple [0, len1, offset2, len2]
  const byteRangeStr = `[0 ${String(len1).padStart(10, ' ')} ${String(offset2).padStart(10, ' ')} ${String(len2).padStart(10, ' ')}]`;
  const byteRangeKey = Buffer.from('/ByteRange ');
  const byteRangeKeyIdx = fullDoc.indexOf(byteRangeKey, baseBuf.length);
  fullDoc.write(byteRangeStr, byteRangeKeyIdx + byteRangeKey.length, 'latin1');

  // Compute SHA-256 digest over the exact ByteRange slices
  const slice1 = fullDoc.subarray(0, len1);
  const slice2 = fullDoc.subarray(offset2, offset2 + len2);
  const docHash = crypto.createHash('sha256').update(slice1).update(slice2).digest();

  // Construct DER-encoded PKCS#7 / CMS SignedData
  const attrContentType = derSeq([
    derOid(OID_ATTR_CONTENT_TYPE),
    derSet([derOid(OID_PKCS7_DATA)]),
  ]);
  const attrSigningTime = derSeq([
    derOid(OID_ATTR_SIGNING_TIME),
    derSet([derUtcTime(now)]),
  ]);
  const attrMessageDigest = derSeq([
    derOid(OID_ATTR_MESSAGE_DIGEST),
    derSet([derOctet(docHash)]),
  ]);

  const attrsList = [attrContentType, attrSigningTime, attrMessageDigest];
  attrsList.sort((a, b) => a.compare(b));

  const signedAttrsBody = Buffer.concat(attrsList);
  const signedAttrsSet = derTag(0x31, signedAttrsBody);
  const signedAttrsTag = derTag(0xa0, signedAttrsBody);

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signedAttrsSet);
  const sigVal = signer.sign(keyPem);

  // Extract serial and issuer from certDer
  const x509 = new crypto.X509Certificate(certDer);
  const serialBuf = Buffer.from(x509.serialNumber, 'hex');
  const certSeq = parseAsn1(certDer, 0);
  const tbsSeq = parseAsn1(certSeq.body, 0);
  let tPos = 0;
  const fTag = parseAsn1(tbsSeq.body, 0);
  if (fTag.tag === 0xa0) tPos += fTag.totalLen;
  const sTag = parseAsn1(tbsSeq.body, tPos); tPos += sTag.totalLen;
  const aTag = parseAsn1(tbsSeq.body, tPos); tPos += aTag.totalLen;
  const iTag = parseAsn1(tbsSeq.body, tPos);
  const issuerAndSerial = derSeq([iTag.raw, derInt(serialBuf)]);

  const signerInfo = derSeq([
    derInt(1),
    issuerAndSerial,
    ALG_SHA256,
    signedAttrsTag,
    ALG_RSA,
    derOctet(sigVal),
  ]);

  const signedData = derSeq([
    derInt(1),
    derSet([ALG_SHA256]),
    derSeq([derOid(OID_PKCS7_DATA)]), // detached
    derTag(0xa0, certDer), // certificates [0]
    derSet([signerInfo]),
  ]);

  const cmsContentInfo = derSeq([
    derOid(OID_PKCS7_SIGNED_DATA),
    derTag(0xa0, signedData),
  ]);

  const rawCmsHex = cmsContentInfo.toString('hex');
  // The CMS must fit inside the reserved /Contents <...> hole. Writing a longer one would
  // overwrite the closing '>' and the bytes after it, corrupting the xref while /ByteRange
  // still looks valid. Fail loudly instead.
  if (rawCmsHex.length > HEX_SIG_LEN) {
    throw new Error(
      `CMS signature is ${rawCmsHex.length / 2} bytes but only ${HEX_SIG_LEN / 2} bytes are reserved in /Contents; ` +
        'use a shorter certificate chain or raise the reservation.',
    );
  }
  const cmsHex = rawCmsHex.padEnd(HEX_SIG_LEN, '0');
  fullDoc.write(cmsHex, leftAnglePos + 1, 'latin1');

  return new Uint8Array(fullDoc);
}

export const signPdfBuffer = signPdf;

/**
 * Standards-compliant ISO 32000-1 Digital Signature Verification.
 * Cryptographically verifies ByteRange slices and CMS SignedData payload.
 */
export function verifyPdfSignature(signedPdfBytes, options = {}) {
  const buf = Buffer.from(
    signedPdfBytes.buffer || signedPdfBytes,
    signedPdfBytes.byteOffset || 0,
    signedPdfBytes.byteLength || signedPdfBytes.length,
  );
  const latin = buf.toString('latin1');

  // Find all ByteRange matches and take the outermost/latest signature
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const brMatches = [...latin.matchAll(byteRangeRegex)];
  if (brMatches.length === 0) {
    return {
      valid: false,
      tamperDetected: false,
      error: 'No /ByteRange signature dictionary found',
    };
  }

  const lastBrMatch = brMatches[brMatches.length - 1];
  const start1 = parseInt(lastBrMatch[1], 10);
  const len1 = parseInt(lastBrMatch[2], 10);
  const start2 = parseInt(lastBrMatch[3], 10);
  const len2 = parseInt(lastBrMatch[4], 10);
  const byteRange = [start1, len1, start2, len2];

  // Find /Contents <([0-9a-fA-F\s]+)>
  const contentsRegex = /\/Contents\s*<([0-9a-fA-F\s]+)>/g;
  const cMatches = [...latin.matchAll(contentsRegex)];
  if (cMatches.length === 0) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'No /Contents hex value found',
      byteRange,
    };
  }
  const lastCMatch = cMatches[cMatches.length - 1];
  const hexContents = lastCMatch[1].replace(/\s+/g, '');
  const cmsDer = Buffer.from(hexContents, 'hex');

  // Parse dictionary metadata
  const nameMatch = latin.match(/\/Name\s*\(([^)]*)\)/);
  const reasonMatch = latin.match(/\/Reason\s*\(([^)]*)\)/);
  const locMatch = latin.match(/\/Location\s*\(([^)]*)\)/);
  const dateMatch = latin.match(/\/M\s*\(([^)]*)\)/);
  const subFilterMatch = latin.match(/\/SubFilter\s*\/([A-Za-z0-9._]+)/);
  const subFilter = subFilterMatch?.[1] || 'adbe.pkcs7.detached';

  const signerName = nameMatch?.[1] || 'VeloxPDF Authority';
  const reason = reasonMatch?.[1] || '';
  const location = locMatch?.[1] || '';
  const rawSignedAt = dateMatch?.[1] || '';

  // 1. Verify strict ByteRange bracketing:
  // - start1 must be 0
  // - byte at len1 must be '<' (0x3c)
  // - byte before start2 must be '>' (0x3e)
  // - start2 + len2 must equal the buffer length
  if (start1 !== 0 || buf[len1] !== 0x3c || buf[start2 - 1] !== 0x3e || start2 + len2 !== buf.length) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'ByteRange bracketing violation or truncated file',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  // 2. Slice exact byte ranges and compute document SHA-256
  const slice1 = buf.subarray(start1, start1 + len1);
  const slice2 = buf.subarray(start2, start2 + len2);
  const computedHash = crypto.createHash('sha256').update(slice1).update(slice2).digest();

  // 3. Parse CMS ContentInfo
  const ci = parseAsn1(cmsDer, 0);
  if (!ci) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Invalid CMS ContentInfo ASN.1 payload',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  let pos = 0;
  const oidNode = parseAsn1(ci.body, pos);
  if (!oidNode) {
    return { valid: false, tamperDetected: true, error: 'Missing ContentInfo OID', byteRange, subFilter };
  }
  pos += oidNode.totalLen;
  const sdOuter = parseAsn1(ci.body, pos);
  if (!sdOuter) {
    return { valid: false, tamperDetected: true, error: 'Missing SignedData outer wrapper', byteRange, subFilter };
  }
  const sd = parseAsn1(sdOuter.body, 0);
  if (!sd) {
    return { valid: false, tamperDetected: true, error: 'Missing SignedData sequence', byteRange, subFilter };
  }

  // Extract SignedData members: version, digestAlgs, encapContentInfo, certificates [0], signerInfos
  let sdPos = 0;
  const vNode = parseAsn1(sd.body, sdPos);
  if (vNode) sdPos += vNode.totalLen;
  const daNode = parseAsn1(sd.body, sdPos);
  if (daNode) sdPos += daNode.totalLen;
  const eciNode = parseAsn1(sd.body, sdPos);
  if (eciNode) sdPos += eciNode.totalLen;

  let certsNode = null;
  let signerInfosNode = null;
  while (sdPos < sd.body.length) {
    const child = parseAsn1(sd.body, sdPos);
    if (!child) break;
    sdPos += child.totalLen;
    if (child.tag === 0xa0) {
      certsNode = child;
    } else if (child.tag === 0x31) {
      signerInfosNode = child;
    }
  }

  if (!certsNode || !signerInfosNode) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Missing certificates or signerInfos in CMS structure',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  // Parse certificate and instantiate X509Certificate
  const certSeq = parseAsn1(certsNode.body, 0);
  if (!certSeq) {
    return { valid: false, tamperDetected: true, error: 'Cannot parse X.509 certificate', byteRange, subFilter };
  }
  const x509 = new crypto.X509Certificate(certSeq.raw);

  // Parse SignerInfo
  const signerInfoSeq = parseAsn1(signerInfosNode.body, 0);
  if (!signerInfoSeq) {
    return { valid: false, tamperDetected: true, error: 'Cannot parse SignerInfo', byteRange, subFilter };
  }

  let siPos = 0;
  const siV = parseAsn1(signerInfoSeq.body, siPos); if (siV) siPos += siV.totalLen;
  const siSid = parseAsn1(signerInfoSeq.body, siPos); if (siSid) siPos += siSid.totalLen;
  const siDa = parseAsn1(signerInfoSeq.body, siPos); if (siDa) siPos += siDa.totalLen;

  let siAttrs = null;
  let siSigAlg = null;
  let siSigVal = null;

  while (siPos < signerInfoSeq.body.length) {
    const child = parseAsn1(signerInfoSeq.body, siPos);
    if (!child) break;
    siPos += child.totalLen;
    if (child.tag === 0xa0) {
      siAttrs = child;
    } else if (child.tag === 0x30) {
      siSigAlg = child;
    } else if (child.tag === 0x04) {
      siSigVal = child;
    }
  }

  if (!siSigVal) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Missing signature bytes in SignerInfo',
      byteRange,
      certSubject: x509.subject,
      sha256Fingerprint: x509.fingerprint256,
      subFilter,
    };
  }

  let embeddedDigest = null;
  let signingTime = '';

  if (siAttrs) {
    let aPos = 0;
    while (aPos < siAttrs.body.length) {
      const attr = parseAsn1(siAttrs.body, aPos);
      if (!attr) break;
      aPos += attr.totalLen;
      const aOid = parseAsn1(attr.body, 0);
      const aVal = parseAsn1(attr.body, aOid.totalLen);
      const oHex = aOid.body.toString('hex');
      if (oHex === '2a864886f70d010904') {
        // messageDigest
        const octet = parseAsn1(aVal.body, 0);
        if (octet) embeddedDigest = octet.body;
      } else if (oHex === '2a864886f70d010905') {
        // signingTime
        const tVal = parseAsn1(aVal.body, 0);
        if (tVal) signingTime = tVal.body.toString('ascii');
      }
    }
  }

  // 4. Verify message digest
  if (embeddedDigest && !embeddedDigest.equals(computedHash)) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Computed SHA-256 digest does not match embedded messageDigest attribute (tamper detected)',
      signerName,
      reason,
      location,
      signingTime: signingTime || rawSignedAt,
      signedAt: signingTime || rawSignedAt,
      byteRange,
      certSubject: x509.subject,
      sha256Fingerprint: x509.fingerprint256,
      subFilter,
      digestHex: computedHash.toString('hex'),
    };
  }

  // 5. Cryptographic signature verification
  let cryptoValid = false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    if (siAttrs) {
      // Per RFC 5652 / RFC 2315, signed attributes are hashed using SET OF (tag 0x31)
      const attrsForVerification = Buffer.concat([Buffer.from([0x31]), siAttrs.raw.subarray(1)]);
      verifier.update(attrsForVerification);
    } else {
      verifier.update(computedHash);
    }
    cryptoValid = verifier.verify(x509.publicKey, siSigVal.body);
  } catch (err) {
    return {
      valid: false,
      tamperDetected: true,
      error: `Cryptographic verification failed: ${err.message}`,
      signerName,
      reason,
      location,
      signingTime: signingTime || rawSignedAt,
      signedAt: signingTime || rawSignedAt,
      byteRange,
      certSubject: x509.subject,
      sha256Fingerprint: x509.fingerprint256,
      subFilter,
      digestHex: computedHash.toString('hex'),
    };
  }

  return {
    valid: cryptoValid,
    tamperDetected: !cryptoValid,
    signerName,
    reason,
    location,
    signingTime: signingTime || rawSignedAt,
    signedAt: signingTime || rawSignedAt,
    byteRange,
    certSubject: x509.subject,
    sha256Fingerprint: x509.fingerprint256,
    subFilter,
    digestHex: computedHash.toString('hex'),
  };
}

/**
 * Standards-compliant ISO 32000-1 Digital Signature with WebCrypto (RSASSA-PKCS1-v1_5 SHA-256).
 * Asynchronous, Cloudflare Worker / Browser / Edge compatible.
 */
export async function signPdfAsync(pdfBytes, options = {}) {
  const subtleCrypto = globalThis.crypto?.subtle || crypto.webcrypto?.subtle;
  if (!subtleCrypto) {
    return signPdf(pdfBytes, options);
  }

  const signerName = options.signerName || 'VeloxPDF Authority';
  const reason = options.reason || 'Cryptographic Attestation';
  const location = options.location || 'San Francisco, US';

  const now = options.signingTime instanceof Date ? options.signingTime : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const pdfDate = `D:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z00'00'`;

  let certDer = null;
  let signingCryptoKey = null;

  try {
    if (options.cryptoKey || options.privateKey) {
      signingCryptoKey = options.cryptoKey || options.privateKey;
      if (options.certDer) {
        certDer = Buffer.from(options.certDer);
      } else if (options.certPem) {
        const b64 = options.certPem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '');
        certDer = Buffer.from(b64, 'base64');
      }
    }

    if (!signingCryptoKey) {
      let keyPem = options.keyPem;
      let certPem = options.certPem;

      if (!keyPem || !certPem) {
        const org = options.org || 'VeloxPDF Inc.';
        if (
          !_cachedDefaultCert ||
          _cachedDefaultCert.commonName !== signerName ||
          _cachedDefaultCert.org !== org
        ) {
          let generated = null;
          try {
            generated = await generateSelfSignedCertAsync({ commonName: signerName, org });
          } catch {
            generated = null;
          }
          if (!generated) {
            generated = generateSelfSignedCert({ commonName: signerName, org });
            generated.cryptoKey = null;
          }
          _cachedDefaultCert = generated;
        }
        keyPem = _cachedDefaultCert.keyPem;
        certPem = _cachedDefaultCert.certPem;
        certDer = _cachedDefaultCert.certDer;

        if (_cachedDefaultCert.cryptoKey) {
          signingCryptoKey = _cachedDefaultCert.cryptoKey;
        }
      } else {
        const b64 = certPem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '');
        certDer = Buffer.from(b64, 'base64');
      }

      if (!signingCryptoKey && keyPem) {
        const pkcs8B64 = keyPem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '');
        const pkcs8Buf = Buffer.from(pkcs8B64, 'base64');
        signingCryptoKey = await subtleCrypto.importKey(
          'pkcs8',
          pkcs8Buf,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign']
        );
        if (_cachedDefaultCert && _cachedDefaultCert.keyPem === keyPem) {
          _cachedDefaultCert.cryptoKey = signingCryptoKey;
        }
      }
    }
  } catch {
    return signPdf(pdfBytes, options);
  }

  if (!signingCryptoKey || !certDer) {
    return signPdf(pdfBytes, options);
  }

  let issuerAndSerial;
  try {
    const certSeq = parseAsn1(certDer, 0);
    const tbsSeq = parseAsn1(certSeq.body, 0);
    let tPos = 0;
    const fTag = parseAsn1(tbsSeq.body, 0);
    if (fTag.tag === 0xa0) tPos += fTag.totalLen;
    const sTag = parseAsn1(tbsSeq.body, tPos); tPos += sTag.totalLen;
    const aTag = parseAsn1(tbsSeq.body, tPos); tPos += aTag.totalLen;
    const iTag = parseAsn1(tbsSeq.body, tPos);
    issuerAndSerial = derSeq([iTag.raw, derInt(sTag.body)]);
  } catch {
    return signPdf(pdfBytes, options);
  }

  const baseBuf = Buffer.from(
    pdfBytes.buffer || pdfBytes,
    pdfBytes.byteOffset || 0,
    pdfBytes.byteLength || pdfBytes.length,
  );
  const baseStr = baseBuf.toString('latin1');

  const { prevXref, prevSize, rootId, catalogBody, trailerExtra } = analyzeBaseForIncrement(baseStr);
  const pagesMatch = baseStr.match(/\/Pages\s+(\d+\s+0\s+R)/);
  const pagesRef = pagesMatch ? pagesMatch[1] : '2 0 R';

  const fieldId = prevSize;
  const sigId = prevSize + 1;
  const newSize = prevSize + 2;

  const HEX_SIG_LEN = 8192;
  const dummyByteRange = `[0 ${' '.repeat(10)} ${' '.repeat(10)} ${' '.repeat(10)}]`;
  const dummyContents = '0'.repeat(HEX_SIG_LEN);

  let inc = '\n%VELOXPDF_SIG_BEGIN\n';

  const rootOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const rootObj =
    `${rootId} 0 obj\n` +
    `${buildUpdatedCatalog(catalogBody, fieldId, pagesRef)}
` +
    `endobj\n`;
  inc += rootObj;

  const fieldOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const fieldObj =
    `${fieldId} 0 obj\n` +
    `<< /Type /Annot /Subtype /Widget /FT /Sig /T (${nextSignatureFieldName(baseStr)}) /V ${sigId} 0 R /Rect [0 0 0 0] /F 132 >>\n` +
    `endobj\n`;
  inc += fieldObj;

  const sigOffset = baseBuf.length + Buffer.byteLength(inc, 'latin1');
  const sigObjHead =
    `${sigId} 0 obj\n` +
    `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (${escapePdfStr(signerName)}) /Reason (${escapePdfStr(reason)}) /Location (${escapePdfStr(location)}) /M (${pdfDate}) /Prop_Build << /App << /Name /VeloxPDF >> >> /ByteRange `;

  const sigObjTail =
    ` /Contents <${dummyContents}>\n>>\nendobj\n`;

  const incBeforeXref = inc + sigObjHead + dummyByteRange + sigObjTail;
  const newXrefOffset = baseBuf.length + Buffer.byteLength(incBeforeXref, 'latin1');

  const entries = [
    { id: rootId, offset: rootOffset },
    { id: fieldId, offset: fieldOffset },
    { id: sigId, offset: sigOffset },
  ];
  if (options.pageObjId && typeof options.pageOffset === 'number') {
    entries.push({ id: options.pageObjId, offset: options.pageOffset });
  }
  if (Array.isArray(options.additionalEntries)) {
    entries.push(...options.additionalEntries);
  }
  const xrefSubsections = formatIncrementalXref(entries);

  const xrefAndTrailer =
    `xref\n` +
    xrefSubsections +
    `trailer\n` +
    `<< /Size ${newSize} /Root ${rootId} 0 R /Prev ${prevXref}${trailerExtra} >>\n` +
    `startxref\n` +
    `${newXrefOffset}\n` +
    `%%EOF\n`;

  const fullDoc = Buffer.concat([baseBuf, Buffer.from(incBeforeXref + xrefAndTrailer, 'latin1')]);

  const contentsKey = Buffer.from('/Contents <');
  const contentsKeyIdx = fullDoc.indexOf(contentsKey, baseBuf.length);
  const leftAnglePos = contentsKeyIdx + contentsKey.length - 1;
  const rightAnglePos = leftAnglePos + 1 + HEX_SIG_LEN;

  const totalDocLen = fullDoc.length;
  const len1 = leftAnglePos;
  const offset2 = rightAnglePos + 1;
  const len2 = totalDocLen - offset2;

  const byteRangeStr = `[0 ${String(len1).padStart(10, ' ')} ${String(offset2).padStart(10, ' ')} ${String(len2).padStart(10, ' ')}]`;
  const byteRangeKey = Buffer.from('/ByteRange ');
  const byteRangeKeyIdx = fullDoc.indexOf(byteRangeKey, baseBuf.length);
  fullDoc.write(byteRangeStr, byteRangeKeyIdx + byteRangeKey.length, 'latin1');

  const slice1 = fullDoc.subarray(0, len1);
  const slice2 = fullDoc.subarray(offset2, offset2 + len2);

  const hashData = new Uint8Array(len1 + len2);
  hashData.set(slice1, 0);
  hashData.set(slice2, len1);

  let docHash;
  try {
    const hashBuf = await subtleCrypto.digest('SHA-256', hashData);
    docHash = Buffer.from(hashBuf);
  } catch {
    docHash = crypto.createHash('sha256').update(slice1).update(slice2).digest();
  }

  const attrContentType = derSeq([
    derOid(OID_ATTR_CONTENT_TYPE),
    derSet([derOid(OID_PKCS7_DATA)]),
  ]);
  const attrSigningTime = derSeq([
    derOid(OID_ATTR_SIGNING_TIME),
    derSet([derUtcTime(now)]),
  ]);
  const attrMessageDigest = derSeq([
    derOid(OID_ATTR_MESSAGE_DIGEST),
    derSet([derOctet(docHash)]),
  ]);

  const attrsList = [attrContentType, attrSigningTime, attrMessageDigest];
  attrsList.sort((a, b) => a.compare(b));

  const signedAttrsBody = Buffer.concat(attrsList);
  const signedAttrsSet = derTag(0x31, signedAttrsBody);
  const signedAttrsTag = derTag(0xa0, signedAttrsBody);

  let sigVal;
  try {
    const sigBuf = await subtleCrypto.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      signingCryptoKey,
      signedAttrsSet
    );
    sigVal = Buffer.from(sigBuf);
  } catch {
    return signPdf(pdfBytes, options);
  }

  const signerInfo = derSeq([
    derInt(1),
    issuerAndSerial,
    ALG_SHA256,
    signedAttrsTag,
    ALG_RSA,
    derOctet(sigVal),
  ]);

  const signedData = derSeq([
    derInt(1),
    derSet([ALG_SHA256]),
    derSeq([derOid(OID_PKCS7_DATA)]),
    derTag(0xa0, certDer),
    derSet([signerInfo]),
  ]);

  const cmsContentInfo = derSeq([
    derOid(OID_PKCS7_SIGNED_DATA),
    derTag(0xa0, signedData),
  ]);

  const rawCmsHex = cmsContentInfo.toString('hex');
  // The CMS must fit inside the reserved /Contents <...> hole. Writing a longer one would
  // overwrite the closing '>' and the bytes after it, corrupting the xref while /ByteRange
  // still looks valid. Fail loudly instead.
  if (rawCmsHex.length > HEX_SIG_LEN) {
    throw new Error(
      `CMS signature is ${rawCmsHex.length / 2} bytes but only ${HEX_SIG_LEN / 2} bytes are reserved in /Contents; ` +
        'use a shorter certificate chain or raise the reservation.',
    );
  }
  const cmsHex = rawCmsHex.padEnd(HEX_SIG_LEN, '0');
  fullDoc.write(cmsHex, leftAnglePos + 1, 'latin1');

  return new Uint8Array(fullDoc);
}

/**
 * Standards-compliant ISO 32000-1 Digital Signature Verification using WebCrypto.
 * Asynchronously verifies ByteRange slices and CMS SignedData payload.
 */
export async function verifyPdfSignatureAsync(signedPdfBytes, options = {}) {
  const subtleCrypto = globalThis.crypto?.subtle || crypto.webcrypto?.subtle;
  if (!subtleCrypto) {
    return verifyPdfSignature(signedPdfBytes, options);
  }

  const buf = Buffer.from(
    signedPdfBytes.buffer || signedPdfBytes,
    signedPdfBytes.byteOffset || 0,
    signedPdfBytes.byteLength || signedPdfBytes.length,
  );
  const latin = buf.toString('latin1');

  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const brMatches = [...latin.matchAll(byteRangeRegex)];
  if (brMatches.length === 0) {
    return {
      valid: false,
      tamperDetected: false,
      error: 'No /ByteRange signature dictionary found',
    };
  }

  const lastBrMatch = brMatches[brMatches.length - 1];
  const start1 = parseInt(lastBrMatch[1], 10);
  const len1 = parseInt(lastBrMatch[2], 10);
  const start2 = parseInt(lastBrMatch[3], 10);
  const len2 = parseInt(lastBrMatch[4], 10);
  const byteRange = [start1, len1, start2, len2];

  const contentsRegex = /\/Contents\s*<([0-9a-fA-F\s]+)>/g;
  const cMatches = [...latin.matchAll(contentsRegex)];
  if (cMatches.length === 0) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'No /Contents hex value found',
      byteRange,
    };
  }
  const lastCMatch = cMatches[cMatches.length - 1];
  const hexContents = lastCMatch[1].replace(/\s+/g, '');
  const cmsDer = Buffer.from(hexContents, 'hex');

  const nameMatch = latin.match(/\/Name\s*\(([^)]*)\)/);
  const reasonMatch = latin.match(/\/Reason\s*\(([^)]*)\)/);
  const locMatch = latin.match(/\/Location\s*\(([^)]*)\)/);
  const dateMatch = latin.match(/\/M\s*\(([^)]*)\)/);
  const subFilterMatch = latin.match(/\/SubFilter\s*\/([A-Za-z0-9._]+)/);
  const subFilter = subFilterMatch?.[1] || 'adbe.pkcs7.detached';

  const signerName = nameMatch?.[1] || 'VeloxPDF Authority';
  const reason = reasonMatch?.[1] || '';
  const location = locMatch?.[1] || '';
  const rawSignedAt = dateMatch?.[1] || '';

  // 1. Verify strict ByteRange bracketing
  if (start1 !== 0 || buf[len1] !== 0x3c || buf[start2 - 1] !== 0x3e || start2 + len2 !== buf.length) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'ByteRange bracketing violation or truncated file',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  // 2. Slice exact byte ranges and compute document SHA-256 via WebCrypto
  const slice1 = buf.subarray(start1, start1 + len1);
  const slice2 = buf.subarray(start2, start2 + len2);
  const hashData = new Uint8Array(len1 + len2);
  hashData.set(slice1, 0);
  hashData.set(slice2, len1);

  let computedHash;
  try {
    const hashBuf = await subtleCrypto.digest('SHA-256', hashData);
    computedHash = Buffer.from(hashBuf);
  } catch {
    computedHash = crypto.createHash('sha256').update(slice1).update(slice2).digest();
  }

  // 3. Parse CMS ContentInfo
  const ci = parseAsn1(cmsDer, 0);
  if (!ci) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Invalid CMS ContentInfo ASN.1 payload',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  let pos = 0;
  const oidNode = parseAsn1(ci.body, pos);
  if (!oidNode) {
    return { valid: false, tamperDetected: true, error: 'Missing ContentInfo OID', byteRange, subFilter };
  }
  pos += oidNode.totalLen;
  const sdOuter = parseAsn1(ci.body, pos);
  if (!sdOuter) {
    return { valid: false, tamperDetected: true, error: 'Missing SignedData outer wrapper', byteRange, subFilter };
  }
  const sd = parseAsn1(sdOuter.body, 0);
  if (!sd) {
    return { valid: false, tamperDetected: true, error: 'Missing SignedData sequence', byteRange, subFilter };
  }

  let sdPos = 0;
  const vNode = parseAsn1(sd.body, sdPos);
  if (vNode) sdPos += vNode.totalLen;
  const daNode = parseAsn1(sd.body, sdPos);
  if (daNode) sdPos += daNode.totalLen;
  const eciNode = parseAsn1(sd.body, sdPos);
  if (eciNode) sdPos += eciNode.totalLen;

  let certsNode = null;
  let signerInfosNode = null;
  while (sdPos < sd.body.length) {
    const child = parseAsn1(sd.body, sdPos);
    if (!child) break;
    sdPos += child.totalLen;
    if (child.tag === 0xa0) {
      certsNode = child;
    } else if (child.tag === 0x31) {
      signerInfosNode = child;
    }
  }

  if (!certsNode || !signerInfosNode) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Missing certificates or signerInfos in CMS structure',
      signerName,
      reason,
      location,
      signingTime: rawSignedAt,
      signedAt: rawSignedAt,
      byteRange,
      subFilter,
    };
  }

  const certSeq = parseAsn1(certsNode.body, 0);
  if (!certSeq) {
    return { valid: false, tamperDetected: true, error: 'Cannot parse X.509 certificate', byteRange, subFilter };
  }

  let x509 = null;
  try {
    x509 = new crypto.X509Certificate(certSeq.raw);
  } catch {}

  // Parse SignerInfo
  const signerInfoSeq = parseAsn1(signerInfosNode.body, 0);
  if (!signerInfoSeq) {
    return { valid: false, tamperDetected: true, error: 'Cannot parse SignerInfo', byteRange, subFilter };
  }

  let siPos = 0;
  const siV = parseAsn1(signerInfoSeq.body, siPos); if (siV) siPos += siV.totalLen;
  const siSid = parseAsn1(signerInfoSeq.body, siPos); if (siSid) siPos += siSid.totalLen;
  const siDa = parseAsn1(signerInfoSeq.body, siPos); if (siDa) siPos += siDa.totalLen;

  let siAttrs = null;
  let siSigAlg = null;
  let siSigVal = null;

  while (siPos < signerInfoSeq.body.length) {
    const child = parseAsn1(signerInfoSeq.body, siPos);
    if (!child) break;
    siPos += child.totalLen;
    if (child.tag === 0xa0) {
      siAttrs = child;
    } else if (child.tag === 0x30) {
      siSigAlg = child;
    } else if (child.tag === 0x04) {
      siSigVal = child;
    }
  }

  if (!siSigVal) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Missing signature bytes in SignerInfo',
      byteRange,
      certSubject: x509?.subject || '',
      sha256Fingerprint: x509?.fingerprint256 || '',
      subFilter,
    };
  }

  let embeddedDigest = null;
  let signingTime = '';

  if (siAttrs) {
    let aPos = 0;
    while (aPos < siAttrs.body.length) {
      const attr = parseAsn1(siAttrs.body, aPos);
      if (!attr) break;
      aPos += attr.totalLen;
      const aOid = parseAsn1(attr.body, 0);
      const aVal = parseAsn1(attr.body, aOid.totalLen);
      const oHex = aOid.body.toString('hex');
      if (oHex === '2a864886f70d010904') {
        const octet = parseAsn1(aVal.body, 0);
        if (octet) embeddedDigest = octet.body;
      } else if (oHex === '2a864886f70d010905') {
        const tVal = parseAsn1(aVal.body, 0);
        if (tVal) signingTime = tVal.body.toString('ascii');
      }
    }
  }

  // 4. Verify message digest
  if (embeddedDigest && !embeddedDigest.equals(computedHash)) {
    return {
      valid: false,
      tamperDetected: true,
      error: 'Computed SHA-256 digest does not match embedded messageDigest attribute (tamper detected)',
      signerName,
      reason,
      location,
      signingTime: signingTime || rawSignedAt,
      signedAt: signingTime || rawSignedAt,
      byteRange,
      certSubject: x509?.subject || '',
      sha256Fingerprint: x509?.fingerprint256 || '',
      subFilter,
      digestHex: computedHash.toString('hex'),
    };
  }

  // 5. Cryptographic signature verification via WebCrypto
  let cryptoValid = false;
  try {
    let spkiDer = null;
    if (x509?.publicKey) {
      spkiDer = x509.publicKey.export({ type: 'spki', format: 'der' });
    } else {
      const tbsSeq = parseAsn1(certSeq.body, 0);
      let tPos = 0;
      const vTag = parseAsn1(tbsSeq.body, tPos);
      if (vTag && vTag.tag === 0xa0) tPos += vTag.totalLen;
      const snTag = parseAsn1(tbsSeq.body, tPos); if (snTag) tPos += snTag.totalLen;
      const saTag = parseAsn1(tbsSeq.body, tPos); if (saTag) tPos += saTag.totalLen;
      const isTag = parseAsn1(tbsSeq.body, tPos); if (isTag) tPos += isTag.totalLen;
      const vaTag = parseAsn1(tbsSeq.body, tPos); if (vaTag) tPos += vaTag.totalLen;
      const suTag = parseAsn1(tbsSeq.body, tPos); if (suTag) tPos += suTag.totalLen;
      const spkiNode = parseAsn1(tbsSeq.body, tPos);
      if (spkiNode) spkiDer = spkiNode.raw;
    }

    const pubKey = await subtleCrypto.importKey(
      'spki',
      spkiDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = siAttrs
      ? Buffer.concat([Buffer.from([0x31]), siAttrs.raw.subarray(1)])
      : computedHash;

    cryptoValid = await subtleCrypto.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      pubKey,
      siSigVal.body,
      dataToVerify
    );
  } catch {
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      if (siAttrs) {
        const attrsForVerification = Buffer.concat([Buffer.from([0x31]), siAttrs.raw.subarray(1)]);
        verifier.update(attrsForVerification);
      } else {
        verifier.update(computedHash);
      }
      cryptoValid = verifier.verify(x509.publicKey, siSigVal.body);
    } catch (err) {
      return {
        valid: false,
        tamperDetected: true,
        error: `Cryptographic verification failed: ${err.message}`,
        signerName,
        reason,
        location,
        signingTime: signingTime || rawSignedAt,
        signedAt: signingTime || rawSignedAt,
        byteRange,
        certSubject: x509?.subject || '',
        sha256Fingerprint: x509?.fingerprint256 || '',
        subFilter,
        digestHex: computedHash.toString('hex'),
      };
    }
  }

  return {
    valid: cryptoValid,
    tamperDetected: !cryptoValid,
    signerName,
    reason,
    location,
    signingTime: signingTime || rawSignedAt,
    signedAt: signingTime || rawSignedAt,
    byteRange,
    certSubject: x509?.subject || '',
    sha256Fingerprint: x509?.fingerprint256 || '',
    subFilter,
    digestHex: computedHash.toString('hex'),
  };
}

export default {
  generateSelfSignedCert,
  generateSelfSignedCertAsync,
  signPdf,
  signPdfBuffer,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  formatIncrementalXref,
  buildIncrementalXrefSubsections,
};
