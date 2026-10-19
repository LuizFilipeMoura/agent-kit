// Tiny inline-SVG drawing helpers for the rule 12 page. Output is static SVG; no runtime JS.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Approximate glyph widths: 600 13px sans for titles, 10.5px mono for subs.
const TW = 7.3, SW = 6.4;
// Split a line so each piece fits `max` px; breaks at spaces, after - / . : _, and at camelCase humps.
function wrap(line, max, cw) {
  const fit = Math.max(4, Math.floor(max / cw));
  if (line.length <= fit) return [line];
  const out = []; let cur = '';
  const tokens = line.split(/(?<=[\s\-/.:_])|(?<=[a-z])(?=[A-Z])/);
  for (const tok of tokens) {
    if ((cur + tok).length <= fit) { cur += tok; continue; }
    if (cur) out.push(cur.trimEnd());
    cur = tok;
    while (cur.length > fit) { out.push(cur.slice(0, fit)); cur = cur.slice(fit); }
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out;
}
function layoutText(w, lines, sub) {
  const title = (Array.isArray(lines) ? lines : [lines]).flatMap((l) => wrap(l, w - 14, TW));
  const subs = (sub ? (Array.isArray(sub) ? sub : [sub]) : []).flatMap((l) => wrap(l, w - 12, SW));
  return { title, subs, need: title.length * 16 + subs.length * 13 + 14 };
}
const measure = (w, lines, sub) => layoutText(w, lines, sub).need;

// Box: kind = be | fe | db | q | ext | add | rm | chg | note. Grows taller when the text needs it.
function box(x, y, w, h, lines, kind = 'be', sub) {
  const { title, subs, need } = layoutText(w, lines, sub);
  h = Math.max(h, need);
  const b = { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  b.l = [x, b.cy]; b.r = [x + w, b.cy]; b.t = [b.cx, y]; b.b = [b.cx, y + h];
  const total = title.length * 16 + subs.length * 13;
  let ty = b.cy - total / 2 + 12;
  let t = '';
  for (const line of title) { t += `<text x="${b.cx}" y="${ty}" class="tt">${esc(line)}</text>`; ty += 16; }
  for (const line of subs) { t += `<text x="${b.cx}" y="${ty}" class="ts">${esc(line)}</text>`; ty += 13; }
  b.svg = `<g class="k-${kind}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${kind === 'db' ? 14 : 8}"/>${t}</g>`;
  return b;
}

// Orthogonal or straight edge through points; kind = n | add | rm | chg
function edge(points, label, kind = 'n', labelAt) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  let s = `<path d="${d}" class="e e-${kind}" marker-end="url(#ah-${kind})"/>`;
  if (label) {
    const i = labelAt ?? Math.floor((points.length - 1) / 2);
    const a = points[i], c = points[i + 1] || a;
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
    const lines = Array.isArray(label) ? label : [label];
    lines.forEach((l, k) => {
      s += `<text x="${mx}" y="${my - 5 - (lines.length - 1 - k) * 13}" class="el el-${kind}">${esc(l)}</text>`;
    });
  }
  return s;
}

function text(x, y, s, cls = 'tn', anchor = 'start') {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function svg(w, h, body, title) {
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="dg" style="max-width:${w}px">${body}</svg>`;
}

// Sequence diagram: parts = [{id, label, sub, kind}], steps = [{from, to, label, kind}] or {note, over:[ids], kind} or {div: 'text'}
function seq(parts, steps, opts = {}) {
  const colW = opts.colW || 170, top = 20, rowH = opts.rowH || 34, pad = 20;
  const headH = Math.max(46, ...parts.map((p) => measure(colW - 20, p.label, p.sub)));
  const xs = {}; parts.forEach((p, i) => { xs[p.id] = pad + colW / 2 + i * colW; });
  const W = pad * 2 + colW * parts.length;
  let y = top + headH + 26, body = '';
  const rows = [];
  for (const s of steps) {
    if (s.div) { rows.push(`<line x1="${pad}" x2="${W - pad}" y1="${y - 8}" y2="${y - 8}" class="div"/>` + text(W / 2, y - 12, s.div, 'dvt', 'middle')); y += rowH * 0.7; continue; }
    if (s.note) {
      const ids = s.over; const x1 = Math.min(...ids.map((i) => xs[i])) - colW / 2 + 12, x2 = Math.max(...ids.map((i) => xs[i])) + colW / 2 - 12;
      const lines = (Array.isArray(s.note) ? s.note : [s.note]).flatMap((l) => wrap(l, x2 - x1 - 16, SW)); const h = 10 + lines.length * 14;
      rows.push(`<g class="k-${s.kind || 'note'}"><rect x="${x1}" y="${y - 14}" width="${x2 - x1}" height="${h}" rx="6"/>` + lines.map((l, k) => `<text x="${(x1 + x2) / 2}" y="${y + k * 14}" class="ts">${esc(l)}</text>`).join('') + '</g>');
      y += h + 10; continue;
    }
    const k = s.kind || 'n';
    if (s.from === s.to) {
      const x = xs[s.from];
      rows.push(`<path d="M${x},${y - 4} h28 v14 h-26" class="e e-${k}" marker-end="url(#ah-${k})"/>` + text(x + 34, y + 6, s.label, `el el-${k}`, 'start'));
      y += rowH + 4; continue;
    }
    const x1 = xs[s.from], x2 = xs[s.to], dir = x2 > x1 ? 1 : -1;
    rows.push(`<path d="M${x1},${y} L${x2 - dir * 2},${y}" class="e e-${k}${s.dashed ? ' dash' : ''}" marker-end="url(#ah-${k})"/>` + text((x1 + x2) / 2, y - 6, s.label, `el el-${k}`, 'middle'));
    y += rowH;
  }
  const H = y + 10;
  for (const p of parts) {
    const x = xs[p.id];
    body += `<line x1="${x}" x2="${x}" y1="${top + headH}" y2="${H - 6}" class="life"/>`;
    body += box(x - colW / 2 + 10, top, colW - 20, headH, p.label, p.kind || 'be', p.sub).svg; // same height for every header
  }
  return svg(W, H, body + rows.join(''), opts.title || 'sequence');
}

module.exports = { esc, box, edge, text, svg, seq, measure };
