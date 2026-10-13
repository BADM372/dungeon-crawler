// References from the guide into the game's code, shared by the guide (live code, deck.js) and
// the maintenance tool (fingerprints and markers, tools/learn.mjs). Pure, no DOM.
//
// A reference is "path#name", "path#a,b" (several names in one file) or just "path" (the whole
// file). A name is a top-level function, class, const / let / var (also one of several on one
// line), a method (`name(...) {`), a Python def / class / assignment, or "header" (the comment
// the file starts with). Its text is the definition plus the comment lines right above it.
// Marker lines ("// learn: ..." / "# learn: ...", written by the tool) are left out.

export const MARKER = /^\s*(\/\/|#)\s*learn:/;

// "a#x,y b" -> [{ path: 'a', name: 'x' }, { path: 'a', name: 'y' }, { path: 'b', name: null }]
export function parseRefs(list) {
  const out = [];
  for (const ref of String(list || '').trim().split(/\s+/).filter(Boolean)) {
    const [path, names] = ref.split('#');
    if (!names) out.push({ path, name: null });
    else for (const name of names.split(',')) out.push({ path, name });
  }
  return out;
}
export const refKey = r => r.name ? `${r.path}#${r.name}` : r.path;

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const python = path => path.endsWith('.py');

// the line where `name` is defined, or -1 (a second match is ambiguous: -2)
function defLine(lines, name, py) {
  const n = esc(name);
  const pats = py
    ? [new RegExp(`^\\s*(async\\s+)?def\\s+${n}\\s*\\(`), new RegExp(`^\\s*class\\s+${n}\\b`), new RegExp(`^${n}\\s*=`)]
    : [new RegExp(`^\\s*(export\\s+)?(default\\s+)?(async\\s+)?function\\s*\\*?\\s*${n}\\s*\\(`),
      new RegExp(`^\\s*(export\\s+)?class\\s+${n}\\b`),
      new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+(.*[,\\s])?${n}\\s*=(?!=)`),
      new RegExp(`^\\s+(async\\s+)?${n}\\s*\\([^)]*\\)\\s*\\{`)];
  let found = -1;
  lines.forEach((l, i) => { if (pats.some(p => p.test(l))) found = found === -1 ? i : -2; });
  return found;
}

// where a JS statement starting at line i ends (brackets balanced, strings and comments skipped);
// a method ends with its body
function jsEnd(lines, i, method) {
  const text = lines.slice(i).join('\n');
  const stack = [];   // '(' '[' '{' and '`' (template) / '${' inside templates
  let p = 0, line = i;
  const top = () => stack[stack.length - 1];
  for (; p < text.length; p++) {
    const c = text[p], d = text[p + 1];
    if (c === '\n') {
      line++;
      if (!stack.length) {
        // a statement can go on: a trailing operator, or a next line that starts with one
        const cur = lines[line - 1].replace(/\/\/.*$/, '').trimEnd(), next = (lines[line] ?? '').trim();
        if (/[=,?:+\-*/&|(]$|=>$/.test(cur) || (/^[?:.+\-*/&|]/.test(next) && !/^\/[/*]/.test(next))) continue;
        return line - 1;
      }
      continue;
    }
    if (top() === '`') {
      if (c === '\\') p++;
      else if (c === '`') stack.pop();
      else if (c === '$' && d === '{') { stack.push('${'); p++; }
      continue;
    }
    if (c === '/' && d === '/') { while (p < text.length && text[p + 1] !== '\n') p++; continue; }
    if (c === '/' && d === '*') { const e = text.indexOf('*/', p + 2); line += text.slice(p, e).split('\n').length - 1; p = e + 1; continue; }
    if (c === "'" || c === '"') { const q = c; p++; while (p < text.length && text[p] !== q && text[p] !== '\n') { if (text[p] === '\\') p++; p++; } continue; }
    if (c === '`') { stack.push('`'); continue; }
    if ('([{'.includes(c)) stack.push(c);
    else if (')]}'.includes(c)) { stack.pop(); if (method && c === '}' && !stack.length) return line; }
    else if (c === ';' && !stack.length) {
      // the statement ends here; the rest of the line (a comment) belongs to it
      const nl = text.indexOf('\n', p);
      return nl < 0 ? lines.length - 1 : line;
    }
  }
  return lines.length - 1;
}

// where a Python definition starting at line i ends (the indented block under it)
function pyEnd(lines, i) {
  const indent = lines[i].match(/^\s*/)[0].length;
  let end = i;
  for (let j = i + 1; j < lines.length; j++) {
    if (!lines[j].trim()) continue;
    if (lines[j].match(/^\s*/)[0].length <= indent) break;
    end = j;
  }
  return end;
}

// { start, end, text } of a definition (0-based lines, the comment above it included), or an
// { error }. The text leaves out marker lines, so writing markers never changes it.
export function extract(source, path, name) {
  const lines = source.split('\n'), py = python(path), comment = py ? /^\s*#/ : /^\s*(\/\/|\*|\/\*)/;
  const clean = (a, b) => lines.slice(a, b + 1).filter(l => !MARKER.test(l)).join('\n').replace(/\s+$/, '');
  if (!name) return { start: 0, end: lines.length - 1, text: clean(0, lines.length - 1) };
  if (name === 'header') {
    let end = -1;
    while (end + 1 < lines.length && comment.test(lines[end + 1])) end++;
    return end < 0 ? { error: `${path} does not start with a comment` } : { start: 0, end, text: clean(0, end) };
  }
  const at = defLine(lines, name, py);
  if (at === -1) return { error: `${path}: no definition of ${name}` };
  if (at === -2) return { error: `${path}: ${name} is defined more than once` };
  let start = at;
  while (start > 0 && (comment.test(lines[start - 1]) || MARKER.test(lines[start - 1]))) start--;
  const end = py ? pyEnd(lines, at) : jsEnd(lines, at, /^\s+(async\s+)?[\w$]+\s*\(/.test(lines[at]) && !/^\s*(export|function|const|let|var|class)\b/.test(lines[at]));
  return { start, end, line: at, text: clean(start, end) };
}

// a short fingerprint of a text (FNV-1a, 32 bits), the same in the browser and in node
export function fingerprint(text) {
  let h = 0x811c9dc5;
  const s = text.replace(/[ \t]+$/gm, '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// a value from the game, shown in a page: <b data-val="src/core/constants.js#RUN_SPEED">2.8</b>
// ("path#NAME.field" reads into objects; data-fmt="pct" shows 0.17 as 17%)
export function readValue(mod, expr) {
  return expr.split('.').reduce((v, k) => v == null ? undefined : v[k], mod);
}
export function formatValue(v, fmt, lang) {
  if (typeof v !== 'number') return String(v);
  const num = x => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 3, useGrouping: false }).format(x);
  return fmt === 'pct' ? num(Math.round(v * 1e6) / 1e4) + '%' : num(v);
}
