// agent-kit SessionStart hook: keep the kit current on this PC.
// Fast-forwards when the kit has no local changes, re-runs setup when new commits arrive (links new skills,
// refreshes the Codex copy), and says when there's something to commit or push. Silent when all is current.
const { execFileSync } = require('child_process');
const path = require('path');

const KIT = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', ['-C', KIT, ...args], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const notes = [];

try {
  git('fetch', '--quiet');
  if (git('status', '--porcelain')) {
    notes.push('~/agent-kit has uncommitted changes: commit and push them so the other PCs get them.');
  } else {
    const before = git('rev-parse', 'HEAD');
    try { git('merge', '--ff-only', '--quiet', '@{u}'); } catch { notes.push('~/agent-kit has diverged from GitHub: pull and merge by hand.'); }
    const after = git('rev-parse', 'HEAD');
    if (before !== after) {
      execFileSync(process.execPath, [path.join(KIT, 'setup.js'), '--quiet'], { stdio: 'ignore', timeout: 120000 });
      notes.push(`agent-kit updated ${before.slice(0, 7)}..${after.slice(0, 7)}: ${git('log', '--format=%s', `${before}..${after}`).split('\n').join('; ')}.`);
    }
  }
  const ahead = Number(git('rev-list', '--count', '@{u}..HEAD'));
  if (ahead) notes.push(`~/agent-kit has ${ahead} unpushed commit(s): push them.`);
} catch {
  // Offline or no upstream: the kit stays as it is; nothing to report.
}

if (notes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notes.join(' ') } }));
