// Run: node --test ~/agent-kit/hooks/
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { decide } = require('./guard');

const ledgers = {
  'feat/x:docs/reviews/feat-x.md': 'Pass 1: CHANGES REQUESTED.\nVerdict: **APPROVED WITH NOTES**',
  'feat/bad:docs/reviews/feat-bad.md': 'Pass 1: APPROVED\nPass 2: CHANGES REQUESTED',
};
const PROJECT = { productionHosts: ['acme.com', 'acme.io'], reviewGate: true, baseBranch: 'staging' };
const env = ({ pids = [], calls = [], cfg = PROJECT } = {}) => ({
  config: () => cfg,
  liveJestPids: () => pids,
  git: (args) => { calls.push(args); return args.includes('branch') ? 'feat/x' : ledgers[args.at(-1)] || ''; },
});
const pre = (tool, tool_input, e = env()) => decide({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input, cwd: 'C:/ws' }, e);
const sh = (command, e) => pre('Bash', { command }, e);
const ps = (command, e) => pre('PowerShell', { command }, e);
const decision = (r) => r?.hookSpecificOutput.permissionDecision ?? (r ? 'context' : null);
const expect = (want, cmds, run = sh) => { for (const c of cmds) assert.equal(decision(run(c)), want, c); };

test('rule 16: shell reads at the start of a command are denied, pipes are fine', () => {
  expect('deny', ['cat AGENTS.md', 'cd x && ls -la', 'head -5 f', '/usr/bin/grep -r x .', 'sed -n 1,5p f', 'rg foo', 'FOO=1 tail f']);
  expect('deny', ['Get-Content AGENTS.md', 'gci -Recurse', '$c = Get-Content package.json | ConvertFrom-Json'], ps);
  expect(null, ['git log | grep fix', 'gh pr list | head -3', 'git ls-files', "sed -i 's/a/b/' f", 'node build.js', 'echo hi > f']);
});

test('quotes and heredocs are data, not commands', () => {
  expect(null, [
    'git commit -m "deny uncapped runs; head off OOM"',
    "git commit -m \"$(cat <<'EOF'\nFix guard\n\nMore robust quoting.\nType checks pass.\nEOF\n)\"",
    "echo --body \"$(cat <<'EOF'\n## Summary\ncat this\nEOF\n)\" | tail -1",
    "git commit -F - <<'EOF'\nHead line\nEOF",
  ]);
  expect(null, ["git commit -m @'\nMore notes\n'@"], ps);
});

test('rule 3: worktrees, destructive git and staging everything', () => {
  assert.equal(decision(pre('EnterWorktree', {})), 'deny');
  assert.equal(decision(pre('Agent', { isolation: 'worktree', prompt: 'x' })), 'deny');
  assert.equal(decision(pre('Agent', { prompt: 'x' })), null);
  expect('ask', ['git stash', 'git stash pop', 'git --no-pager stash', 'git -C "a b" reset --hard', 'git checkout -- f.ts', 'git checkout .',
    'git checkout -f main', 'git switch --discard-changes main', 'git restore f.ts', 'git clean -fd', 'git worktree add ../x']);
  expect('deny', ['git add -A', 'git add .', 'git add --all', 'git commit -am "x"', 'git commit -a -m x']);
  expect(null, ['git stash list', 'git reset HEAD~1', 'git checkout main', 'git switch main', 'git restore --staged f.ts', 'git worktree list',
    'git status', 'git add src/a.ts docs/b.md', 'git commit -m "add all the things"', 'git commit --amend --no-edit']);
});

test('rule 10: Jest must be capped and alone', () => {
  expect('deny', ['npx jest', 'jest a.spec.ts', 'npx jest --maxWorkers=50%', 'npx jest --maxWorkers=8', 'npm test', 'npm test -- --maxWorkers=4',
    'npm run test:unit', 'npm run test:e2e:jest', 'npm --prefix api test', 'node node_modules/jest/bin/jest.js']);
  expect(null, ['npx jest --maxWorkers=4 a.spec.ts', 'npx jest -w 2', 'npx jest --runInBand', 'npm run test:e2e', 'npm run test:e2e:ci',
    'npm run build', 'npm install -D jest ts-jest', 'npx jest --clearCache', 'git commit -m "cap jest workers"', 'gh pr list --search jest']);
  const r = sh('npx jest --maxWorkers=4 a.spec.ts', env({ pids: ['4242'] }));
  assert.equal(decision(r), 'deny');
  assert.match(r.hookSpecificOutput.permissionDecisionReason, /4242/);
});

test('rule 9: production navigation asks only where the project names its hosts', () => {
  for (const url of ['https://app.acme.com/clients', 'api.acme.io', 'https://acme.io']) assert.equal(decision(pre('mcp__claude-in-chrome__navigate', { url })), 'ask', url);
  for (const url of ['https://api-staging.acme.io', 'http://localhost:3001', 'back', 'https://example.com', 'https://notacme.com']) assert.equal(decision(pre('mcp__Claude_Browser__navigate', { url })), null, url);
  assert.equal(decision(pre('mcp__Claude_Browser__navigate', { url: 'https://app.acme.com' }, env({ cfg: {} }))), null);
});

test('rule 5: gh pr create needs an approved committed ledger where the gate is on', () => {
  const ok = sh('gh pr create --base staging --title "cap jest workers"');
  assert.equal(decision(ok), 'context');
  assert.match(ok.hookSpecificOutput.additionalContext, /carried fix/);
  assert.equal(decision(sh('cd "/c/repo" && gh pr create --head feat/bad')), 'ask');
  const missing = sh('gh pr create --head feat/none');
  assert.equal(decision(missing), 'ask');
  assert.match(missing.hookSpecificOutput.permissionDecisionReason, /not found/);
  for (const [command, dir] of [['Set-Location api; gh pr create --head "feat/x"', 'api'], ['gh pr create -R someone/web --head feat/x', 'web']]) {
    const calls = [];
    assert.equal(decision(ps(command, env({ calls }))), 'context', command);
    assert.equal(path.basename(calls[0][1]), dir, command);
  }
  assert.equal(decision(sh('gh pr create --head feat/none', env({ cfg: {} }))), 'context');
});

test('rules 15 and 6: reminders after gh pr create and git push', () => {
  const post = (command, stdout = '') => decide({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command }, tool_response: { stdout } }, env());
  assert.match(post('gh pr create --fill', 'https://github.com/o/r/pull/12\n').hookSpecificOutput.additionalContext, /file map/);
  assert.equal(post('gh pr create --help', 'USAGE'), null);
  assert.match(post('git -C "a b" push origin x').hookSpecificOutput.additionalContext, /rebase/);
  assert.equal(post('git status'), null);
});
