# agent-kit

My rules, skills and hooks for coding agents (Claude Code and Codex), shared across every PC I work on. Nothing here belongs to one company or project: each project keeps its own specifics in its own `AGENTS.md`.

## Keep it installed and current

**Every PC I code on should have this repo cloned at `~/agent-kit`, set up once with `setup.js`, and pulled often.** Newer versions of the skills, rules and hooks land here first. A PC that falls behind follows old rules.

- At the start of every Claude Code session, `hooks/pull.js` fast-forwards the kit when it has no local changes. It then re-links any new skills and refreshes Codex's copy of the rules. It also says when the kit has uncommitted changes or unpushed commits.
- To pull by hand at any time: `git -C ~/agent-kit pull --ff-only`.
- After changing anything here, commit and push it straight away, so the other PCs get it.

## Install on a new PC

Needs git, Node 20+, `gh` signed in, and Claude Code. Codex is optional.

```bash
gh repo clone LuizFilipeMoura/agent-kit ~/agent-kit
node ~/agent-kit/setup.js
```

In PowerShell, write `$HOME/agent-kit` instead of `~/agent-kit`. Restart any open Claude Code and Codex sessions afterwards. Running `setup.js` again is safe: it only fills in what's missing.

`setup.js` does this:

- **Links the kit's skills** into `~/.claude/skills/` (Claude Code) and `~/.agents/skills/` (Codex), as junctions, so both agents read the same files.
- **Installs the third-party skills from their own repos:** grilling, domain-modeling, grill-with-docs, design-taste-frontend and redesign-existing-projects, plus the ponytail plugin for Claude Code and Codex.
- **Loads the rules:** it adds `@~/agent-kit/AGENTS.md` to `~/.claude/CLAUDE.md` and copies the rules to `~/.codex/AGENTS.md`. Both are user level, so a project's own `AGENTS.md` still loads.
- **Wires the hooks** into `~/.claude/settings.json`, merged with what's already there: `hooks/guard.js` on tool calls and `hooks/pull.js` at session start.
- **Turns on the pre-push scan** (`.githooks/pre-push`). It refuses a push that contains any term listed in `~/.config/agent-kit/denylist.txt`, one per line. That file is local to each PC and never committed.

## What's inside

| Path | What |
|---|---|
| `AGENTS.md` | The working rules, numbered 1 to 18 (15 is retired) |
| `skills/` | `diagram-page`, `pr-workflow`, `pr-description`, `survivable-code-review` |
| `hooks/guard.js` | Enforces rules 3, 10 and 16 everywhere, and rules 5 and 9 where a project turns them on. Tests: `node --test ~/agent-kit/hooks/guard.test.js` |
| `hooks/pull.js` | The session-start update described above |
| `tools/diagrams/` | `lib.js` (inline-SVG boxes, edges, sequences), `page.js` (page shell), `serve.js` (static server on 127.0.0.1:8799) |
| `tools/jest-procs.js` | List Jest processes; `--kill-orphans` kills the ones whose parent is gone |
| `setup.js` | One-time setup per PC |

## Per-project settings

A project describes itself in its own `AGENTS.md`: its repos, base branch, production hosts and test values. Two more things are per project:

- **Don't add a `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md`** at the project root or above it. Claude Code then skips the project's `AGENTS.md`. The kit's own line in `~/.claude/CLAUDE.md` doesn't count.
- **`.agents/guard.json`** turns on the project-specific hook checks:

```json
{
  "productionHosts": ["example.com", "example.io"],
  "testHostMarkers": ["staging"],
  "reviewGate": true,
  "baseBranch": "staging"
}
```

- **`productionHosts`:** the browser asks before navigating to these hosts or their subdomains, unless the host contains one of `testHostMarkers`.
- **`reviewGate`:** `gh pr create` asks first unless the branch's committed review ledger ends on APPROVED.
- **`baseBranch`:** what PRs stack on. It defaults to the repo's default branch.

## Credits and licenses

- `skills/survivable-code-review` is adapted from Cursor's thermo-nuclear review skills (`cursor/plugins`, `cursor-team-kit`), under the MIT License. See its `LICENSE`.
- These are installed by `setup.js` from their own repos and not copied here: grilling, domain-modeling and grill-with-docs (`mattpocock/skills`, MIT), design-taste-frontend and redesign-existing-projects (`Leonxlnx/taste-skill`, MIT), and ponytail (`DietrichGebert/ponytail`, MIT).
- Everything else is mine.
