// Page shell for rule 12 diagram pages: CSS (light and dark), arrow markers and table styles around your body HTML.
// const { page } = require(require('os').homedir() + '/agent-kit/tools/diagrams/page');
// fs.writeFileSync('diagrams/topic.html', page({ title, lede, body }));
const { esc } = require('./lib');

const CSS = `
:root {
  --bg:#f7f7f5; --card:#ffffff; --fg:#1d2330; --muted:#5d6676; --line:#7a8496; --rule:#e2e4e8;
  --be-f:#eef1f6; --be-s:#9aa5b8; --fe-f:#e8f0fd; --fe-s:#6f95d8; --db-f:#f3eefb; --db-s:#9b86c9;
  --q-f:#fdf3e6; --q-s:#d39a4e; --ext-f:#eaf6f4; --ext-s:#5aa597; --note-f:#f4f4f2; --note-s:#c3c6cc;
  --add:#1f8a4c; --add-f:#e7f6ec; --rm:#c2412d; --rm-f:#fcebe8; --chg:#b7791f; --chg-f:#fdf5e3;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg:#13161c; --card:#1b1f27; --fg:#e6e9ef; --muted:#a2aab8; --line:#8a94a6; --rule:#2c323d;
  --be-f:#232935; --be-s:#5d6880; --fe-f:#1d2a40; --fe-s:#5b84c9; --db-f:#2a2338; --db-s:#8a74bb;
  --q-f:#33291b; --q-s:#c08b45; --ext-f:#1b302c; --ext-s:#4f9c8e; --note-f:#22262e; --note-s:#4a505b;
  --add:#4cc27f; --add-f:#17301f; --rm:#ef7a64; --rm-f:#3a1f1a; --chg:#e0a84a; --chg-f:#352a15;
} }
:root[data-theme="dark"] {
  --bg:#13161c; --card:#1b1f27; --fg:#e6e9ef; --muted:#a2aab8; --line:#8a94a6; --rule:#2c323d;
  --be-f:#232935; --be-s:#5d6880; --fe-f:#1d2a40; --fe-s:#5b84c9; --db-f:#2a2338; --db-s:#8a74bb;
  --q-f:#33291b; --q-s:#c08b45; --ext-f:#1b302c; --ext-s:#4f9c8e; --note-f:#22262e; --note-s:#4a505b;
  --add:#4cc27f; --add-f:#17301f; --rm:#ef7a64; --rm-f:#3a1f1a; --chg:#e0a84a; --chg-f:#352a15;
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:1180px; margin:0 auto; padding:32px 16px 80px; }
h1 { font-size:28px; margin:0 0 6px; } h2 { font-size:21px; margin:48px 0 6px; padding-top:12px; border-top:1px solid var(--rule); }
h3 { font-size:16px; margin:26px 0 8px; } p, li { color:var(--fg); max-width:78ch; } .lede { color:var(--muted); margin:0 0 18px; }
code { font:13px ui-monospace, Consolas, monospace; background:var(--be-f); padding:1px 5px; border-radius:4px; }
nav { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 8px; } nav a { color:var(--fg); text-decoration:none; border:1px solid var(--rule); background:var(--card); border-radius:999px; padding:4px 12px; font-size:13px; }
.legend { display:flex; flex-wrap:wrap; gap:14px; font-size:13px; color:var(--muted); margin:6px 0 0; } .sw { display:inline-block; width:14px; height:14px; border-radius:3px; vertical-align:-2px; margin-right:6px; border:1.5px solid; }
.ba { display:grid; grid-template-columns:1fr 1fr; gap:16px; } @media (max-width: 920px) { .ba { grid-template-columns:1fr; } }
figure { margin:12px 0; background:var(--card); border:1px solid var(--rule); border-radius:12px; padding:12px; overflow:hidden; }
figcaption { font-size:13px; color:var(--muted); margin-bottom:8px; } .pill { display:inline-block; font-weight:600; font-size:12px; padding:1px 9px; border-radius:999px; margin-right:6px; }
.pb { background:var(--rm-f); color:var(--rm); } .pa { background:var(--add-f); color:var(--add); }
svg.dg { width:100%; height:auto; display:block; }
.tt { font:600 13px system-ui, sans-serif; fill:var(--fg); text-anchor:middle; }
.ts { font:10.5px ui-monospace, Consolas, monospace; fill:var(--muted); text-anchor:middle; }
.tn { font:12px system-ui, sans-serif; fill:var(--muted); } .tc { font:600 12px system-ui, sans-serif; fill:var(--fg); }
.th { font:600 13px system-ui, sans-serif; fill:var(--fg); } .tm { font:11px ui-monospace, Consolas, monospace; fill:var(--muted); }
.ta { font:11px ui-monospace, Consolas, monospace; fill:var(--add); } .tr { font:11px ui-monospace, Consolas, monospace; fill:var(--rm); text-decoration:line-through; }
.dvt { font:600 11px system-ui, sans-serif; fill:var(--muted); }
.el { font:11px system-ui, sans-serif; fill:var(--muted); paint-order:stroke; stroke:var(--card); stroke-width:4px; stroke-linejoin:round; }
.el-add { fill:var(--add); } .el-rm { fill:var(--rm); } .el-chg { fill:var(--chg); }
.e { fill:none; stroke:var(--line); stroke-width:1.6; } .e-add { stroke:var(--add); } .e-rm { stroke:var(--rm); stroke-dasharray:5 4; } .e-chg { stroke:var(--chg); }
.dash { stroke-dasharray:4 4; } .life { stroke:var(--rule); stroke-width:1.4; stroke-dasharray:3 4; } .div { stroke:var(--rule); stroke-width:1; }
.k-be rect { fill:var(--be-f); stroke:var(--be-s); } .k-fe rect { fill:var(--fe-f); stroke:var(--fe-s); } .k-db rect { fill:var(--db-f); stroke:var(--db-s); }
.k-q rect { fill:var(--q-f); stroke:var(--q-s); } .k-ext rect { fill:var(--ext-f); stroke:var(--ext-s); } .k-note rect { fill:var(--note-f); stroke:var(--note-s); }
.k-add rect { fill:var(--add-f); stroke:var(--add); stroke-width:1.6; } .k-rm rect { fill:var(--rm-f); stroke:var(--rm); stroke-dasharray:5 3; stroke-width:1.6; } .k-chg rect { fill:var(--chg-f); stroke:var(--chg); stroke-width:1.6; }
rect { stroke-width:1.2; }
.ah-n { fill:var(--line); } .ah-add { fill:var(--add); } .ah-rm { fill:var(--rm); } .ah-chg { fill:var(--chg); }
.tbl { width:100%; border-collapse:collapse; font-size:13px; background:var(--card); border:1px solid var(--rule); border-radius:12px; overflow:hidden; }
.tbl th, .tbl td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--rule); vertical-align:top; } .tbl th { color:var(--muted); font-weight:600; }
.tbl tr.chg td { background:var(--chg-f); } .tbl tr.rm td, .tbl tr.rmr td { background:var(--rm-f); } .tbl tr.add td, .tbl tr.addr td { background:var(--add-f); }
.scroll { overflow-x:auto; } .warn, .gate { background:var(--chg-f); border:1px solid var(--chg); border-radius:12px; padding:12px 16px; }
.gate ol { margin:6px 0 0; padding-left:20px; }
`;

const MARKERS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${['n', 'add', 'rm', 'chg'].map((k) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah-${k}"/></marker>`).join('')}
</defs></svg>`;

function page({ title, lede = '', body, css = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}${css}</style>
</head>
<body>
${MARKERS}
<main>
<h1>${esc(title)}</h1>
${lede ? `<p class="lede">${lede}</p>` : ''}
${body}
</main>
</body>
</html>
`;
}

module.exports = { page, CSS };
