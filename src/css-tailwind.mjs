/**
 * VeloxPDF — Complete Tailwind v3/v4 JIT Utility Resolver & Full CSS Stylesheet Engine
 * Zero dependencies. Runs in Node.js, Bun, Cloudflare Workers, and Browsers.
 */

// ---------------------------------------------------------------------------
// 1. Full Tailwind v3/v4 Color Palette (22 families × 11 shades 50..950 + base)
// ---------------------------------------------------------------------------
const COLOR_FAMILIES = {
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
    500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
  },
  gray: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
    500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
  },
  zinc: {
    50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
    500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
  },
  neutral: {
    50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3',
    500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a',
  },
  stone: {
    50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e',
    500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09',
  },
  red: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
    500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
  },
  orange: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
    500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407',
  },
  amber: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
    500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
  },
  yellow: {
    50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15',
    500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006',
  },
  lime: {
    50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635',
    500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05',
  },
  green: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
    500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16',
  },
  emerald: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
    500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
  },
  teal: {
    50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
    500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
  },
  cyan: {
    50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
    500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344',
  },
  sky: {
    50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
    500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49',
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
    500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
  },
  indigo: {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
  },
  violet: {
    50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
    500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
  },
  purple: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
    500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
  },
  fuchsia: {
    50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9',
    500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e',
  },
  pink: {
    50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
    500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
  },
  rose: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
    500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
  },
};

export const TAILWIND_COLORS = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
};

for (const [family, shades] of Object.entries(COLOR_FAMILIES)) {
  for (const [shade, hex] of Object.entries(shades)) {
    TAILWIND_COLORS[`${family}-${shade}`] = hex;
  }
}

const TEXT_SIZES = {
  xs: { size: 8.5, lh: 12 },
  sm: { size: 9.5, lh: 14 },
  base: { size: 11, lh: 16 },
  lg: { size: 13, lh: 18 },
  xl: { size: 15, lh: 21 },
  '2xl': { size: 18, lh: 24 },
  '3xl': { size: 22, lh: 28 },
  '4xl': { size: 28, lh: 34 },
  '5xl': { size: 36, lh: 40 },
  '6xl': { size: 45, lh: 48 },
  '7xl': { size: 54, lh: 56 },
  '8xl': { size: 72, lh: 74 },
  '9xl': { size: 96, lh: 96 },
};

const FONT_WEIGHTS = {
  thin: { weight: 'normal', num: 100 },
  extralight: { weight: 'normal', num: 200 },
  light: { weight: 'normal', num: 300 },
  normal: { weight: 'normal', num: 400 },
  medium: { weight: 'normal', num: 500 },
  semibold: { weight: 'bold', num: 600 },
  bold: { weight: 'bold', num: 700 },
  extrabold: { weight: 'bold', num: 800 },
  black: { weight: 'bold', num: 900 },
};

const TRACKING_SCALE = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1.0,
};

const LEADING_SCALE = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

const MAX_W_SCALE = {
  none: Infinity,
  0: 0,
  xs: 240,
  sm: 288,
  md: 336,
  lg: 384,
  xl: 432,
  '2xl': 504,
  '3xl': 576,
  '4xl': 672,
  '5xl': 768,
  '6xl': 864,
  '7xl': 960,
  full: '100%',
  prose: 488,
};

const ROUNDED_SCALE = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 4,
  lg: 6,
  xl: 10,
  '2xl': 12,
  '3xl': 18,
  full: 999,
};

const SHADOW_SCALE = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.1)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
  '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
};

const GRADIENT_DIRS = {
  r: 'to right',
  l: 'to left',
  t: 'to top',
  b: 'to bottom',
  tr: 'to top right',
  tl: 'to top left',
  br: 'to bottom right',
  bl: 'to bottom left',
};

const PAGE_DIMENSIONS = {
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

// ---------------------------------------------------------------------------
// 2. CSS Value Evaluator (`var()`, `calc()`, `min()`, `max()`, `clamp()`, units)
// ---------------------------------------------------------------------------

/**
 * Resolves nested `var(--name, fallback)` expressions against `vars`.
 */
export function resolveCssVarsInString(str, vars = {}) {
  if (!str || typeof str !== 'string' || !str.includes('var(')) return str;
  let cur = str;
  for (let depth = 0; depth < 16 && cur.includes('var('); depth++) {
    let changed = false;
    let out = '';
    let i = 0;
    while (i < cur.length) {
      const idx = cur.indexOf('var(', i);
      if (idx === -1) {
        out += cur.slice(i);
        break;
      }
      out += cur.slice(i, idx);
      let pDepth = 1;
      let j = idx + 4;
      let commaIdx = -1;
      let quoteChar = null;
      while (j < cur.length && pDepth > 0) {
        const ch = cur[j];
        if (quoteChar) {
          if (ch === quoteChar && cur[j - 1] !== '\\') {
            quoteChar = null;
          }
        } else if (ch === '"' || ch === "'") {
          quoteChar = ch;
        } else if (ch === '(') {
          pDepth++;
        } else if (ch === ')') {
          pDepth--;
        } else if (ch === ',' && pDepth === 1 && commaIdx === -1) {
          commaIdx = j;
        }
        j++;
      }
      if (pDepth === 0) {
        const inner = cur.slice(idx + 4, j - 1);
        const varName = (commaIdx !== -1 ? cur.slice(idx + 4, commaIdx) : inner).trim();
        const fallback = commaIdx !== -1 ? cur.slice(commaIdx + 1, j - 1).trim() : '';
        const resolved =
          vars[varName] !== undefined && vars[varName] !== null && vars[varName] !== ''
            ? String(vars[varName]).trim()
            : fallback;
        out += resolved;
        changed = true;
        i = j;
      } else {
        out += cur.slice(idx);
        break;
      }
    }
    cur = out;
    if (!changed) break;
  }
  return cur;
}

function splitTopLevelCommas(expr) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(expr.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function splitTopLevelWhitespace(expr) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') {
      depth++;
      cur += ch;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      cur += ch;
    } else if (/\s/.test(ch) && depth === 0) {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

function evalUnitToken(token, ctx) {
  const s = token.trim();
  if (!s) return 0;
  const num = parseFloat(s);
  if (Number.isNaN(num)) return 0;
  const lower = s.toLowerCase();
  if (lower.endsWith('pt')) return num;
  if (lower.endsWith('px')) return num * 0.75;
  if (lower.endsWith('rem')) return num * (ctx.rootFontSize || 11);
  if (lower.endsWith('em')) return num * (ctx.baseFontSize || 11);
  if (lower.endsWith('mm')) return num * 2.834645669;
  if (lower.endsWith('cm')) return num * 28.34645669;
  if (lower.endsWith('in')) return num * 72;
  if (lower.endsWith('pc')) return num * 12;
  if (lower.endsWith('vw')) return (num / 100) * (ctx.viewportWidth || 595.28);
  if (lower.endsWith('vh')) return (num / 100) * (ctx.viewportHeight || 841.89);
  if (lower.endsWith('%')) {
    return ctx.percentBase != null ? (num / 100) * ctx.percentBase : (num / 100) * (ctx.baseFontSize || 11);
  }
  return num;
}

function evaluateArithmeticExpr(exprStr, ctx) {
  const normalized = exprStr.replace(
    /([+-]?(?:\d+\.?\d*|\.\d+))(px|pt|rem|em|mm|cm|in|pc|vw|vh|%)/gi,
    (full) => String(evalUnitToken(full, ctx)),
  );
  let pos = 0;
  const src = normalized.replace(/\s+/g, '');

  function parseExpression() {
    let val = parseTerm();
    while (pos < src.length && (src[pos] === '+' || src[pos] === '-')) {
      const op = src[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }

  function parseTerm() {
    let val = parseFactor();
    while (pos < src.length && (src[pos] === '*' || src[pos] === '/')) {
      const op = src[pos++];
      const right = parseFactor();
      val = op === '*' ? val * right : right !== 0 ? val / right : 0;
    }
    return val;
  }

  function parseFactor() {
    if (src[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (src[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (src[pos] === '(') {
      pos++;
      const val = parseExpression();
      if (src[pos] === ')') pos++;
      return val;
    }
    const start = pos;
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++;
    const n = parseFloat(src.slice(start, pos));
    return Number.isNaN(n) ? 0 : n;
  }

  const res = parseExpression();
  return Number.isFinite(res) ? res : 0;
}

/**
 * Evaluates a CSS `calc(...)` arithmetic expression against `availW` and `fontSize`.
 * Preserves full operation precedence (+, -, *, /) and unit conversion (%, px, pt, rem, em, mm, cm, in).
 */
export function evaluateCalc(expr, availW = 595.28, fontSize = 11) {
  if (typeof expr === 'number') return expr;
  if (expr == null || expr === '') return 0;
  let str = String(expr).trim();
  if (str.toLowerCase().startsWith('calc(') && str.endsWith(')')) {
    str = str.slice(5, -1).trim();
  }
  str = str.replace(/calc\(/gi, '(');
  const ctx = {
    baseFontSize: fontSize || 11,
    rootFontSize: 11,
    percentBase: typeof availW === 'number' ? availW : 595.28,
    viewportWidth: typeof availW === 'number' ? availW : 595.28,
    viewportHeight: 841.89,
    vars: {},
  };
  return evaluateArithmeticExpr(str, ctx);
}

/**
 * Evaluates a CSS value (`var()`, `calc()`, `min()`, `max()`, `clamp()`, and units
 * `px`, `pt`, `mm`, `cm`, `in`, `rem`, `em`, `%`, `vh`, `vw`) into PDF points (`pt`).
 */
export function evaluateCssValue(valStr, baseFontSize = 11, vars = {}) {
  if (typeof valStr === 'number') return valStr;
  if (valStr == null || valStr === '') return 0;

  const ctx = {
    baseFontSize: 11,
    rootFontSize: 11,
    viewportWidth: 595.28,
    viewportHeight: 841.89,
    percentBase: null,
    vars: vars || {},
  };

  if (typeof baseFontSize === 'number') {
    ctx.baseFontSize = baseFontSize;
  } else if (typeof baseFontSize === 'object' && baseFontSize !== null) {
    ctx.baseFontSize = baseFontSize.fontSize ?? baseFontSize.baseFontSize ?? 11;
    ctx.rootFontSize = baseFontSize.rootFontSize ?? 11;
    ctx.viewportWidth = baseFontSize.viewportWidth ?? 595.28;
    ctx.viewportHeight = baseFontSize.viewportHeight ?? 841.89;
    ctx.percentBase = baseFontSize.percentBase ?? baseFontSize.parentWidth ?? baseFontSize.baseSize ?? null;
    ctx.vars = baseFontSize.vars || baseFontSize.variables || baseFontSize.customProperties || vars || baseFontSize;
  }

  const s = resolveCssVarsInString(String(valStr).trim(), ctx.vars).trim();
  if (!s) return 0;

  const lower = s.toLowerCase();
  if (lower.startsWith('calc(') && s.endsWith(')')) {
    return evaluateArithmeticExpr(s.slice(5, -1), ctx);
  }
  if (lower.startsWith('min(') && s.endsWith(')')) {
    const args = splitTopLevelCommas(s.slice(4, -1)).map((a) => evaluateCssValue(a, ctx, ctx.vars));
    return args.length ? Math.min(...args) : 0;
  }
  if (lower.startsWith('max(') && s.endsWith(')')) {
    const args = splitTopLevelCommas(s.slice(4, -1)).map((a) => evaluateCssValue(a, ctx, ctx.vars));
    return args.length ? Math.max(...args) : 0;
  }
  if (lower.startsWith('clamp(') && s.endsWith(')')) {
    const args = splitTopLevelCommas(s.slice(6, -1)).map((a) => evaluateCssValue(a, ctx, ctx.vars));
    if (args.length >= 3) {
      return Math.min(args[2], Math.max(args[0], args[1]));
    }
    return args[0] || 0;
  }

  if (/[+\-*/]/.test(s.slice(1)) && /\d/.test(s) && !s.startsWith('#') && /\s[+\-*/]\s/.test(s)) {
    return evaluateArithmeticExpr(s, ctx);
  }

  return evalUnitToken(s, ctx);
}

// ---------------------------------------------------------------------------
// 3. Complete Tailwind v3/v4 JIT Utility Resolver
// ---------------------------------------------------------------------------

function parseTailwindSpacing(raw, allowNegative = false) {
  let str = raw;
  let sign = 1;
  if (allowNegative && str.startsWith('-')) {
    sign = -1;
    str = str.slice(1);
  }
  if (str.startsWith('[') && str.endsWith(']')) {
    const inner = str.slice(1, -1).replace(/_/g, ' ');
    return sign * evaluateCssValue(inner, 11);
  }
  if (str === 'px') return sign * 0.75;
  if (str === '0') return 0;
  const n = parseFloat(str);
  if (!Number.isNaN(n)) return sign * n * 3;
  return null;
}

function resolveTailwindColorToken(token) {
  if (!token) return null;
  let core = token;
  if (core.includes('/')) {
    core = core.split('/')[0];
  }
  if (core.startsWith('[') && core.endsWith(']')) {
    return core.slice(1, -1).replace(/_/g, ' ');
  }
  if (TAILWIND_COLORS[core]) return TAILWIND_COLORS[core];
  return null;
}

const tailwindCache = new Map();

export function resolveTailwindClasses(classStr) {
  if (!classStr) return {};
  const key = Array.isArray(classStr) ? classStr.join(' ') : String(classStr);
  if (tailwindCache.has(key)) {
    const cached = tailwindCache.get(key);
    const clone = { ...cached };
    if (cached.gradient) clone.gradient = { ...cached.gradient };
    return clone;
  }

  const st = {};
  const tokens = key.split(/\s+/).filter(Boolean);
  const transforms = [];

  for (let rawToken of tokens) {
    if (rawToken.includes(':')) {
      const parts = rawToken.split(':');
      const prefix = parts[0];
      if (prefix === 'dark' || prefix === 'hover' || prefix === 'focus' || prefix === 'active') {
        continue;
      }
      rawToken = parts[parts.length - 1];
    }
    const t = rawToken.startsWith('!') ? rawToken.slice(1) : rawToken;
    if (!t) continue;

    // 1. Layout & Display
    if (
      t === 'block' ||
      t === 'inline-block' ||
      t === 'inline' ||
      t === 'flex' ||
      t === 'inline-flex' ||
      t === 'grid' ||
      t === 'inline-grid' ||
      t === 'table' ||
      t === 'table-row' ||
      t === 'table-cell' ||
      t === 'contents' ||
      t === 'list-item'
    ) {
      st.display = t;
      continue;
    }
    if (t === 'hidden') {
      st.display = 'none';
      continue;
    }
    if (t === 'static' || t === 'relative' || t === 'absolute' || t === 'fixed' || t === 'sticky') {
      st.position = t;
      continue;
    }
    if (/^list-(none|disc|decimal|circle|square)$/.test(t)) { st.listStyleType = t.slice(5); continue; }
    if (t === 'float-left') {
      st.float = 'left';
      continue;
    }
    if (t === 'float-right') {
      st.float = 'right';
      continue;
    }
    if (t === 'float-none') {
      st.float = 'none';
      continue;
    }
    if (t.startsWith('z-') || t.startsWith('-z-')) {
      const neg = t.startsWith('-');
      const clean = neg ? t.slice(3) : t.slice(2);
      if (clean === 'auto') {
        st.zIndex = 0;
      } else if (clean.startsWith('[') && clean.endsWith(']')) {
        st.zIndex = (neg ? -1 : 1) * (parseInt(clean.slice(1, -1), 10) || 0);
      } else {
        const parsed = parseInt(clean, 10);
        if (!Number.isNaN(parsed)) {
          st.zIndex = (neg ? -1 : 1) * parsed;
        }
      }
      continue;
    }
    if (/^-?(top|right|bottom|left|inset|inset-x|inset-y)-(.+)$/.test(t)) {
      const neg = t.startsWith('-');
      const clean = neg ? t.slice(1) : t;
      const m = clean.match(/^(top|right|bottom|left|inset|inset-x|inset-y)-(.+)$/);
      if (m) {
        const prop = m[1];
        const rawVal = m[2];
        let v = null;
        if (rawVal === 'auto') {
          v = 'auto';
        } else if (rawVal === 'full') {
          v = neg ? '-100%' : '100%';
        } else if (/^\d+\/\d+$/.test(rawVal)) {
          const [num, den] = rawVal.split('/').map(Number);
          if (den) {
            const pct = +(num / den * 100).toFixed(4);
            v = `${neg ? -pct : pct}%`;
          }
        } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
          const inner = rawVal.slice(1, -1).replace(/_/g, ' ');
          if (inner.endsWith('%')) {
            const pct = parseFloat(inner);
            v = `${neg ? -pct : pct}%`;
          } else if (inner.toLowerCase().startsWith('calc(')) {
            v = neg ? `calc(-1 * (${inner}))` : inner;
          } else {
            const num = evaluateCssValue(inner, 11);
            v = neg ? -num : num;
          }
        } else {
          v = parseTailwindSpacing(neg ? `-${rawVal}` : rawVal, true);
        }
        if (v !== null) {
          if (prop === 'top' || prop === 'inset' || prop === 'inset-y') st.top = v;
          if (prop === 'bottom' || prop === 'inset' || prop === 'inset-y') st.bottom = v;
          if (prop === 'left' || prop === 'inset' || prop === 'inset-x') st.left = v;
          if (prop === 'right' || prop === 'inset' || prop === 'inset-x') st.right = v;
          continue;
        }
      }
    }
    if (t.startsWith('opacity-')) {
      const rest = t.slice(8);
      if (rest.startsWith('[') && rest.endsWith(']')) {
        st.opacity = parseFloat(rest.slice(1, -1));
      } else {
        const val = parseFloat(rest);
        if (!Number.isNaN(val)) {
          st.opacity = val > 1 ? val / 100 : val;
        }
      }
      continue;
    }

    // 2. Flexbox & Grid
    if (t === 'flex-row') { st.flexDirection = 'row'; continue; }
    if (t === 'flex-row-reverse') { st.flexDirection = 'row-reverse'; continue; }
    if (t === 'flex-col') { st.flexDirection = 'column'; continue; }
    if (t === 'flex-col-reverse') { st.flexDirection = 'column-reverse'; continue; }
    if (t === 'flex-wrap') { st.flexWrap = 'wrap'; continue; }
    if (t === 'flex-wrap-reverse') { st.flexWrap = 'wrap-reverse'; continue; }
    if (t === 'flex-nowrap') { st.flexWrap = 'nowrap'; continue; }
    if (t === 'flex-1') { st.flex = '1 1 0%'; st.flexGrow = 1; st.flexShrink = 1; st.flexBasis = 0; continue; }
    if (t === 'flex-auto') { st.flex = '1 1 auto'; st.flexGrow = 1; st.flexShrink = 1; continue; }
    if (t === 'flex-initial') { st.flex = '0 1 auto'; st.flexGrow = 0; st.flexShrink = 1; continue; }
    if (t === 'flex-none') { st.flex = 'none'; st.flexGrow = 0; st.flexShrink = 0; continue; }
    if (t === 'grow' || t === 'flex-grow') { st.flexGrow = 1; continue; }
    if (t === 'grow-0' || t === 'flex-grow-0') { st.flexGrow = 0; continue; }
    if (t === 'shrink' || t === 'flex-shrink') { st.flexShrink = 1; continue; }
    if (t === 'shrink-0' || t === 'flex-shrink-0') { st.flexShrink = 0; continue; }
    if (t.startsWith('flex-[') && t.endsWith(']')) {
      const val = t.slice(6, -1);
      const num = parseFloat(val);
      if (!isNaN(num)) { st.flexGrow = num; st.flex = val; }
      continue;
    }
    if (t.startsWith('grow-[') && t.endsWith(']')) {
      const val = t.slice(6, -1);
      const num = parseFloat(val);
      if (!isNaN(num)) st.flexGrow = num;
      continue;
    }

    if (t === 'items-start') { st.alignItems = 'flex-start'; continue; }
    if (t === 'items-center') { st.alignItems = 'center'; continue; }
    if (t === 'items-end') { st.alignItems = 'flex-end'; continue; }
    if (t === 'items-baseline') { st.alignItems = 'baseline'; continue; }
    if (t === 'items-stretch') { st.alignItems = 'stretch'; continue; }

    if (t === 'justify-start') { st.justifyContent = 'flex-start'; continue; }
    if (t === 'justify-center') { st.justifyContent = 'center'; continue; }
    if (t === 'justify-end') { st.justifyContent = 'flex-end'; continue; }
    if (t === 'justify-between') { st.justifyContent = 'space-between'; continue; }
    if (t === 'justify-around') { st.justifyContent = 'space-around'; continue; }
    if (t === 'justify-evenly') { st.justifyContent = 'space-evenly'; continue; }

    if (t.startsWith('grid-cols-')) {
      const rest = t.slice(10);
      st.gridCols = rest === 'none' ? 1 : parseInt(rest, 10) || 1;
      st.gridTemplateColumns = `repeat(${st.gridCols}, minmax(0, 1fr))`;
      continue;
    }
    if (t.startsWith('col-span-')) {
      const rest = t.slice(9);
      st.colSpan = rest === 'full' ? 12 : parseInt(rest, 10) || 1;
      continue;
    }
    if (t.startsWith('gap-x-')) {
      const v = parseTailwindSpacing(t.slice(6));
      if (v !== null) { st.gapX = v; st.columnGap = v; if (st.gap == null) st.gap = v; }
      continue;
    }
    if (t.startsWith('gap-y-')) {
      const v = parseTailwindSpacing(t.slice(6));
      if (v !== null) { st.gapY = v; st.rowGap = v; if (st.gap == null) st.gap = v; }
      continue;
    }
    if (t.startsWith('gap-')) {
      const v = parseTailwindSpacing(t.slice(4));
      if (v !== null) { st.gap = v; st.gapX = v; st.gapY = v; st.columnGap = v; st.rowGap = v; }
      continue;
    }

    // 3. Spacing (Padding, Margin, Space Between)
    if (/^p[xytrbl]?-(.+)$/.test(t)) {
      const m = t.match(/^(p[xytrbl]?)-(.+)$/);
      const dir = m[1];
      const v = parseTailwindSpacing(m[2]);
      if (v !== null) {
        if (dir === 'p') st.paddingTop = st.paddingRight = st.paddingBottom = st.paddingLeft = v;
        else if (dir === 'px') st.paddingLeft = st.paddingRight = v;
        else if (dir === 'py') st.paddingTop = st.paddingBottom = v;
        else if (dir === 'pt') st.paddingTop = v;
        else if (dir === 'pr') st.paddingRight = v;
        else if (dir === 'pb') st.paddingBottom = v;
        else if (dir === 'pl') st.paddingLeft = v;
        continue;
      }
    }
    if (/^-?m[xytrbl]?-(.+)$/.test(t)) {
      const neg = t.startsWith('-');
      const clean = neg ? t.slice(1) : t;
      const m = clean.match(/^(m[xytrbl]?)-(.+)$/);
      if (m) {
        const dir = m[1];
        const rawVal = m[2];
        if (rawVal === 'auto') {
          if (dir === 'm' || dir === 'mx') { st.marginLeft = 'auto'; st.marginRight = 'auto'; }
          if (dir === 'm' || dir === 'my') { st.marginTop = 0; st.marginBottom = 0; }
          continue;
        }
        const v = parseTailwindSpacing(neg ? `-${rawVal}` : rawVal, true);
        if (v !== null) {
          if (dir === 'm') st.marginTop = st.marginRight = st.marginBottom = st.marginLeft = v;
          else if (dir === 'mx') st.marginLeft = st.marginRight = v;
          else if (dir === 'my') st.marginTop = st.marginBottom = v;
          else if (dir === 'mt') st.marginTop = v;
          else if (dir === 'mr') st.marginRight = v;
          else if (dir === 'mb') st.marginBottom = v;
          else if (dir === 'ml') st.marginLeft = v;
          continue;
        }
      }
    }
    if (t.startsWith('space-y-') || t.startsWith('-space-y-')) {
      const neg = t.startsWith('-');
      const v = parseTailwindSpacing(neg ? `-${t.slice(9)}` : t.slice(8), true);
      if (v !== null) st.spaceY = v;
      continue;
    }
    if (t.startsWith('space-x-') || t.startsWith('-space-x-')) {
      const neg = t.startsWith('-');
      const v = parseTailwindSpacing(neg ? `-${t.slice(9)}` : t.slice(8), true);
      if (v !== null) st.spaceX = v;
      continue;
    }

    // 4. Sizing (`w-*`, `h-*`, `min-h-*`, `max-w-*`)
    if (t.startsWith('w-')) {
      const rest = t.slice(2);
      if (rest === 'full' || rest === 'screen') { st.widthPercent = 100; st.width = '100%'; }
      else if (rest === 'auto' || rest === 'fit' || rest === 'min' || rest === 'max') { st.width = rest; }
      else if (/^\d+\/\d+$/.test(rest)) {
        const [num, den] = rest.split('/').map(Number);
        if (den) {
          st.widthPercent = +(num / den * 100).toFixed(4);
          st.width = `${st.widthPercent}%`;
        }
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        const inner = rest.slice(1, -1).replace(/_/g, ' ');
        if (inner.endsWith('%')) {
          st.widthPercent = parseFloat(inner);
          st.width = inner;
        } else if (inner.toLowerCase().startsWith('calc(')) {
          st.width = inner;
        } else {
          st.width = evaluateCssValue(inner, 11);
        }
      } else {
        const v = parseTailwindSpacing(rest);
        if (v !== null) st.width = v;
      }
      continue;
    }
    if (t.startsWith('h-')) {
      const rest = t.slice(2);
      if (rest === 'full' || rest === 'screen') { st.heightPercent = 100; st.height = '100%'; }
      else if (rest === 'auto') { st.height = 'auto'; }
      else if (/^\d+\/\d+$/.test(rest)) {
        const [num, den] = rest.split('/').map(Number);
        if (den) st.heightPercent = +(num / den * 100).toFixed(4);
      } else {
        const v = parseTailwindSpacing(rest);
        if (v !== null) st.height = v;
      }
      continue;
    }
    if (t.startsWith('min-h-')) {
      const rest = t.slice(6);
      if (rest === 'full' || rest === 'screen') st.minHeight = '100%';
      else {
        const v = parseTailwindSpacing(rest);
        if (v !== null) st.minHeight = v;
      }
      continue;
    }
    if (t.startsWith('max-w-')) {
      const rest = t.slice(6);
      if (MAX_W_SCALE[rest] !== undefined) st.maxWidth = MAX_W_SCALE[rest];
      else {
        const v = parseTailwindSpacing(rest);
        if (v !== null) st.maxWidth = v;
      }
      continue;
    }

    // 5. Typography
    if (t === 'italic') { st.fontStyle = 'italic'; continue; }
    if (t === 'not-italic') { st.fontStyle = 'normal'; continue; }
    if (t === 'underline') { st.textDecoration = 'underline'; continue; }
    if (t === 'line-through') { st.textDecoration = 'line-through'; continue; }
    if (t === 'no-underline') { st.textDecoration = 'none'; continue; }
    if (t === 'uppercase') { st.textTransform = 'uppercase'; continue; }
    if (t === 'lowercase') { st.textTransform = 'lowercase'; continue; }
    if (t === 'capitalize') { st.textTransform = 'capitalize'; continue; }
    if (t === 'normal-case') { st.textTransform = 'none'; continue; }

    if (t === 'text-left' || t === 'text-center' || t === 'text-right' || t === 'text-justify') {
      st.textAlign = t.slice(5);
      continue;
    }

    if (t.startsWith('font-')) {
      const rest = t.slice(5);
      if (rest === 'mono') { st.fontFamily = 'Courier'; continue; }
      if (rest === 'serif') { st.fontFamily = 'Times-Roman'; continue; }
      if (rest === 'sans') { st.fontFamily = 'Helvetica'; continue; }
      if (FONT_WEIGHTS[rest]) {
        st.fontWeight = FONT_WEIGHTS[rest].weight;
        st.fontWeightNumeric = FONT_WEIGHTS[rest].num;
        continue;
      }
    }

    if (t.startsWith('tracking-')) {
      const rest = t.slice(9);
      if (TRACKING_SCALE[rest] !== undefined) st.letterSpacing = TRACKING_SCALE[rest];
      else if (rest.startsWith('[') && rest.endsWith(']')) st.letterSpacing = evaluateCssValue(rest.slice(1, -1), st.fontSize || 11);
      continue;
    }

    if (t.startsWith('leading-')) {
      const rest = t.slice(8);
      if (LEADING_SCALE[rest] !== undefined) {
        st.lineHeightRatio = LEADING_SCALE[rest];
        st.lineHeight = (st.fontSize || 11) * LEADING_SCALE[rest];
      } else {
        const v = parseTailwindSpacing(rest);
        if (v !== null) st.lineHeight = v;
      }
      continue;
    }

    if (t.startsWith('text-')) {
      const rest = t.slice(5);
      if (TEXT_SIZES[rest]) {
        st.fontSize = TEXT_SIZES[rest].size;
        st.lineHeight = TEXT_SIZES[rest].lh;
        continue;
      }
      const col = resolveTailwindColorToken(rest);
      if (col) {
        st.color = col;
        continue;
      }
      if (rest.startsWith('[') && rest.endsWith(']')) {
        const inner = rest.slice(1, -1).replace(/_/g, ' ');
        if (inner.startsWith('#') || inner.startsWith('rgb') || inner.startsWith('hsl')) {
          st.color = inner;
        } else {
          st.fontSize = evaluateCssValue(inner, 11);
        }
        continue;
      }
    }

    // 6. Backgrounds & Gradients
    if (t.startsWith('bg-gradient-to-') || t.startsWith('bg-linear-to-')) {
      const dirKey = t.replace(/^bg-(?:gradient|linear)-to-/, '');
      const dir = GRADIENT_DIRS[dirKey] || 'to right';
      st.gradient = { ...(st.gradient || {}), direction: dir };
      st.gradientDirection = dir;
      continue;
    }
    if (t.startsWith('from-')) {
      const col = resolveTailwindColorToken(t.slice(5));
      if (col) {
        st.gradient = { ...(st.gradient || {}), from: col, to: st.gradient?.to || col };
        st.gradientFrom = col;
        if (!st.backgroundColor) st.backgroundColor = col;
      }
      continue;
    }
    if (t.startsWith('via-')) {
      const col = resolveTailwindColorToken(t.slice(4));
      if (col) {
        st.gradient = { ...(st.gradient || {}), via: col };
        st.gradientVia = col;
      }
      continue;
    }
    if (t.startsWith('to-')) {
      const col = resolveTailwindColorToken(t.slice(3));
      if (col) {
        st.gradient = { ...(st.gradient || {}), to: col, from: st.gradient?.from || col };
        st.gradientTo = col;
      }
      continue;
    }
    if (t.startsWith('bg-')) {
      const col = resolveTailwindColorToken(t.slice(3));
      if (col) {
        st.backgroundColor = col;
        continue;
      }
    }

    // 7. Borders, Radius & Shadows
    if (t === 'border') {
      st.borderWidth = 1;
      st.borderTopWidth = st.borderRightWidth = st.borderBottomWidth = st.borderLeftWidth = 1;
      if (!st.borderStyle) st.borderStyle = 'solid';
      if (!st.borderColor) st.borderColor = '#e2e8f0';
      continue;
    }
    if (t === 'border-0' || t === 'border-2' || t === 'border-4' || t === 'border-8') {
      const w = parseInt(t.slice(7), 10) * 0.75;
      st.borderWidth = w;
      st.borderTopWidth = st.borderRightWidth = st.borderBottomWidth = st.borderLeftWidth = w;
      if (!st.borderStyle) st.borderStyle = w > 0 ? 'solid' : 'none';
      if (!st.borderColor && w > 0) st.borderColor = '#e2e8f0';
      continue;
    }
    if (/^border-[trblxy](?:-([0-9.]+|\[.+\]))?$/.test(t)) {
      const m = t.match(/^border-([trblxy])(?:-(.+))?$/);
      const side = m[1];
      const rawW = m[2];
      const w = rawW === undefined ? 1 : rawW.startsWith('[') ? evaluateCssValue(rawW.slice(1, -1)) : parseFloat(rawW) * 0.75;
      if (!st.borderStyle) st.borderStyle = 'solid';
      if (!st.borderColor) st.borderColor = '#e2e8f0';
      if (side === 't' || side === 'y') st.borderTopWidth = w;
      if (side === 'b' || side === 'y') st.borderBottomWidth = w;
      if (side === 'l' || side === 'x') st.borderLeftWidth = w;
      if (side === 'r' || side === 'x') st.borderRightWidth = w;
      continue;
    }
    if (t === 'border-solid' || t === 'border-dashed' || t === 'border-dotted' || t === 'border-double' || t === 'border-none') {
      st.borderStyle = t.slice(7);
      continue;
    }
    if (t.startsWith('border-')) {
      const rest = t.slice(7);
      const col = resolveTailwindColorToken(rest);
      if (col) {
        st.borderColor = col;
        if (!st.borderLeftColor) st.borderLeftColor = col;
        if (!st.borderRightColor) st.borderRightColor = col;
        if (!st.borderTopColor) st.borderTopColor = col;
        if (!st.borderBottomColor) st.borderBottomColor = col;
        continue;
      }
      if (/^[trbl]-/.test(rest)) {
        const side = rest[0];
        const sideCol = resolveTailwindColorToken(rest.slice(2));
        if (sideCol) {
          if (side === 't') st.borderTopColor = sideCol;
          else if (side === 'r') st.borderRightColor = sideCol;
          else if (side === 'b') st.borderBottomColor = sideCol;
          else if (side === 'l') st.borderLeftColor = sideCol;
          continue;
        }
      }
    }

    if (t === 'rounded') { st.borderRadius = ROUNDED_SCALE.DEFAULT; continue; }
    if (t.startsWith('rounded-')) {
      const rest = t.slice(8);
      if (ROUNDED_SCALE[rest] !== undefined) st.borderRadius = ROUNDED_SCALE[rest];
      else if (rest.startsWith('[') && rest.endsWith(']')) st.borderRadius = evaluateCssValue(rest.slice(1, -1), 11);
      continue;
    }

    if (t === 'shadow') { st.boxShadow = SHADOW_SCALE.DEFAULT; continue; }
    if (t.startsWith('shadow-')) {
      const rest = t.slice(7);
      if (SHADOW_SCALE[rest] !== undefined) st.boxShadow = SHADOW_SCALE[rest];
      continue;
    }

    // 8. Transforms & Page Breaks
    if (t.startsWith('rotate-') || t.startsWith('-rotate-')) {
      const neg = t.startsWith('-');
      const raw = neg ? t.slice(8) : t.slice(7);
      const deg = (neg ? -1 : 1) * (raw.startsWith('[') ? parseFloat(raw.slice(1, -1)) : parseFloat(raw) || 0);
      st.rotate = deg;
      transforms.push(`rotate(${deg}deg)`);
      continue;
    }
    if (t.startsWith('scale-')) {
      const raw = t.slice(6);
      const sc = raw.startsWith('[') ? parseFloat(raw.slice(1, -1)) : (parseFloat(raw) || 100) / 100;
      st.scale = sc;
      transforms.push(`scale(${sc})`);
      continue;
    }
    if (t.startsWith('translate-x-') || t.startsWith('-translate-x-')) {
      const neg = t.startsWith('-');
      const v = parseTailwindSpacing(neg ? `-${t.slice(13)}` : t.slice(12), true);
      if (v !== null) {
        st.translateX = v;
        transforms.push(`translateX(${v}pt)`);
      }
      continue;
    }
    if (t.startsWith('translate-y-') || t.startsWith('-translate-y-')) {
      const neg = t.startsWith('-');
      const v = parseTailwindSpacing(neg ? `-${t.slice(13)}` : t.slice(12), true);
      if (v !== null) {
        st.translateY = v;
        transforms.push(`translateY(${v}pt)`);
      }
      continue;
    }

    if (t === 'break-inside-avoid' || t === 'break-inside-avoid-page' || t === 'page-break-inside-avoid') {
      st.breakInside = 'avoid';
      st.pageBreakInside = 'avoid';
      st['break-inside'] = 'avoid';
      st['page-break-inside'] = 'avoid';
      continue;
    }
    if (t === 'break-inside-auto') {
      st.breakInside = 'auto';
      st.pageBreakInside = 'auto';
      st['break-inside'] = 'auto';
      st['page-break-inside'] = 'auto';
      continue;
    }
    if (t === 'break-before-page' || t === 'page-break-before-always' || t === 'break-before-always') {
      st.breakBefore = 'page';
      st.pageBreakBefore = 'always';
      st['break-before'] = 'page';
      st['page-break-before'] = 'always';
      continue;
    }
    if (t === 'break-before-avoid' || t === 'page-break-before-avoid') {
      st.breakBefore = 'avoid';
      st.pageBreakBefore = 'avoid';
      st['break-before'] = 'avoid';
      st['page-break-before'] = 'avoid';
      continue;
    }
    if (t === 'break-before-auto') {
      st.breakBefore = 'auto';
      st.pageBreakBefore = 'auto';
      st['break-before'] = 'auto';
      st['page-break-before'] = 'auto';
      continue;
    }
    if (t === 'break-after-page' || t === 'page-break-after-always' || t === 'break-after-always') {
      st.breakAfter = 'page';
      st.pageBreakAfter = 'always';
      st['break-after'] = 'page';
      st['page-break-after'] = 'always';
      continue;
    }
    if (t === 'break-after-avoid' || t === 'page-break-after-avoid') {
      st.breakAfter = 'avoid';
      st.pageBreakAfter = 'avoid';
      st['break-after'] = 'avoid';
      st['page-break-after'] = 'avoid';
      continue;
    }
    if (t === 'break-after-auto') {
      st.breakAfter = 'auto';
      st.pageBreakAfter = 'auto';
      st['break-after'] = 'auto';
      st['page-break-after'] = 'auto';
      continue;
    }
  }

  if (transforms.length > 0) {
    st.transform = transforms.join(' ');
  }
  if (st.gradient && st.gradient.from) {
    const stops = [st.gradient.from, st.gradient.via, st.gradient.to || st.gradient.from].filter(Boolean);
    st.backgroundImage = `linear-gradient(${st.gradient.direction || 'to right'}, ${stops.join(', ')})`;
  }

  if (tailwindCache.size < 2000) {
    const cached = { ...st };
    if (st.gradient) cached.gradient = { ...st.gradient };
    tailwindCache.set(key, cached);
  }
  return st;
}

// ---------------------------------------------------------------------------
// 4. Full CSS Stylesheet Parser (`@page`, `@media print`, custom vars, specificity)
// ---------------------------------------------------------------------------

export function splitSelectorList(sel) {
  if (!sel || typeof sel !== 'string') return [];
  const parts = [];
  let buf = '';
  let depthParen = 0;
  let depthBracket = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);

    if (ch === ',' && depthParen === 0 && depthBracket === 0) {
      const trimmed = buf.trim();
      if (trimmed) parts.push(trimmed);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const last = buf.trim();
  if (last) parts.push(last);
  return parts;
}

export function computeSelectorSpecificity(selectorStr) {
  if (selectorStr == null) return 0;
  if (selectorStr instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(selectorStr))) {
    selectorStr = new TextDecoder('utf-8').decode(selectorStr);
  } else if (typeof selectorStr !== 'string') {
    selectorStr = String(selectorStr || '');
  }

  const parts = splitSelectorList(selectorStr);
  if (parts.length > 1) {
    let maxSpec = 0;
    for (const p of parts) {
      const sp = computeSelectorSpecificity(p);
      if (sp > maxSpec) maxSpec = sp;
    }
    return maxSpec;
  }

  let s = selectorStr.trim();
  if (!s || s === '*') return 0;

  // Unwrap :not(...) so its arguments are counted according to W3C Selectors Level 3
  while (/:not\(([^()]*)\)/i.test(s)) {
    s = s.replace(/:not\(([^()]*)\)/gi, ' $1 ');
  }

  let ids = 0;
  let classesAndAttrs = 0;
  let tags = 0;

  // 1. Attribute selectors [attr], [attr=val]
  const attrMatches = s.match(/\[[^\]]+\]/g);
  if (attrMatches) classesAndAttrs += attrMatches.length;
  s = s.replace(/\[[^\]]+\]/g, ' ');

  // 2. Pseudo-elements ::before, ::after (counted as tags/elements in W3C)
  const pseudoElemMatches = s.match(/::[a-zA-Z0-9_-]+/g);
  if (pseudoElemMatches) tags += pseudoElemMatches.length;
  s = s.replace(/::[a-zA-Z0-9_-]+/g, ' ');

  // 3. IDs #id
  const idMatches = s.match(/#[a-zA-Z0-9_-]+/g);
  if (idMatches) ids += idMatches.length;
  s = s.replace(/#[a-zA-Z0-9_-]+/g, ' ');

  // 4. Pseudo-classes :pseudo (like :nth-child(...), :first-child, :last-child, excluding :not wrapper)
  const pseudoMatches = s.match(/:[a-zA-Z0-9_-]+(?:\([^)]*\))?/g);
  if (pseudoMatches) classesAndAttrs += pseudoMatches.length;
  s = s.replace(/:[a-zA-Z0-9_-]+(?:\([^)]*\))?/g, ' ');

  // 5. Classes .class
  const classMatches = s.match(/\.[a-zA-Z0-9_-]+/g);
  if (classMatches) classesAndAttrs += classMatches.length;
  s = s.replace(/\.[a-zA-Z0-9_-]+/g, ' ');

  // 6. Element / Tag names (div, p, table, th, td, span, etc., excluding * and combinators >, +, ~)
  const tagTokens = s.split(/[\s>+~]+/).map((x) => x.trim()).filter(Boolean);
  for (const tk of tagTokens) {
    if (tk !== '*' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tk)) {
      tags += 1;
    }
  }

  return (ids * 1000000) + (classesAndAttrs * 1000) + tags;
}

// `font: italic bold 14px/1.6 Arial, sans-serif` into longhands. Anything it cannot read (system fonts) is ignored.
function expandFontShorthand(v) {
  const m = /^(?:(italic|oblique)\s+)?(?:(bold|bolder|[1-9]00)\s+)?(?:(?:normal|small-caps)\s+)*([\d.]+(?:px|pt|em|rem|%))(?:\s*\/\s*([\d.]+(?:px|pt|em|rem|%)?|normal))?\s+(.+)$/i.exec(String(v).trim());
  if (!m) return [];
  const out = [['font-style', m[1] ? 'italic' : 'normal'], ['font-weight', m[2] ? (/^bold/i.test(m[2]) || parseInt(m[2], 10) >= 600 ? 'bold' : 'normal') : 'normal'], ['font-size', m[3]]];
  if (m[4]) out.push(['line-height', m[4]]);
  out.push(['font-family', m[5]]);
  return out;
}
function parseDeclarationsBlock(body, vars) {
  const decls = {};
  const importantProps = new Set();
  const importantDecls = {};
  const normalDecls = {};

  if (!body || typeof body !== 'string') return decls;

  for (const d of body.split(';')) {
    const idx = d.indexOf(':');
    if (idx > 0) {
      const k = d.slice(0, idx).trim();
      const rawVal = d.slice(idx + 1).trim();
      const isImportant = /!important\s*$/i.test(rawVal);
      const v = rawVal.replace(/!important\s*$/i, '').trim();
      if (k.startsWith('--')) {
        vars[k] = v;
        decls[k] = v;
        normalDecls[k] = v;
      } else {
        const lowerK = k.toLowerCase();
        const pairs = lowerK === 'font' ? expandFontShorthand(v) : [[lowerK, v]];
        for (const [pk, pv] of pairs) {
          decls[pk] = pv;
          if (isImportant) {
            importantProps.add(pk);
            importantDecls[pk] = pv;
          } else {
            normalDecls[pk] = pv;
          }
        }
      }
    }
  }

  Object.defineProperty(decls, '_important', {
    value: importantProps,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(decls, '_importantDecls', {
    value: importantDecls,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(decls, '_normalDecls', {
    value: normalDecls,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return decls;
}

function getDeclsSplit(decls) {
  if (!decls) return { normal: {}, important: {} };
  if (decls._normalDecls && decls._importantDecls) {
    return { normal: decls._normalDecls, important: decls._importantDecls };
  }
  const normal = {};
  const important = {};
  for (const [k, v] of Object.entries(decls)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && /!important\s*$/i.test(v)) {
      important[k] = v.replace(/!important\s*$/i, '').trim();
    } else {
      normal[k] = v;
    }
  }
  return { normal, important };
}

const cssSheetCache = new Map();

// Print viewport width in CSS px: the A4 page width (Chrome evaluates print media queries against the page, not the margin box). Responsive rules such as
// `@media (max-width: 600px)` are mobile layouts and must not apply to the page.
export const PRINT_VIEWPORT_PX = 794;
function mediaQueryMatches(queryText, viewportPx) {
  const toPx = (num, unit) => parseFloat(num) * (unit === 'em' || unit === 'rem' ? 16 : unit === 'pt' ? 96 / 72 : 1);
  return queryText.split(',').some((q) => {
    if (/prefers-color-scheme\s*:\s*dark|hover\s*:\s*none|pointer\s*:\s*coarse|orientation\s*:\s*landscape/.test(q)) return false;
    for (const m of q.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem|pt)\s*\)/g)) {
      const v = toPx(m[2], m[3]);
      if (m[1] === 'max' ? viewportPx > v : viewportPx < v) return false;
    }
    for (const m of q.matchAll(/\(\s*width\s*(<=|>=|<|>)\s*([\d.]+)(px|em|rem|pt)\s*\)/g)) {
      const v = toPx(m[2], m[3]);
      const ok = m[1] === '<=' ? viewportPx <= v : m[1] === '>=' ? viewportPx >= v : m[1] === '<' ? viewportPx < v : viewportPx > v;
      if (!ok) return false;
    }
    return true;
  });
}
export function parseCssStylesheet(cssText, media = 'print', viewportPx = PRINT_VIEWPORT_PX) {
  const raw = String(cssText || '');
  const cacheKey = `${media}::${viewportPx}::${raw}`;
  if (cssSheetCache.has(cacheKey)) {
    const c = cssSheetCache.get(cacheKey);
    return {
      rules: c.rules,
      vars: { ...c.vars },
      pageConfig: { ...c.pageConfig, margins: { ...c.pageConfig.margins } },
    };
  }

  const rules = [];
  const vars = {};
  const pageConfig = {
    format: 'A4',
    size: 'A4',
    orientation: 'portrait',
    width: 595.28,
    height: 841.89,
    margin: 36,
    margins: { top: 36, right: 36, bottom: 36, left: 36 },
  };

  const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  let order = 0;

  function parseCssSegment(segment) {
    let i = 0;
    const len = segment.length;
    while (i < len) {
      while (i < len && /\s/.test(segment[i])) i++;
      if (i >= len) break;

      const braceOpen = segment.indexOf('{', i);
      if (braceOpen === -1) break;

      const prelude = segment.slice(i, braceOpen).trim();
      let depth = 1;
      let j = braceOpen + 1;
      while (j < len && depth > 0) {
        if (segment[j] === '{') depth++;
        else if (segment[j] === '}') depth--;
        j++;
      }
      const blockContent = segment.slice(braceOpen + 1, j - 1);
      i = j;

      if (!prelude) continue;
      const lowerPrelude = prelude.toLowerCase();

      if (lowerPrelude.startsWith('@page')) {
        const pageDecls = parseDeclarationsBlock(blockContent, vars);
        if (pageDecls.size) {
          const tokens = pageDecls.size.trim().split(/\s+/);
          for (const tk of tokens) {
            const up = tk.toUpperCase();
            if (up === 'LANDSCAPE' || up === 'PORTRAIT') {
              pageConfig.orientation = up.toLowerCase();
            } else if (PAGE_DIMENSIONS[up]) {
              pageConfig.format = tk;
              pageConfig.size = tk;
              pageConfig.width = PAGE_DIMENSIONS[up].width;
              pageConfig.height = PAGE_DIMENSIONS[up].height;
            }
          }
          if (pageConfig.orientation === 'landscape' && pageConfig.width < pageConfig.height) {
            const tmp = pageConfig.width;
            pageConfig.width = pageConfig.height;
            pageConfig.height = tmp;
          }
        }
        if (pageDecls.margin) {
          const parts = splitTopLevelWhitespace(pageDecls.margin.trim()).map((x) => evaluateCssValue(x, 11, vars));
          const top = parts[0] ?? 36;
          const right = parts[1] ?? top;
          const bottom = parts[2] ?? top;
          const left = parts[3] ?? right;
          pageConfig.margin = top;
          pageConfig.margins = { top, right, bottom, left };
        }
        continue;
      }

      if (lowerPrelude.startsWith('@media')) {
        if (/not\s+print/i.test(lowerPrelude)) continue;
        if (media === 'print' && /\bscreen\b/i.test(lowerPrelude) && !/\bprint\b/i.test(lowerPrelude)) continue;
        if (!mediaQueryMatches(lowerPrelude.slice(6), viewportPx)) continue;
        parseCssSegment(blockContent);
        continue;
      }

      if (lowerPrelude.startsWith('@')) {
        continue;
      }

      const decls = parseDeclarationsBlock(blockContent, vars);
      for (const sel of splitSelectorList(prelude)) {
        rules.push({
          selector: sel,
          decls,
          declarations: decls,
          specificity: computeSelectorSpecificity(sel),
          order: order++,
        });
      }
    }
  }

  parseCssSegment(cleaned);
  rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);

  if (cssSheetCache.size < 500) {
    cssSheetCache.set(cacheKey, {
      rules,
      vars: { ...vars },
      pageConfig: { ...pageConfig, margins: { ...pageConfig.margins } },
    });
  }

  return { rules, vars, pageConfig };
}

// ---------------------------------------------------------------------------
// 5. Full CSS Selector Matcher (tag, .class, #id, [attr], :first/last/nth-child, >)
// ---------------------------------------------------------------------------

function matchesNthFormula(formula, index1Based) {
  const f = formula.replace(/\s+/g, '').toLowerCase();
  if (f === 'even') return index1Based % 2 === 0;
  if (f === 'odd') return index1Based % 2 === 1;
  if (/^[+-]?\d+$/.test(f)) return index1Based === parseInt(f, 10);

  const m = f.match(/^([+-]?\d*)?n([+-]\d+)?$/);
  if (!m) return false;
  const aStr = m[1];
  const a = aStr === '' || aStr === '+' || aStr === undefined ? 1 : aStr === '-' ? -1 : parseInt(aStr, 10);
  const b = m[2] ? parseInt(m[2], 10) : 0;
  if (a === 0) return index1Based === b;
  const diff = index1Based - b;
  if (diff % a !== 0) return false;
  return diff / a >= 0;
}

function getElementIndexAndTotal(node) {
  if (node._elemIdx !== undefined && node._elemTotal !== undefined) {
    return { idx: node._elemIdx, total: node._elemTotal };
  }
  const parent = node.parent;
  if (!parent || !Array.isArray(parent.children)) return { idx: 0, total: 1 };
  const elems = parent.children.filter((c) => c.type === 'element');
  const idx = elems.indexOf(node);
  return { idx: idx === -1 ? 0 : idx, total: elems.length };
}

function getNodeAttr(node, name) {
  if (!node) return undefined;
  if (node.attrs && node.attrs[name] !== undefined) return node.attrs[name];
  if (name === 'id' && node.id) return node.id;
  if (name === 'class' && node.className) return node.className;
  return undefined;
}

function nodeHasClass(node, cls) {
  if (!node) return false;
  if (node.classList && typeof node.classList.contains === 'function') {
    return node.classList.contains(cls);
  }
  const cn = node.className || node.attrs?.class || '';
  return String(cn).split(/\s+/).includes(cls);
}

function matchesSimpleSelector(node, rawSel, hintIdx = null) {
  if (!node || node.type !== 'element') return false;
  let s = rawSel.trim();
  if (!s || s === '*') return true;
  if (s === ':root') return node.tagName === 'html' || node.tagName === 'document' || !node.parent;

  // 1. Structural pseudo-classes (`:first-child`, `:last-child`, `:nth-child(...)`)
  const pseudoRe = /:([a-zA-Z-]+)(?:\(([^)]*)\))?/g;
  let pm;
  while ((pm = pseudoRe.exec(s)) !== null) {
    const pName = pm[1].toLowerCase();
    const pArg = (pm[2] || '').trim();
    const { idx, total } = hintIdx !== null && node._elemTotal !== undefined
      ? { idx: hintIdx, total: node._elemTotal }
      : getElementIndexAndTotal(node);
    const pos1 = idx + 1;
    if (pName === 'first-child' && pos1 !== 1) return false;
    if (pName === 'last-child' && pos1 !== total) return false;
    if (pName === 'only-child' && total !== 1) return false;
    if (pName === 'nth-child' && !matchesNthFormula(pArg, pos1)) return false;
    if (pName === 'not' && pArg && matchesSimpleSelector(node, pArg, hintIdx)) return false;
  }
  s = s.replace(/:([a-zA-Z-]+)(?:\(([^)]*)\))?/g, '').trim();
  if (!s || s === '*') return true;

  // 2. Attribute selectors `[attr]`, `[type="text"]`, `[attr^=val]`, etc.
  const attrRe = /\[\s*([a-zA-Z0-9_-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*?))\s*)?\]/g;
  let am;
  while ((am = attrRe.exec(s)) !== null) {
    const attrName = am[1];
    const op = am[2];
    const expected = am[3] ?? am[4] ?? am[5] ?? '';
    const actual = getNodeAttr(node, attrName);
    if (actual === undefined || actual === null) return false;
    const actStr = String(actual);
    if (op === '=' && actStr !== expected) return false;
    if (op === '^=' && !actStr.startsWith(expected)) return false;
    if (op === '$=' && !actStr.endsWith(expected)) return false;
    if (op === '*=' && !actStr.includes(expected)) return false;
    if (op === '~=' && !actStr.split(/\s+/).includes(expected)) return false;
    if (op === '|=' && actStr !== expected && !actStr.startsWith(`${expected}-`)) return false;
  }
  s = s.replace(/\[[^\]]*\]/g, '').trim();
  if (!s || s === '*') return true;

  // 3. IDs `#id`
  const idRe = /#([a-zA-Z0-9_-]+)/g;
  let im;
  while ((im = idRe.exec(s)) !== null) {
    const nodeId = node.id || node.attrs?.id || '';
    if (nodeId !== im[1]) return false;
  }
  s = s.replace(/#[a-zA-Z0-9_-]+/g, '').trim();

  // 4. Classes `.class1.class2`
  const classRe = /\.([a-zA-Z0-9_-]+)/g;
  let cm;
  while ((cm = classRe.exec(s)) !== null) {
    if (!nodeHasClass(node, cm[1])) return false;
  }
  s = s.replace(/\.[a-zA-Z0-9_-]+/g, '').trim();

  // 5. Tag name
  if (s && s !== '*') {
    if ((node.tagName || '').toLowerCase() !== s.toLowerCase()) return false;
  }
  return true;
}

function tokenizeCompoundSelector(sel) {
  const tokens = [];
  let buf = '';
  let depthParen = 0;
  let depthBracket = 0;
  let pendingCombinator = null;

  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(') { depthParen++; buf += ch; continue; }
    if (ch === ')') { depthParen = Math.max(0, depthParen - 1); buf += ch; continue; }
    if (ch === '[') { depthBracket++; buf += ch; continue; }
    if (ch === ']') { depthBracket = Math.max(0, depthBracket - 1); buf += ch; continue; }

    if (depthParen === 0 && depthBracket === 0 && (ch === '>' || /\s/.test(ch))) {
      if (buf.trim()) {
        tokens.push({ selector: buf.trim(), combinatorToRight: null });
        buf = '';
      }
      if (ch === '>') {
        pendingCombinator = '>';
      } else if (!pendingCombinator) {
        pendingCombinator = ' ';
      }
      if (tokens.length > 0 && pendingCombinator) {
        tokens[tokens.length - 1].combinatorToRight = pendingCombinator;
      }
    } else {
      if (pendingCombinator) pendingCombinator = null;
      buf += ch;
    }
  }
  if (buf.trim()) {
    tokens.push({ selector: buf.trim(), combinatorToRight: null });
  }
  return tokens;
}

function matchesSelector(node, sel, idx = null) {
  const parts = tokenizeCompoundSelector(sel);
  if (parts.length === 0) return false;
  if (!matchesSimpleSelector(node, parts[parts.length - 1].selector, idx)) return false;
  if (parts.length === 1) return true;

  let cur = node.parent;
  for (let i = parts.length - 2; i >= 0; i--) {
    const combinator = parts[i].combinatorToRight || ' ';
    const targetSel = parts[i].selector;
    if (combinator === '>') {
      if (!cur || cur.type !== 'element' || !matchesSimpleSelector(cur, targetSel)) return false;
      cur = cur.parent;
    } else {
      while (cur && cur.type === 'element' && !matchesSimpleSelector(cur, targetSel)) {
        cur = cur.parent;
      }
      if (!cur || cur.type !== 'element') return false;
      cur = cur.parent;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 6. CSS Declaration Application & DOM Tree Cascade (`computeStylesForTree`)
// ---------------------------------------------------------------------------

function applyCssDecls(target, decls, vars, inherited = {}) {
  const evalCtx = {
    fontSize: target.fontSize || 11,
    rootFontSize: 11,
    vars,
  };

  for (const [rawKey, rawV] of Object.entries(decls)) {
    if (rawV === undefined || rawV === null) continue;
    if (rawKey.startsWith('--')) {
      vars[rawKey] = rawV;
      continue;
    }
    const k = rawKey.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).toLowerCase();
    const v = resolveCssVarsInString(String(rawV), vars).replace(/!important\s*$/i, '').trim();
    evalCtx.fontSize = target.fontSize || 11;

    if (v.toLowerCase() === 'inherit') {
      const inheritMap = {
        'color': 'color',
        'font-family': 'fontFamily',
        'font-size': 'fontSize',
        'font-weight': 'fontWeight',
        'font-style': 'fontStyle',
        'line-height': 'lineHeight',
        'text-align': 'textAlign',
        'text-transform': 'textTransform',
        'letter-spacing': 'letterSpacing',
        'visibility': 'visibility',
        'white-space': 'whiteSpace',
      };
      const prop = inheritMap[k];
      if (prop && inherited[prop] !== undefined) {
        target[prop] = inherited[prop];
        if (prop === 'lineHeight' && inherited.lineHeightRatio) {
          target.lineHeightRatio = inherited.lineHeightRatio;
        }
      }
      continue;
    }

    if (k === 'color') target.color = v;
    else if (k === 'display') target.display = v;
    else if (k === 'position') target.position = v;
    else if (k === 'top') {
      target.top = v.toLowerCase().startsWith('calc(') ? v : v.endsWith('%') ? v : evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'right') {
      target.right = v.toLowerCase().startsWith('calc(') ? v : v.endsWith('%') ? v : evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'bottom') {
      target.bottom = v.toLowerCase().startsWith('calc(') ? v : v.endsWith('%') ? v : evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'left') {
      target.left = v.toLowerCase().startsWith('calc(') ? v : v.endsWith('%') ? v : evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'z-index' || k === 'zindex') {
      target.zIndex = parseInt(v, 10) || 0;
    } else if (k === 'float') target.float = v;
    else if (k === 'clear') target.clear = v;
    else if (k === 'list-style-type' || k === 'list-style') {
      const m = /\b(none|disc|circle|square|decimal(?:-leading-zero)?|lower-alpha|upper-alpha|lower-latin|upper-latin|lower-roman|upper-roman)\b/i.exec(v);
      if (m) target.listStyleType = m[1].toLowerCase();
      else if (k === 'list-style-type') target.listStyleType = undefined;
    }
    else if (k === 'border-collapse') target.borderCollapse = v.trim();
    else if (k === 'flex-direction') target.flexDirection = v;
    else if (k === 'flex-wrap') target.flexWrap = v;
    else if (k === 'flex-grow') target.flexGrow = parseFloat(v) || 0;
    else if (k === 'flex-shrink') target.flexShrink = parseFloat(v) || 0;
    else if (k === 'flex-basis') target.flexBasis = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'flex') {
      target.flex = v;
      if (v === '1' || v === '1 1 0%' || v === '1 1 auto' || v === 'auto') {
        target.flexGrow = 1;
        target.flexShrink = 1;
      } else if (v === 'none') {
        target.flexGrow = 0;
        target.flexShrink = 0;
      } else if (v === 'initial') {
        target.flexGrow = 0;
        target.flexShrink = 1;
      } else {
        const parts = splitTopLevelWhitespace(v);
        if (parts.length > 0) {
          const g = parseFloat(parts[0]);
          if (!isNaN(g)) target.flexGrow = g;
        }
        if (parts.length > 1) {
          const s = parseFloat(parts[1]);
          if (!isNaN(s)) target.flexShrink = s;
        }
        if (parts.length > 2) {
          target.flexBasis = evaluateCssValue(parts[2], evalCtx, vars);
        }
      }
    }
    else if (k === 'opacity') {
      target.opacity = parseFloat(v);
    } else if (k === 'transform') {
      target.transform = v;
      const rm = v.match(/rotate\(\s*([+-]?\d+(?:\.\d+)?)(deg|rad|turn)?\s*\)/i);
      if (rm) {
        let deg = parseFloat(rm[1]);
        if (rm[2] === 'rad') deg = (deg * 180) / Math.PI;
        else if (rm[2] === 'turn') deg = deg * 360;
        target.rotate = deg;
      }
      const sm = v.match(/scale\(\s*([+-]?\d+(?:\.\d+)?)\s*\)/i);
      if (sm) target.scale = parseFloat(sm[1]);
    } else if (k === 'rotate') {
      const rm2 = String(v).match(/([+-]?\d+(?:\.\d+)?)(deg|rad|turn)?/i);
      if (rm2) {
        let deg = parseFloat(rm2[1]);
        if (rm2[2] === 'rad') deg = (deg * 180) / Math.PI;
        else if (rm2[2] === 'turn') deg = deg * 360;
        target.rotate = deg;
      }
    } else if (k === 'align-items') {
      target.alignItems = v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v;
    } else if (k === 'justify-content') {
      target.justifyContent = v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v;
    }
    else if (k === 'grid-column' || k === 'grid-column-start' || k === 'grid-column-end') {
      const spanM = /span\s+(\d+)/.exec(v);
      if (spanM) target.colSpan = parseInt(spanM[1], 10);
      else {
        const parts = v.split('/').map((x) => parseInt(x.trim(), 10));
        if (k === 'grid-column') {
          if (!Number.isNaN(parts[0])) target.gridColumnStart = parts[0];
          if (parts.length > 1 && !Number.isNaN(parts[1])) target.gridColumnEnd = parts[1];
        } else if (!Number.isNaN(parts[0])) {
          target[k === 'grid-column-start' ? 'gridColumnStart' : 'gridColumnEnd'] = parts[0];
        }
      }
    } else if (k === 'grid-template-columns') {
      target.gridTemplateColumns = v;
      const m = v.match(/repeat\(\s*(\d+)/);
      if (m) target.gridCols = parseInt(m[1], 10);
      else target.gridCols = splitTopLevelWhitespace(v).length || 1;
    } else if (k === 'gap') {
      target.gap = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'column-gap') {
      target.gapX = evaluateCssValue(v, evalCtx, vars);
      target.columnGap = target.gapX;
    } else if (k === 'row-gap') {
      target.gapY = evaluateCssValue(v, evalCtx, vars);
      target.rowGap = target.gapY;
    } else if (k === 'background-color' || k === 'background' || k === 'background-image') {
      if (v.includes('linear-gradient')) {
        const hexes = v.match(/#[0-9a-fA-F]{3,8}/g) || ['#0f172a', '#1e1b4b'];
        target.gradient = { from: hexes[0], to: hexes[hexes.length - 1] };
        target.backgroundColor = hexes[0];
        target.backgroundImage = v;
      } else if (k !== 'background-image') {
        target.backgroundColor = v;
      }
    } else if (k === 'font-size') {
      target.fontSize = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'line-height') {
      target._lineHeightExplicit = true;
      const num = parseFloat(v);
      if (/^\d+(\.\d+)?$/.test(v)) {
        target.lineHeightRatio = num;
        target.lineHeight = (target.fontSize || 11) * num;
      } else if (v.endsWith('%')) {
        const ratio = parseFloat(v) / 100;
        target.lineHeightRatio = ratio;
        target.lineHeight = (target.fontSize || 11) * ratio;
      } else if (v.endsWith('em')) {
        const ratio = parseFloat(v);
        target.lineHeightRatio = ratio;
        target.lineHeight = (target.fontSize || 11) * ratio;
      } else if (v === 'normal') {
        target.lineHeightRatio = 1.35;
        target.lineHeight = (target.fontSize || 11) * 1.35;
      } else {
        target.lineHeight = evaluateCssValue(v, evalCtx, vars);
      }
    } else if (k === 'letter-spacing') {
      target.letterSpacing = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'font-weight') {
      target.fontWeight = v.includes('bold') || parseInt(v, 10) >= 600 ? 'bold' : 'normal';
    } else if (k === 'font-style') {
      target.fontStyle = v;
    } else if (k === 'font-family') {
      if (/courier|mono|consolas|menlo/i.test(v)) target.fontFamily = 'Courier';
      else if (/times|georgia|serif/i.test(v) && !/sans-serif/i.test(v)) target.fontFamily = 'Times-Roman';
      else target.fontFamily = 'Helvetica';
    } else if (k === 'text-align') target.textAlign = v;
    else if (k === 'vertical-align') target.verticalAlign = v.toLowerCase();
    else if (k === 'text-transform') target.textTransform = v;
    else if (k === 'text-decoration') target.textDecoration = v;
    else if (k === 'white-space') target.whiteSpace = v;
    else if (k === 'visibility') target.visibility = v;
    else if (k === 'width') {
      if (v.endsWith('%')) {
        target.widthPercent = parseFloat(v);
        target.width = v;
      } else if (v.toLowerCase().startsWith('calc(')) {
        target.width = v;
      } else {
        target.width = evaluateCssValue(v, evalCtx, vars);
      }
    } else if (k === 'min-width') {
      if (v.endsWith('%')) {
        target.minWidthPercent = parseFloat(v);
        target.minWidth = v;
      } else if (v.toLowerCase().startsWith('calc(')) {
        target.minWidth = v;
      } else {
        target.minWidth = evaluateCssValue(v, evalCtx, vars);
      }
    } else if (k === 'max-width') {
      if (v.endsWith('%')) {
        target.maxWidthPercent = parseFloat(v);
        target.maxWidth = v;
      } else if (v.toLowerCase().startsWith('calc(')) {
        target.maxWidth = v;
      } else {
        target.maxWidth = evaluateCssValue(v, evalCtx, vars);
      }
    } else if (k === 'height') {
      target.height = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'min-height') {
      target.minHeight = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'padding') {
      const parts = splitTopLevelWhitespace(v).map((x) => evaluateCssValue(x, evalCtx, vars));
      target.paddingTop = parts[0] || 0;
      target.paddingRight = parts[1] ?? parts[0] ?? 0;
      target.paddingBottom = parts[2] ?? parts[0] ?? 0;
      target.paddingLeft = parts[3] ?? parts[1] ?? parts[0] ?? 0;
    } else if (k === 'padding-top') target.paddingTop = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'padding-right') target.paddingRight = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'padding-bottom') target.paddingBottom = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'padding-left') target.paddingLeft = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'margin') {
      const raw = splitTopLevelWhitespace(v);
      const isAuto = (x) => String(x).trim().toLowerCase() === 'auto';
      const parts = raw.map((x) => (isAuto(x) ? 0 : evaluateCssValue(x, evalCtx, vars)));
      target.marginTop = parts[0] || 0;
      target.marginRight = parts[1] ?? parts[0] ?? 0;
      target.marginBottom = parts[2] ?? parts[0] ?? 0;
      target.marginLeft = parts[3] ?? parts[1] ?? parts[0] ?? 0;
      target.marginRightAuto = isAuto(raw[1] ?? raw[0]);
      target.marginLeftAuto = isAuto(raw[3] ?? raw[1] ?? raw[0]);
    } else if (k === 'margin-top') target.marginTop = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'margin-right') { target.marginRightAuto = v.trim() === 'auto'; target.marginRight = target.marginRightAuto ? 0 : evaluateCssValue(v, evalCtx, vars); }
    else if (k === 'margin-bottom') target.marginBottom = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'margin-left') { target.marginLeftAuto = v.trim() === 'auto'; target.marginLeft = target.marginLeftAuto ? 0 : evaluateCssValue(v, evalCtx, vars); }
    else if (k === 'border-radius') target.borderRadius = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'border-width') target.borderWidth = evaluateCssValue(v, evalCtx, vars);
    else if (k === 'border-color') target.borderColor = v;
    else if (k === 'border-style') target.borderStyle = v;
    else if (k === 'box-shadow' || k === 'boxshadow') {
      if (v !== 'none') target.boxShadow = v;
    } else if (k === 'border-top-width') {
      target.borderTopWidth = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'border-right-width') {
      target.borderRightWidth = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'border-bottom-width') {
      target.borderBottomWidth = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'border-left-width') {
      target.borderLeftWidth = evaluateCssValue(v, evalCtx, vars);
    } else if (k === 'border-top-color') {
      target.borderTopColor = v;
    } else if (k === 'border-right-color') {
      target.borderRightColor = v;
    } else if (k === 'border-bottom-color') {
      target.borderBottomColor = v;
    } else if (k === 'border-left-color') {
      target.borderLeftColor = v;
    } else if (k === 'border' || k === 'border-top' || k === 'border-right' || k === 'border-bottom' || k === 'border-left') {
      const hm = v.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
      const wm = evaluateCssValue(v, evalCtx, vars) || 1;
      const sm = v.match(/\b(solid|dashed|dotted|double|none)\b/);
      if (sm) target.borderStyle = sm[1];
      if (k === 'border') {
        target.borderWidth = wm;
        if (hm) {
          target.borderColor = hm[0];
          if (!target.borderLeftColor) target.borderLeftColor = hm[0];
          if (!target.borderRightColor) target.borderRightColor = hm[0];
          if (!target.borderTopColor) target.borderTopColor = hm[0];
          if (!target.borderBottomColor) target.borderBottomColor = hm[0];
        }
      } else if (k === 'border-top') {
        target.borderTopWidth = wm;
        if (hm) target.borderTopColor = hm[0];
      } else if (k === 'border-right') {
        target.borderRightWidth = wm;
        if (hm) target.borderRightColor = hm[0];
      } else if (k === 'border-bottom') {
        target.borderBottomWidth = wm;
        if (hm) target.borderBottomColor = hm[0];
      } else if (k === 'border-left') {
        target.borderLeftWidth = wm;
        if (hm) target.borderLeftColor = hm[0];
      }
    } else if (k === 'break-inside' || k === 'page-break-inside') {
      target.pageBreakInside = v;
      target['break-inside'] = v;
      target['page-break-inside'] = v;
    } else if (k === 'break-before' || k === 'page-break-before') {
      const val = v === 'always' ? 'page' : v;
      target.breakBefore = val;
      target.pageBreakBefore = val;
      target['break-before'] = val;
      target['page-break-before'] = val;
    } else if (k === 'break-after' || k === 'page-break-after') {
      const val = v === 'always' ? 'page' : v;
      target.breakAfter = val;
      target.pageBreakAfter = val;
      target['break-after'] = val;
      target['page-break-after'] = val;
    }
  }
}

const DEFAULT_FONT_PT = 12; // 16px, the browser default
const DEFAULT_LINE_RATIO = 1.15; // line-height: normal for Helvetica/Arial
const TABLE_PART_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td']);
const TABLE_STYLING_PROP = /^(padding|border(?!-collapse|-spacing)|background|text-align|vertical-align|color$|font|line-height|text-transform|letter-spacing|height)/;
const TAG_DEFAULTS = {
  // Chrome's user-agent sizes and margins: font size and vertical margins are in em of the element's own size
  // (resolved after the cascade, so an author font-size scales the default margins like a browser does).
  h1: { _fsEm: 2, _mEm: 0.67, fontWeight: 'bold', breakAfter: 'avoid' },
  h2: { _fsEm: 1.5, _mEm: 0.83, fontWeight: 'bold', breakAfter: 'avoid' },
  h3: { _fsEm: 1.17, _mEm: 1, fontWeight: 'bold', breakAfter: 'avoid' },
  h4: { _fsEm: 1, _mEm: 1.33, fontWeight: 'bold', breakAfter: 'avoid' },
  h5: { _fsEm: 0.83, _mEm: 1.67, fontWeight: 'bold', breakAfter: 'avoid' },
  h6: { _fsEm: 0.67, _mEm: 2.33, fontWeight: 'bold', breakAfter: 'avoid' },
  p: { _mEm: 1 },
  ul: { _mEm: 1, paddingLeft: 30 },
  ol: { _mEm: 1, paddingLeft: 30 },
  blockquote: { _mEm: 1, marginLeft: 30, marginRight: 30 },
  b: { fontWeight: 'bold', display: 'inline' },
  strong: { fontWeight: 'bold', display: 'inline' },
  i: { fontStyle: 'italic', display: 'inline' },
  em: { fontStyle: 'italic', display: 'inline' },
  u: { textDecoration: 'underline', display: 'inline' },
  code: { fontFamily: 'Courier', backgroundColor: '#f1f5f9', display: 'inline' },
  pre: { fontFamily: 'Courier', backgroundColor: '#f1f5f9', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 },
  a: { color: '#4f46e5', display: 'inline' },
  span: { display: 'inline' },
  // Inline by default in every browser; without this they were laid out as blocks (a <br> became a blank line).
  br: { display: 'inline' },
  small: { display: 'inline' },
  mark: { display: 'inline' },
  s: { display: 'inline' },
  sub: { display: 'inline' },
  sup: { display: 'inline' },
  abbr: { display: 'inline' },
  label: { display: 'inline' },
  cite: { display: 'inline' },
  q: { display: 'inline' },
  kbd: { display: 'inline' },
  time: { display: 'inline' },
  table: { display: 'table', widthPercent: 100 },
  th: { fontWeight: 'bold', paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 },
  td: { paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8 },
};

export function computeStylesForTree(rootNode, options = {}) {
  let cssText = options.css ? String(options.css) + '\n' : '';
  const collectStyles = (n) => {
    if (!n || n.type !== 'element') return;
    if (n.tagName === 'style') {
      cssText += (n.textContent || '') + '\n';
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) collectStyles(c);
    }
  };
  collectStyles(rootNode);

  const { rules, vars, pageConfig } = options.parsedCssRules || parseCssStylesheet(cssText);

  const cascade = (node, inherited, scopedVars, elemIdx = 0) => {
    if (!node || node.type !== 'element') return;
    const localVars = { ...scopedVars };

    const cs = {
      fontFamily: inherited.fontFamily || 'Helvetica',
      fontSize: inherited.fontSize !== undefined ? inherited.fontSize : DEFAULT_FONT_PT,
      fontWeight: inherited.fontWeight || 'normal',
      fontStyle: inherited.fontStyle || 'normal',
      listStyleType: inherited.listStyleType,
      lineHeight: inherited.lineHeightRatio
        ? (inherited.fontSize || 10.5) * inherited.lineHeightRatio
        : inherited.lineHeight || undefined,
      lineHeightRatio: inherited.lineHeightRatio || undefined,
      _lineHeightExplicit: Boolean(inherited._lineHeightExplicit && !inherited.lineHeightRatio),
      letterSpacing: inherited.letterSpacing !== undefined ? inherited.letterSpacing : 0,
      color: inherited.color || '#0f172a',
      textAlign: inherited.textAlign || 'left',
      textTransform: inherited.textTransform || 'none',
      visibility: inherited.visibility || 'visible',
      whiteSpace: inherited.whiteSpace || 'normal',
      display: 'block',
      position: 'static',
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      borderWidth: 0,
      borderRadius: 0,
      ...(TAG_DEFAULTS[node.tagName] || {}),
    };
    if (cs._fsEm) cs.fontSize = (inherited.fontSize !== undefined ? inherited.fontSize : DEFAULT_FONT_PT) * cs._fsEm;
    if (cs._mEm) {
      // marked unset, filled in below unless the stylesheet sets the margin itself
      cs.marginTop = undefined;
      cs.marginBottom = undefined;
    }

    const matchingRules = [];
    for (let ruleIdx = 0; ruleIdx < rules.length; ruleIdx++) {
      const r = rules[ruleIdx];
      if (!r || !r.selector) continue;
      const order = r.order !== undefined ? r.order : ruleIdx;
      if (r.selector.includes(',')) {
        const subSelectors = splitSelectorList(r.selector);
        let matched = false;
        let maxSpec = -1;
        for (const subSel of subSelectors) {
          if (matchesSelector(node, subSel, elemIdx)) {
            matched = true;
            const spec = computeSelectorSpecificity(subSel);
            if (spec > maxSpec) maxSpec = spec;
          }
        }
        if (matched) {
          matchingRules.push({
            rule: r,
            specificity: maxSpec >= 0 ? maxSpec : (r.specificity || 0),
            ruleIdx: order,
          });
        }
      } else {
        if (matchesSelector(node, r.selector, elemIdx)) {
          const spec = r.specificity !== undefined ? r.specificity : computeSelectorSpecificity(r.selector);
          matchingRules.push({
            rule: r,
            specificity: spec,
            ruleIdx: order,
          });
        }
      }
    }

    matchingRules.sort((a, b) => a.specificity - b.specificity || a.ruleIdx - b.ruleIdx);

    // 1. Apply normal declarations from matching stylesheet rules in ascending specificity order
    for (const mr of matchingRules) {
      const declsObj = mr.rule.decls || mr.rule.declarations;
      if (declsObj) {
        const { normal } = getDeclsSplit(declsObj);
        applyCssDecls(cs, normal, localVars, inherited);
      }
    }

    // 2. Apply Tailwind utility classes after stylesheet rules
    const classAttr = node.className || node.attrs?.class || '';
    if (classAttr) {
      Object.assign(cs, resolveTailwindClasses(classAttr));
    }

    // 3. Apply normal declarations from inline style attribute / node.style
    const inlineImportant = {};
    if (node.attrs?.style && typeof node.attrs.style === 'string') {
      const inlineDecls = parseDeclarationsBlock(node.attrs.style, localVars);
      const { normal, important } = getDeclsSplit(inlineDecls);
      applyCssDecls(cs, normal, localVars, inherited);
      Object.assign(inlineImportant, important);
    }
    if (node.style && typeof node.style === 'object' && Object.keys(node.style).length > 0) {
      const { normal, important } = getDeclsSplit(node.style);
      applyCssDecls(cs, normal, localVars, inherited);
      Object.assign(inlineImportant, important);
    }

    // 4. Apply !important declarations from stylesheet rules in ascending specificity order
    for (const mr of matchingRules) {
      const declsObj = mr.rule.decls || mr.rule.declarations;
      if (declsObj) {
        const { important } = getDeclsSplit(declsObj);
        if (Object.keys(important).length > 0) {
          applyCssDecls(cs, important, localVars, inherited);
        }
      }
    }

    // 5. Apply !important declarations from inline styles (highest priority)
    if (Object.keys(inlineImportant).length > 0) {
      applyCssDecls(cs, inlineImportant, localVars, inherited);
    }

    // Did the page style this table part itself (padding, borders, backgrounds, text...)? Then layout uses the
    // authored box model; tables the stylesheet never touches keep the built-in report look.
    if (TABLE_PART_TAGS.has(node.tagName)) {
      const styled = (decls) => Object.keys(decls || {}).some((k) => TABLE_STYLING_PROP.test(k));
      cs._tableAuthored =
        matchingRules.some((mr) => {
          const d = mr.rule.decls || mr.rule.declarations;
          return d && (styled(getDeclsSplit(d).normal) || styled(getDeclsSplit(d).important));
        }) ||
        Boolean(classAttr) ||
        (typeof node.attrs?.style === 'string' && styled(parseDeclarationsBlock(node.attrs.style, localVars)));
    }

    // Preserve explicit HTML width/align attributes on <th>, <td>, <col>, <colgroup>, or elements
    if (node.attrs) {
      if (node.attrs.width && cs.width === undefined) {
        const rawW = String(node.attrs.width).trim();
        if (rawW.endsWith('%')) {
          cs.widthPercent = parseFloat(rawW);
          cs.width = rawW;
        } else {
          const parsed = parseFloat(rawW);
          if (!Number.isNaN(parsed)) {
            cs.width =
              rawW.endsWith('pt') ||
              rawW.endsWith('px') ||
              rawW.endsWith('mm') ||
              rawW.endsWith('cm') ||
              rawW.endsWith('in')
                ? evaluateCssValue(rawW, cs.fontSize || 11, localVars)
                : parsed * 0.75;
          }
        }
      }
      if (node.attrs.align && !cs.textAlign) {
        const al = String(node.attrs.align).trim().toLowerCase();
        if (al === 'left' || al === 'right' || al === 'center' || al === 'justify') {
          cs.textAlign = al;
        }
      }
    }

    if (cs.lineHeightRatio && !cs._lineHeightExplicit) {
      cs.lineHeight = (cs.fontSize || DEFAULT_FONT_PT) * cs.lineHeightRatio;
    } else if (!cs.lineHeight || !cs._lineHeightExplicit) {
      // No author line-height: follow this element's own font size (an h1 must not keep its parent's 14pt lines).
      cs.lineHeight = (cs.fontSize || DEFAULT_FONT_PT) * DEFAULT_LINE_RATIO;
    }
    if (cs._mEm) {
      // Chrome's UA sheet: a list inside another list has no default block margins (ul ul, ol ol, ul ol, ol ul).
      let nestedList = false;
      if (node.tagName === 'ul' || node.tagName === 'ol') {
        for (let up = node.parent; up; up = up.parent) {
          if (up.tagName === 'ul' || up.tagName === 'ol') { nestedList = true; break; }
        }
      }
      const defaultMargin = nestedList ? 0 : cs._mEm * cs.fontSize;
      if (cs.marginTop === undefined) cs.marginTop = defaultMargin;
      if (cs.marginBottom === undefined) cs.marginBottom = defaultMargin;
    }

    node.computedStyle = cs;

    if (Array.isArray(node.children)) {
      const elemKids = node.children.filter((c) => c && c.type === 'element');
      const total = elemKids.length;
      for (let i = 0; i < total; i++) {
        const child = elemKids[i];
        child._elemIdx = i;
        child._elemTotal = total;
        cascade(child, cs, localVars, i);
        if (i > 0) {
          if (cs.spaceY && !child.computedStyle.marginTop) {
            child.computedStyle.marginTop = cs.spaceY;
          }
          if (cs.spaceX && !child.computedStyle.marginLeft) {
            child.computedStyle.marginLeft = cs.spaceX;
          }
        }
      }
    }
  };

  cascade(rootNode, {}, vars, 0);
  return { rootNode, pageConfig };
}

export default {
  computeStylesForTree,
  resolveTailwindClasses,
  parseCssStylesheet,
  computeSelectorSpecificity,
  splitSelectorList,
  evaluateCssValue,
  evaluateCalc,
  TAILWIND_COLORS,
};
