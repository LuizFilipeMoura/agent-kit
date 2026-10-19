// Builds the interactive file map for one PR (AGENTS.md rule 15, skill pr-file-map).
// Run from the workspace folder, the one that holds the repo checkout as <repo name>/.
//   node build.js <owner/repo> <pr> --prep   list the PR's files into diagrams/_gen/pr-maps/prs/<repo>-<pr>/chunk-N.tsv
//   node build.js <owner/repo> <pr>          build diagrams/pr-maps/<repo>/pr-<pr>-file-map.html and comment.md
// Inputs in diagrams/_gen/pr-maps/prs/<repo>-<pr>/: *.why.json (one note per file), themes.json (optional), story.html (optional).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const [repo, pr, mode] = process.argv.slice(2);
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^\d+$/.test(pr || '')) {
  console.error('usage: node build.js <owner/repo> <pr> [--prep]');
  process.exit(1);
}
const name = repo.split('/')[1];
const WS = process.cwd();
const REPO = path.join(WS, name);
if (!fs.existsSync(path.join(REPO, '.git'))) { console.error(`no git checkout at ${REPO}: run from the folder that holds ${name}/`); process.exit(1); }
const DIR = path.join(WS, 'diagrams', '_gen', 'pr-maps', 'prs', `${name}-${pr}`);
const OUT = path.join(WS, 'diagrams', 'pr-maps', name, `pr-${pr}-file-map.html`);
const STANDARD = {
  rider: ['Rider', '#d0342c', "Doesn't serve this PR's feature and isn't a listed carried fix. The description should disclose it: what it changes and why."],
  'no-op': ['No behaviour change', '#c3c6cc', 'Comment cuts, copy, a blank line or an unused import. Nothing runs differently.'],
  tooling: ['Tooling', '#8a8f3a', 'Lint, CI, load tests and package scripts.'],
  other: ['Other', '#9aa5b8', "Serves this PR's feature but fits no theme above."],
};

const run = (cmd, ...args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const git = (...args) => run('git', '-C', REPO, ...args);
const meta = JSON.parse(run('gh', 'pr', 'view', pr, '--repo', repo, '--json', 'title,url,state,baseRefName,baseRefOid,headRefName,headRefOid'));
git('fetch', '--quiet', 'origin', meta.baseRefName, meta.headRefName);
const HEAD = meta.headRefOid;
// A merged PR is already inside its base branch, so compare against the base it was opened on.
const BASE = git('merge-base', meta.state === 'MERGED' ? meta.baseRefOid : `origin/${meta.baseRefName}`, HEAD).trim(); // what GitHub's "Files changed" compares

// numstat -z: "add\tdel\tpath\0", or for a rename "add\tdel\t\0old\0new\0"
const diff = [];
const parts = git('diff', '--numstat', '-z', '-M', BASE, HEAD).split('\0');
for (let i = 0; i < parts.length - 1; i++) {
  const [a, d, p] = parts[i].split('\t');
  diff.push(p === '' ? { a: +a || 0, d: +d || 0, from: parts[++i], p: parts[++i] } : { a: +a || 0, d: +d || 0, p });
}
fs.mkdirSync(DIR, { recursive: true });

if (mode === '--prep') {
  const status = git('diff', '--name-status', '-M', BASE, HEAD).trim().split('\n').sort((x, y) => x.split('\t').at(-1).localeCompare(y.split('\t').at(-1)));
  fs.writeFileSync(path.join(DIR, 'status.tsv'), status.join('\n') + '\n');
  const size = status.length <= 40 ? status.length : 60; // small PRs: one chunk, annotated inline
  for (let c = 0; c * size < status.length; c++) fs.writeFileSync(path.join(DIR, `chunk-${c + 1}.tsv`), status.slice(c * size, (c + 1) * size).join('\n') + '\n');
  console.log(`${status.length} files in ${Math.ceil(status.length / size)} chunk(s) under ${DIR}\nbase ${BASE.slice(0, 9)} (${meta.baseRefName})  head ${HEAD.slice(0, 9)} (${meta.headRefName})`);
  process.exit(0);
}

// Notes: every file in the diff gets exactly one, with a known theme.
const themesFile = path.join(DIR, 'themes.json');
const themes = { ...STANDARD, ...(fs.existsSync(themesFile) ? JSON.parse(fs.readFileSync(themesFile, 'utf8')) : {}) };
const notes = new Map();
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.why.json')))
  for (const n of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) notes.set(n.path, n);
const problems = [];
const isTest = (p) => /\.spec\.tsx?$|\.test\.tsx?$|\.harness\.ts$|\/tests?\/|\/__tests__\//.test(p);
const statusOf = new Map();
const ns = git('diff', '--name-status', '-z', '-M', BASE, HEAD).split('\0');
for (let i = 0; i < ns.length - 1; i++) { const s = ns[i][0]; if (s === 'R' || s === 'C') i++; statusOf.set(ns[++i], s); }
const files = diff.map((s) => {
  const n = notes.get(s.p);
  if (!n) return problems.push(`no note for ${s.p}`);
  if (!themes[n.theme]) problems.push(`unknown theme "${n.theme}" on ${s.p}`);
  notes.delete(s.p);
  const status = statusOf.get(s.p);
  return {
    p: s.p, from: s.from, s: status, a: s.a, d: s.d, what: n.what, why: n.why, theme: n.theme,
    rb: n.replacedBy || undefined, key: !!n.key, test: isTest(s.p),
    gh: `${meta.url}/files#diff-${crypto.createHash('sha256').update(s.p).digest('hex')}`,
  };
});
for (const p of notes.keys()) problems.push(`note for a file not in the diff: ${p}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

// Unchanged siblings: files at each ref in a directory the PR touches.
const dirOf = (p) => p.slice(0, p.lastIndexOf('/')) || '.';
const touched = new Set(files.flatMap((f) => [dirOf(f.p), f.from && dirOf(f.from)]).filter(Boolean));
const changed = new Set(files.flatMap((f) => [f.p, f.from].filter(Boolean)));
const siblings = (ref) => git('ls-tree', '-r', '--name-only', ref).split('\n').filter((p) => p && touched.has(dirOf(p)) && !changed.has(p));
const data = {
  meta: { repo, pr: +pr, title: meta.title, url: meta.url, base: meta.baseRefName, head: meta.headRefName, sha: HEAD, baseSha: BASE },
  themes, files, before: siblings(BASE), after: siblings(HEAD),
};

const storyFile = path.join(DIR, 'story.html');
const story = fs.existsSync(storyFile) ? `<h2 id="why">Why the folders changed</h2>\n${fs.readFileSync(storyFile, 'utf8')}` : '<h2 id="why">Themes</h2>';
const title = `PR ${pr} file map`;
const html = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replaceAll('{{TITLE}}', title)
  .replace(/  <h2 id="why">[^<]*<\/h2>\n  <!--STORY-->/, () => '  ' + story)
  .replace('/*DATA*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

// The PR comment publish.js posts. {{URL}} becomes the download link.
const count = (s) => files.filter((f) => f.s === s).length;
const sum = (k) => files.reduce((t, f) => t + f[k], 0).toLocaleString('en-US');
const riders = files.filter((f) => f.theme === 'rider').length;
fs.writeFileSync(path.join(DIR, 'comment.md'), `<!-- pr-file-map -->
## Interactive file map

**[Download the PR ${pr} file map]({{URL}})**, then open the downloaded file in your browser. It's one self-contained page that works offline, and only people with access to this repo can download it.

It covers every file this PR touches, from \`${meta.baseRefName}\` to \`${meta.headRefName}\` at \`${HEAD.slice(0, 9)}\`:
- **Map:** a zoomable treemap, sized by lines changed and coloured by status or theme. Click a file to see what changed in it and why.
- **Before and after:** both folder trees side by side, one folder or file per row. Lines join each moved or deleted file to the file that took over its job.

| Created | Changed | Deleted | Moved | Total |
|---:|---:|---:|---:|---:|
| ${count('A')} | ${count('M')} | ${count('D')} | ${count('R')} | **${files.length}** (+${sum('a')} / −${sum('d')}, ${files.filter((f) => f.test).length} of them tests) |
${riders ? `\n**Riders:** ${riders} files don't serve this PR's feature. They're tagged Rider in the map; the description should list each one as a carried fix, with what it changes and why.\n` : ''}`);
console.log(`wrote ${OUT}\n${files.length} files, ${riders} riders, ${data.before.length}/${data.after.length} unchanged siblings`);
