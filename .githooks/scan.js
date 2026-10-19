// pre-push scan: the kit must stay free of company and client names. The terms live outside the repo,
// in ~/.config/agent-kit/denylist.txt (one per line, # for comments), so the list itself never gets pushed.
// Exits 1 on any hit in a tracked file, a tracked path or an outgoing commit message. Run by hand: node .githooks/scan.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const list = path.join(os.homedir(), '.config', 'agent-kit', 'denylist.txt');
const terms = fs.existsSync(list)
  ? fs.readFileSync(list, 'utf8').split(/\r?\n/).map((t) => t.trim().toLowerCase()).filter((t) => t && !t.startsWith('#'))
  : [];
if (!terms.length) { console.log(`scan: no terms in ${list}, nothing checked`); process.exit(0); }

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
let messages = '';
try { messages = git('log', '--format=%B', '@{u}..HEAD'); } catch {
  try { messages = git('log', '--format=%B'); } catch { /* no commits yet */ } // no upstream yet: every commit is outgoing
}

const hits = [];
const check = (where, text) => { const lower = text.toLowerCase(); for (const t of terms) if (lower.includes(t)) hits.push(`${where}: "${t}"`); };
for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) {
  check(file, file);
  check(file, fs.readFileSync(file, 'utf8'));
}
check('commit messages', messages);

if (hits.length) { console.error(`scan: refused, denylisted terms found:\n  ${hits.join('\n  ')}`); process.exit(1); }
console.log(`scan: clean (${terms.length} terms)`);
