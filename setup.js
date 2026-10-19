// agent-kit setup for this PC. Safe to re-run: it only fills in what's missing. See README.md.
// Usage: node ~/agent-kit/setup.js [--quiet]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KIT = __dirname;
const HOME = os.homedir();
const quiet = process.argv.includes('--quiet');
const say = (msg) => { if (!quiet) console.log(msg); };
const read = (f) => fs.readFileSync(f, 'utf8');
// shell: npx and claude are .cmd shims on Windows.
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: quiet ? 'ignore' : 'inherit', shell: process.platform === 'win32' });
const writeIfChanged = (file, text) => {
  if (fs.existsSync(file) && read(file) === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
};

// 1. The kit's skills, linked for Claude Code and Codex: one copy, two readers.
for (const dir of [path.join(HOME, '.claude', 'skills'), path.join(HOME, '.agents', 'skills')]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(path.join(KIT, 'skills'))) {
    const link = path.join(dir, name);
    let stat = null;
    try { stat = fs.lstatSync(link); } catch { /* not there yet */ }
    if (stat && !stat.isSymbolicLink()) { say(`skipped ${link}: a real folder is there; move it away to use the kit's copy`); continue; }
    if (stat) fs.unlinkSync(link); // relink, in case the kit moved
    fs.symlinkSync(path.join(KIT, 'skills', name), link, 'junction');
    if (!stat) say(`linked ${link}`);
  }
}

// 2. Third-party skills, installed from their own repos (MIT), never copied into the kit.
const THIRD_PARTY = [
  ['mattpocock/skills', ['grilling', 'domain-modeling', 'grill-with-docs']],
  ['Leonxlnx/taste-skill', ['design-taste-frontend', 'redesign-existing-projects']],
];
for (const [source, names] of THIRD_PARTY) {
  const missing = names.filter((n) => !fs.existsSync(path.join(HOME, '.claude', 'skills', n)));
  if (!missing.length) continue;
  say(`installing ${missing.join(', ')} from ${source}`);
  try { sh('npx', ['--yes', 'skills', 'add', source, '-g', '-y', '--agent', 'claude-code', 'codex', '--skill', ...missing]); }
  catch { console.error(`could not install from ${source}; try: npx skills add ${source} -g --skill ${missing.join(' ')}`); }
}

// 3. ponytail, for Claude Code and Codex.
const claudePlugins = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json');
if (!(fs.existsSync(claudePlugins) && read(claudePlugins).includes('"ponytail@ponytail"'))) {
  say('installing the ponytail plugin for Claude Code');
  // HTTPS, not owner/repo: the CLI otherwise falls back to SSH, which a fresh PC may not have set up.
  try { sh('claude', ['plugin', 'marketplace', 'add', 'https://github.com/DietrichGebert/ponytail.git']); sh('claude', ['plugin', 'install', 'ponytail@ponytail']); }
  catch { console.error('could not install ponytail; in Claude Code run: /plugin marketplace add DietrichGebert/ponytail, then /plugin install ponytail@ponytail'); }
}
const codexConfig = path.join(HOME, '.codex', 'config.toml');
if (fs.existsSync(codexConfig) && !read(codexConfig).includes('[plugins."ponytail@ponytail"]')) {
  fs.appendFileSync(codexConfig, '\n[marketplaces.ponytail]\nsource_type = "git"\nsource = "https://github.com/DietrichGebert/ponytail.git"\n\n[plugins."ponytail@ponytail"]\nenabled = true\n');
  say('added ponytail to Codex');
}

// 4. The rules. User level, so they never hide a project's own AGENTS.md.
const atHome = path.resolve(KIT) === path.join(HOME, 'agent-kit');
const IMPORT = atHome ? '@~/agent-kit/AGENTS.md' : `@${KIT.replace(/\\/g, '/')}/AGENTS.md`;
const userMd = path.join(HOME, '.claude', 'CLAUDE.md');
const userMdText = fs.existsSync(userMd) ? read(userMd) : '';
if (!userMdText.includes(IMPORT)) {
  writeIfChanged(userMd, `${userMdText}${userMdText && !userMdText.endsWith('\n') ? '\n' : ''}${IMPORT}\n`);
  say(`added ${IMPORT} to ${userMd}`);
}
const MARK = '<!-- Copied from ~/agent-kit/AGENTS.md by agent-kit setup.js. Edit the kit, not this copy. -->';
const codexMd = path.join(HOME, '.codex', 'AGENTS.md');
if (fs.existsSync(path.dirname(codexMd))) {
  if (fs.existsSync(codexMd) && !read(codexMd).startsWith(MARK)) say(`skipped ${codexMd}: it has your own content; merge the kit rules into it by hand`);
  else if (writeIfChanged(codexMd, `${MARK}\n${read(path.join(KIT, 'AGENTS.md'))}`)) say(`refreshed ${codexMd}`);
}

// 5. The hooks, merged into the user's Claude Code settings. Earlier kit entries are replaced, nothing else is touched.
const settingsFile = path.join(HOME, '.claude', 'settings.json');
const settings = fs.existsSync(settingsFile) ? JSON.parse(read(settingsFile)) : {};
const HOOKS = path.join(KIT, 'hooks');
const hook = (script, timeout) => ({ type: 'command', command: 'node', args: [path.join(HOOKS, script)], timeout });
const isKit = (entry) => (entry.hooks || []).some((h) => (h.args || []).some((a) => path.resolve(a).startsWith(HOOKS)));
const WANT = {
  PreToolUse: { matcher: '^(Bash|PowerShell|EnterWorktree|Agent|mcp__(claude-in-chrome|Claude_Browser)__navigate)$', hooks: [hook('guard.js', 20)] },
  PostToolUse: { matcher: '^(Bash|PowerShell)$', hooks: [hook('guard.js', 20)] },
  SessionStart: { hooks: [hook('pull.js', 60)] },
};
settings.hooks = settings.hooks || {};
for (const [event, entry] of Object.entries(WANT)) settings.hooks[event] = [...(settings.hooks[event] || []).filter((e) => !isKit(e)), entry];
if (writeIfChanged(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)) say(`wired the hooks into ${settingsFile}`);

// 6. The pre-push scan and its local denylist (never committed).
execFileSync('git', ['-C', KIT, 'config', 'core.hooksPath', '.githooks']);
const denylist = path.join(HOME, '.config', 'agent-kit', 'denylist.txt');
if (!fs.existsSync(denylist)) {
  writeIfChanged(denylist, '# One term per line, case-insensitive. A push from ~/agent-kit that contains any of them is refused.\n');
  say(`created ${denylist}: add the company and client names that must never enter the kit`);
}

say('agent-kit is set up. Restart open Claude Code and Codex sessions to load it.');
