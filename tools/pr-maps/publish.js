// Publishes a PR's file map (built by build.js) and records every outside change in ledger.json for teardown.js.
// Run from the workspace folder:  node publish.js <owner/repo> <pr> [--dry-run]
// 1. The repo's shared "PR file maps" pre-release (tag pr-maps on the base branch: .agents/guard.json baseBranch,
//    else the repo's default branch) is created once, only if no workflow there fires on tags or releases.
// 2. The map is uploaded as pr-<pr>-file-map.html (--clobber: same link on every update).
// 3. The PR's comment marked <!-- pr-file-map --> is edited (its original body backed up the first time), or a new one is posted.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TAG = 'pr-maps';
const MARK = '<!-- pr-file-map -->';
const WS = process.cwd();
const STATE = path.join(WS, 'diagrams', '_gen', 'pr-maps');
const LEDGER = path.join(STATE, 'ledger.json');
const BACKUPS = path.join(STATE, 'backups');

const [repo, pr] = process.argv.slice(2);
const dry = process.argv.includes('--dry-run');
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^\d+$/.test(pr || '')) {
  console.error('usage: node publish.js <owner/repo> <pr> [--dry-run]');
  process.exit(1);
}
const name = repo.split('/')[1];
const html = path.join(WS, 'diagrams', 'pr-maps', name, `pr-${pr}-file-map.html`);
const bodyFile = path.join(STATE, 'prs', `${name}-${pr}`, 'comment.md');
if (!fs.existsSync(html) || !fs.existsSync(bodyFile)) throw new Error(`run build.js ${repo} ${pr} first`);

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ok = (...args) => { try { gh(...args); return true; } catch { return false; } };
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : [];
const log = (entry) => { if (dry) return; ledger.push({ ...entry, at: new Date().toISOString() }); fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2)); };
const act = (what, fn) => { console.log(`${dry ? 'would ' : ''}${what}`); return dry ? undefined : fn(); };

const baseBranch = () => {
  try { const b = JSON.parse(fs.readFileSync(path.join(WS, '.agents', 'guard.json'), 'utf8')).baseBranch; if (b) return b; } catch {}
  return gh('api', `repos/${repo}`, '--jq', '.default_branch');
};

// A tag must not start a build or deploy: refuse a repo whose workflows on the base branch fire on tags or releases.
function tagsAreInert(base) {
  let list;
  try { list = JSON.parse(gh('api', `repos/${repo}/contents/.github/workflows?ref=${base}`)); }
  catch (err) { if (/Not Found/.test(err.stderr)) return null; throw err; } // no workflows folder: nothing can fire
  for (const f of list.filter((f) => /\.ya?ml$/.test(f.name))) {
    const text = Buffer.from(JSON.parse(gh('api', `repos/${repo}/contents/${f.path}?ref=${base}`)).content, 'base64').toString();
    const on = (text.match(/^["']?on["']?:([\s\S]*?)(?=^\S)/m) || [])[1];
    if (on === undefined) return `${f.name}: no "on:" block found, check it by hand`;
    if (/\b(release|create|tags)\b/.test(on)) return `${f.name} fires on releases or tags`;
    if (/\bpush\b/.test(on) && !/\bbranches\b/.test(on)) return `${f.name} fires on every push, tags included`;
  }
  return null;
}

// 1. The shared pre-release.
if (!ok('release', 'view', TAG, '--repo', repo)) {
  const base = baseBranch();
  const unsafe = tagsAreInert(base);
  if (unsafe) throw new Error(`not creating a ${TAG} release in ${repo}: ${unsafe}`);
  if (gh('api', `repos/${repo}/git/matching-refs/tags/${TAG}`, '--jq', 'length') !== '0') throw new Error(`tag ${TAG} exists without a release; resolve by hand`);
  act(`create pre-release ${TAG} on ${base} in ${repo}`, () => gh('release', 'create', TAG, '--repo', repo, '--target', base, '--prerelease', '--title', 'PR file maps',
    '--notes', 'Downloadable PR file maps (one self-contained HTML page per PR), linked from PR comments. Not a software release: nothing builds or deploys from it.'));
  log({ type: 'release-created', repo, tag: TAG });
}

// 2. The map.
const asset = path.basename(html);
act(`upload ${asset} to ${TAG}`, () => gh('release', 'upload', TAG, html, '--repo', repo, '--clobber'));
if (!ledger.some((e) => e.type === 'asset-uploaded' && e.repo === repo && e.name === asset)) log({ type: 'asset-uploaded', repo, tag: TAG, name: asset });
const url = `https://github.com/${repo}/releases/download/${TAG}/${encodeURIComponent(asset)}`;

// 3. The comment.
fs.mkdirSync(BACKUPS, { recursive: true });
const next = path.join(BACKUPS, '.next-body.md');
fs.writeFileSync(next, fs.readFileSync(bodyFile, 'utf8').replaceAll('{{URL}}', url));
const comments = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repo}/issues/${pr}/comments`)).flat();
const mine = comments.find((c) => c.body.startsWith(MARK));
if (mine) {
  const id = String(mine.id);
  const ours = ledger.some((e) => e.repo === repo && e.id === id && (e.type === 'comment-created' || e.type === 'comment-edited'));
  if (!ours) { // first edit of a comment we didn't post: keep its exact body so teardown can put it back
    const backup = path.join(BACKUPS, `${repo.replace('/', '__')}__${id}.md`);
    if (!dry) fs.writeFileSync(backup, mine.body);
    log({ type: 'comment-edited', repo, id, backup: path.basename(backup) });
  }
  act(`edit comment ${id} on #${pr}`, () => gh('api', '-X', 'PATCH', `repos/${repo}/issues/comments/${id}`, '-F', `body=@${next}`, '--jq', '.id'));
} else {
  const id = act(`post a new comment on #${pr}`, () => gh('api', `repos/${repo}/issues/${pr}/comments`, '-F', `body=@${next}`, '--jq', '.id'));
  if (id) log({ type: 'comment-created', repo, id });
}
fs.unlinkSync(next);
console.log(`map: ${url}`);
