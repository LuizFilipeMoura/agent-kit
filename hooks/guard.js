// agent-kit hook for AGENTS.md rules 3, 5, 9, 10, 15 and 16. Reads the hook event JSON on stdin and prints
// a PreToolUse decision (deny / ask) or extra context. Prints nothing when the call is fine.
// Rules 5 (review gate) and 9 (production hosts) only apply where the project's .agents/guard.json turns them on.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const READS = new Set(['cat', 'head', 'tail', 'ls', 'dir', 'type', 'find', 'findstr', 'grep', 'egrep', 'rg', 'awk', 'less', 'more',
  'get-content', 'gc', 'get-childitem', 'gci', 'select-string', 'sls']);

const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

const realEnv = {
  git: (args) => run('git', args),
  config: (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, '.agents', 'guard.json'), 'utf8')); } catch { return {}; } },
  // One PID per live run: the topmost jest-ish process whose parent still exists. Workers and orphaned runs don't count.
  // shortcut: Windows only (Win32_Process); elsewhere this finds nothing and the concurrency check is skipped.
  liveJestPids: () => (process.platform !== 'win32' ? [] : run('powershell', ['-NoProfile', '-Command',
    "$j = @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? { $_.CommandLine -match 'jest' }); $ids = $j.ProcessId; "
    + "$j | ? { $ids -notcontains $_.ParentProcessId -and (Get-Process -Id $_.ParentProcessId -EA SilentlyContinue) } | % { $_.ProcessId }"])
    .split(/\s+/).filter(Boolean)),
};

// Heredoc and here-string bodies are stdin, not commands; separators inside quotes don't split commands.
// shortcut: an unbalanced quote masks to the next quote, so a later command can slip through; upgrade to a real parser if that bites.
const mask = (cmd) => cmd
  .replace(/<<-?[ \t]*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\r?\n|$)/g, (m) => m.slice(0, m.indexOf('\n')))
  .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, "''")
  .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (q) => q.replace(/[;&|\r\n]/g, ' '));

// Commands run in sequence; only the left side of a pipe starts a command.
const segments = (cmd) => mask(cmd).split(/&&|\|\||;|\r?\n/)
  .map((s) => s.split('|')[0].trim().replace(/^[({]\s*/, '').replace(/^\$[\w:]+\s*=\s*/, '').replace(/^(\w+=\S*\s+)+/, ''))
  .filter(Boolean);

const firstWord = (seg) => seg.split(/\s+/)[0].split(/[\\/]/).pop().replace(/\.exe$/i, '').toLowerCase();

// "git [-C dir] [-c k=v] [--no-pager] sub rest" → [sub, rest]
const gitSub = (seg) => (seg.match(/^git(?:\s+(?:-[Cc]\s+(?:"[^"]*"|'[^']*'|\S+)|--[\w-]+(?:=\S+)?|-P))*\s+(\S+)(.*)$/) || []).slice(1);

// Rule 3: things that can discard another agent's uncommitted work. Only the user can approve those.
function gitAsk(seg) {
  const [sub, rest = ''] = gitSub(seg);
  const discard = 'can discard changes another agent made. Approve only if every change it touches is yours.';
  if (sub === 'worktree' && /^\s+add\b/.test(rest)) return 'Rule 3: no worktrees; work in the checkout.';
  if (sub === 'stash' && !/^\s+(list|show)\b/.test(rest)) return `Rule 3: \`git stash\` ${discard}`;
  if (sub === 'reset' && /--hard\b/.test(rest)) return `Rule 3: \`git reset --hard\` ${discard}`;
  if (sub === 'checkout' && /(^|\s)(--|-f|--force|\.)(\s|$)/.test(rest)) return `Rule 3: \`git checkout\` that overwrites files ${discard}`;
  if (sub === 'switch' && /(^|\s)(-f|--force|--discard-changes)(\s|$)/.test(rest)) return `Rule 3: \`git switch\` that discards changes ${discard}`;
  if (sub === 'restore' && !(/--staged|(^|\s)-S\b/.test(rest) && !/--worktree|(^|\s)-W\b/.test(rest))) return `Rule 3: \`git restore\` ${discard}`;
  if (sub === 'clean' && /(^|\s)(-\w*f|--force)/.test(rest)) return `Rule 3: \`git clean\` ${discard}`;
  return null;
}

// Rule 3: staging everything would commit other agents' files; staging by path always works instead.
function gitDeny(seg) {
  const [sub, rest = ''] = gitSub(seg);
  if (sub === 'add' && /(^|\s)(-A|--all|-u|--update|\.)(\s|$)/.test(rest)) return 'Rule 3: stage only your own files, by path (`git add <file> …`), never everything.';
  if (sub === 'commit' && /(^|\s)(-[a-zA-Z]*a[a-zA-Z]*|--all)(\s|$)/.test(rest)) return 'Rule 3: `git commit -a` would include other agents\' changes. Stage your own files by path, then commit.';
  return null;
}

// npm test scripts can bake in their own --maxWorkers, and a second flag doesn't override it, so they're never capped.
const PLAYWRIGHT = new Set(['test:e2e', 'test:e2e:ui', 'test:e2e:ci']);
const npmScript = (seg) => (seg.match(/^(?:npm|pnpm|yarn)(?:\.cmd)?(?:\s+(?:--prefix|-C|--dir|-w|--workspace)[=\s]+\S+)*\s+(?:run(?:-script)?\s+)?(test(?::\S+)?|t)(?:\s|$)/) || [])[1];
const npmTest = (seg) => { const s = npmScript(seg); return Boolean(s) && !PLAYWRIGHT.has(s); };
const isJest = (seg) => (npmTest(seg) || /^(?:(?:npx|yarn|pnpm(?:\s+exec)?)\s+)?(?:node\s+\S*[\\/])?jest(?:\.js|\.cmd)?(?:\s|$)/.test(seg))
  && !/--(clearCache|listTests|version|showConfig)\b/.test(seg);
const capped = (seg) => {
  if (npmTest(seg)) return false;
  const m = seg.match(/(?:--maxWorkers|(?:^|\s)-w)[=\s]+(\d+)(?![\d%])/);
  return /--runInBand|(^|\s)-i(\s|$)/.test(seg) || (m && Number(m[1]) <= 4);
};

// Rule 9: a production host from the project's config, unless it carries a test-host marker such as "staging".
function prodHost(url, cfg) {
  try {
    const host = new URL(/^\w+:\/\//.test(url) ? url : `https://${url}`).hostname;
    const prod = (cfg.productionHosts || []).some((h) => host === h || host.endsWith(`.${h}`));
    return prod && !(cfg.testHostMarkers || ['staging']).some((m) => host.includes(m)) ? host : null;
  } catch { return null; }
}

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, '$2');

// Rule 5: the branch's own committed ledger must end on APPROVED (with or without notes).
function prGate(segs, i, cwd, env) {
  let dir = cwd;
  for (const s of segs.slice(0, i)) {
    const m = s.match(/^(?:cd|chdir|pushd|set-location|sl)\s+(?:-Path\s+)?("[^"]+"|'[^']+'|\S+)/i);
    // Git Bash writes C:\ as /c/
    if (m) dir = path.resolve(dir, unquote(m[1]).replace(/^\/([a-z])\//i, '$1:/'));
  }
  const repo = (segs[i].match(/(?:-R|--repo)[=\s]+\S*\/([^\s/"']+)/) || [])[1];
  if (repo && path.basename(dir) !== repo) dir = path.join(dir, repo);
  const flag = (segs[i].match(/(?:--head|\s-H)[=\s]+("[^"]+"|'[^']+'|\S+)/) || [])[1];
  const head = (flag ? unquote(flag) : env.git(['-C', dir, 'branch', '--show-current'])).replace(/^[^:]+:/, '');
  const ledger = `docs/reviews/${head.replace(/\//g, '-')}.md`;
  const verdicts = env.git(['-C', dir, 'show', `${head}:${ledger}`]).match(/CHANGES REQUESTED|APPROVED/g) || [];
  if (verdicts.at(-1) === 'APPROVED') return null;
  return `Rule 5: no approved survivable review for "${head}". ${ledger} must be committed on the branch and end on APPROVED or APPROVED WITH NOTES${verdicts.length ? ` (it ends on ${verdicts.at(-1)})` : ' (not found)'}.`;
}

const out = (event, fields) => ({ hookSpecificOutput: { hookEventName: event, ...fields } });
const deny = (reason) => out('PreToolUse', { permissionDecision: 'deny', permissionDecisionReason: reason });
const ask = (reason) => out('PreToolUse', { permissionDecision: 'ask', permissionDecisionReason: reason });

const PR_CHECKLIST = 'PR checklist (pr-workflow skill): the body lists every carried fix with what it changes and why (rule 4), '
  + 'carries the Mermaid before → after, end shape and stack map (rule 12), and names the counterpart PR for cross-repo work (rule 4).';

function decide(input, env = realEnv) {
  const { hook_event_name: event, tool_name: tool, tool_input: ti = {}, cwd = process.cwd() } = input;
  const segs = segments(ti.command || '');

  if (event === 'PostToolUse') {
    // Only when a PR URL came back, so --help and failed creates stay quiet.
    if (segs.some((s) => /^gh\s+pr\s+create\b/.test(s)) && /\/pull\/\d+/.test(JSON.stringify(input.tool_response ?? ''))) {
      return out(event, { additionalContext: 'PR opened. Next: build its file map with the pr-file-map skill (rule 15), then check its status (rule 6) and report the link with state, base, CI, mergeability and the map link.' });
    }
    if (segs.some((s) => gitSub(s)[0] === 'push')) {
      return out(event, { additionalContext: 'Pushed. If this branch has an open PR whose diff changed: rebuild and republish its file map (rule 15) and rebase the PRs stacked above it (rule 4).' });
    }
    return null;
  }

  if (tool === 'EnterWorktree' || (tool === 'Agent' && ti.isolation === 'worktree')) {
    return deny('Rule 3: no worktrees. Work directly in the checkout, on top of what other agents have done.');
  }
  const cfg = env.config(process.env.CLAUDE_PROJECT_DIR || cwd);
  if (/__navigate$/.test(tool || '')) {
    const host = prodHost(ti.url || '', cfg);
    return host && ask(`Rule 9: ${host} is production. Test on localhost or a test host.`);
  }
  if (tool !== 'Bash' && tool !== 'PowerShell') return null;

  for (const [i, seg] of segs.entries()) {
    const word = firstWord(seg);
    if (READS.has(word)) {
      return deny(`Rule 16: read files with Read, search contents with Grep and find files with Glob, not \`${word}\`. Piping git/gh/npm output into it is fine.`);
    }
    if (word === 'sed' && /(^|\s)-\w*n/.test(seg)) return deny('Rule 16: read files with Read, not `sed -n`.');
    const gitDenied = gitDeny(seg);
    if (gitDenied) return deny(gitDenied);
    const gitAsked = gitAsk(seg);
    if (gitAsked) return ask(gitAsked);
    if (isJest(seg)) {
      if (!capped(seg)) return deny('Rule 10: cap Jest. From the repo folder, run `npx jest --config=jest.config.js --maxWorkers=4 <the spec files you touched>`. npm test scripts can bake in their own --maxWorkers, and a second flag doesn\'t override it.');
      const pids = env.liveJestPids();
      if (pids.length) return deny(`Rule 10: another Jest run is in progress (PID ${pids.join(', ')}). Wait for it to finish; never kill a run that isn't yours.`);
    }
    if (/^gh\s+pr\s+create\b/.test(seg)) {
      const reason = cfg.reviewGate ? prGate(segs, i, cwd, env) : null;
      return reason ? ask(reason) : out('PreToolUse', { additionalContext: PR_CHECKLIST });
    }
  }
  return null;
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; }).on('end', () => {
    const result = decide(JSON.parse(raw));
    if (result) process.stdout.write(JSON.stringify(result));
  });
}

module.exports = { decide };
