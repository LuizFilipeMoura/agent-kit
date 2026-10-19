// Undoes everything publish.js did, newest first, using ledger.json. Safe to re-run.
// Run from the workspace folder: node teardown.js [--dry-run]
//   comment-edited  -> the comment gets its backed-up original body back
//   comment-created -> the comment is deleted
//   asset-uploaded  -> the map file is deleted from the release
//   release-created -> the release and its tag are deleted
// Each reverted entry leaves the ledger; anything that fails stays there for the next run.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const STATE = path.join(process.cwd(), 'diagrams', '_gen', 'pr-maps');
const LEDGER = path.join(STATE, 'ledger.json');
const BACKUPS = path.join(STATE, 'backups');
const dry = process.argv.includes('--dry-run');
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const ok = (...args) => { try { gh(...args); return true; } catch { return false; } };

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : [];
if (!ledger.length) { console.log('ledger empty: nothing to undo'); process.exit(0); }
const left = [];
for (const e of ledger.slice().reverse()) {
  try {
    if (e.type === 'comment-edited') {
      const backup = path.join(BACKUPS, e.backup);
      if (!fs.existsSync(backup)) throw new Error(`backup missing: ${e.backup}`);
      console.log(`${dry ? 'would restore' : 'restore'} comment ${e.id} in ${e.repo} from ${e.backup}`);
      if (!dry) {
        gh('api', '-X', 'PATCH', `repos/${e.repo}/issues/comments/${e.id}`, '-F', `body=@${backup}`, '--jq', '.id');
        if (JSON.parse(gh('api', `repos/${e.repo}/issues/comments/${e.id}`)).body !== fs.readFileSync(backup, 'utf8')) throw new Error(`comment ${e.id} does not match its backup`);
      }
    } else if (e.type === 'comment-created') {
      console.log(`${dry ? 'would delete' : 'delete'} comment ${e.id} in ${e.repo}`);
      if (!dry && ok('api', `repos/${e.repo}/issues/comments/${e.id}`)) gh('api', '-X', 'DELETE', `repos/${e.repo}/issues/comments/${e.id}`);
    } else if (e.type === 'asset-uploaded') {
      console.log(`${dry ? 'would delete' : 'delete'} ${e.name} from release ${e.tag} in ${e.repo}`);
      if (!dry && ok('release', 'view', e.tag, '--repo', e.repo) && gh('release', 'view', e.tag, '--repo', e.repo, '--json', 'assets', '--jq', '.assets[].name').split('\n').includes(e.name))
        gh('release', 'delete-asset', e.tag, e.name, '--repo', e.repo, '--yes');
    } else if (e.type === 'release-created') {
      console.log(`${dry ? 'would delete' : 'delete'} release and tag ${e.tag} in ${e.repo}`);
      if (!dry) {
        if (ok('release', 'view', e.tag, '--repo', e.repo)) gh('release', 'delete', e.tag, '--repo', e.repo, '--cleanup-tag', '--yes');
        if (gh('api', `repos/${e.repo}/git/matching-refs/tags/${e.tag}`, '--jq', 'length') !== '0') throw new Error(`tag ${e.tag} still exists`);
      }
    } else throw new Error(`unknown ledger entry ${e.type}`);
    if (dry) left.unshift(e);
  } catch (err) {
    console.error(`FAILED ${e.type}: ${err.message}`);
    left.unshift(e);
  }
}
if (!dry) fs.writeFileSync(LEDGER, JSON.stringify(left, null, 2));
console.log(dry ? `dry run: ${ledger.length} entries, nothing changed` : `done: ${ledger.length - left.length} undone, ${left.length} left`);
