# Working rules for coding agents

These rules come from my agent kit (`~/agent-kit`) and apply to every project on every PC: Claude Code loads them through `~/.claude/CLAUDE.md`, and Codex through `~/.codex/AGENTS.md`. They apply to every coding agent, Claude Code, Codex and the rest. Edit them in the kit, then commit and push.

A project adds its specifics in its own `AGENTS.md`: repos, base branch, production hosts, test values, and where its diagrams and glossary live. Where a rule here says "the project", look there.

Three layers carry the rules:

- **This file:** the rules and why, loaded every session.
- **Hooks:** `~/.claude/settings.json` runs `~/agent-kit/hooks/guard.js` on Claude's tool calls. It enforces rules 3, 10 and 16 everywhere, and rules 5 and 9 where the project's `.agents/guard.json` turns them on. It also reminds rules 4, 6 and 18 when a PR is opened or pushed. A deny names the compliant way; an ask goes to the user. `hooks/pull.js` keeps the kit current at session start.
- **Skills:** `~/agent-kit/skills/`, linked into `~/.claude/skills/` and `~/.agents/skills/`, holds the how-to, loaded on demand.

Tool names are Claude Code's (`Read`, `Grep`, `Glob`, `preview_start`, `ccd_pr`, `mcp__claude-in-chrome__*`). Other agents use their closest equivalent and follow the same rule.

## At a glance

Rule numbers are stable because memories, skills, scripts and PR ledgers cite them. Add new rules at the end.

| When | Rules |
|---|---|
| Before you start | 3 `git status`, no worktrees · 2 grill medium and large tasks · 14 show schema changes |
| While you work | 1 ponytail · 16 read with `Read`/`Grep`/`Glob` · 7 run commands yourself · 10 cap Jest · 11 check subprocesses every 5 minutes · 12 diagram pages · 13 taste skills for UI |
| Testing | 8 the user's real browser first · 9 fake data only, never production |
| Finishing | 17 done means verified · 4 stack · 5 survivable review · 18 PR description · 6 check status before sharing a link |

## Working rules

### 1. Ponytail on every task

Use the `ponytail` skill for every task that touches code: writing, fixing, refactoring and reviewing, one-liners included. Write the least code that works: YAGNI → stdlib → platform → installed dependency → one line → minimum that works. Ponytail never cuts validation, error handling, security or accessibility.

### 2. Grill medium and large tasks before building

Before writing code for a medium or large task, run `grilling`, then `domain-modeling`; these are the two skills `/grill-with-docs` wraps, and only the user can invoke `/grill-with-docs` itself. Don't build until the question rounds reach a shared understanding with the user.

- **Small:** a fix or tweak with one obvious solution, in a file or two, with no new behaviour.
- **Medium or large:** everything else, for example a new feature or behaviour; changes across several files or repos; a schema, data-model or API contract change; a new integration, library or pattern; changing who owns a concept; anything that will become its own PR.
- If unsure, treat it as medium. Skip the grill only when the user says so for that task.

Use the glossary and ADR folder the project names; by default `GLOSSARY.md` and `docs/adr/NNNN-*.md`. Never start a parallel glossary next to an existing one.

### 3. No worktrees: work on top

- No git worktrees, `EnterWorktree` or `isolation: "worktree"`. Work directly in the checkout, on top of what other agents have done.
- Run `git status` before starting so you know which changes are yours. Commit only your own files: stage them by path, never with `git add -A`, `git add .` or `git commit -a`.
- **IMPORTANT: never stash, reset, revert, discard or reformat changes you didn't make.** Several agents may share each checkout.

### 4. Stacked PRs

When more than one feature is in flight, each gets its own branch and PR, stacked by dependency on the project's base branch (by default the repo's default branch). A feature that spans repos gets a matching stack in each, and each PR names its counterpart. Carried fixes are allowed in any PR when the description lists each one, one line with what it changes and why. A stack of 2 or more PRs keeps its map, merge order and deploy gate in one tracking issue that every PR links to. The steps are in the `pr-workflow` skill.

### 5. Survivable review on every PR

Run `survivable-code-review` on each PR against its parent before pushing or opening it. A PR goes up only with **APPROVED** or **APPROVED WITH NOTES**, and its ledger `docs/reviews/<branch, with / as ->.md` is committed in that PR. Findings are settled in code, the ledger or a PR comment, never by editing the PR description. Never use the original thermo-nuclear review: it has no exit and loops.

### 6. Check status before sharing a PR link

Read the PR's current state first, with `ccd_pr` `get_status` or `gh pr view <n> --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,baseRefName`. Report the link with its state, base branch, CI (passing, failing or pending) and mergeability. For a stack, report every PR in it.

### 7. Run commands yourself

Run every command you can: installs, builds, tests, typechecks, seeds, git, `gh`, and dev servers through `preview_start` (the project's `.claude/launch.json`). Don't hand the user commands to run. Ask only for what you genuinely can't do (credentials, interactive sign-in, approvals, anything the sandbox blocks) and say exactly what is needed.

### 8. Test in the user's real browser first

"Chrome" means Brave or whichever browser the user has open and connected. For UI and end-to-end checks, try Claude in Chrome (`mcp__claude-in-chrome__*`) first: it has the user's real sessions. Fall back to the built-in browser or Playwright only when Chrome isn't connected, and say that you fell back.

### 9. Fake data only, never production

**IMPORTANT: test only on localhost or the project's test hosts. Never test in production.** The project's `AGENTS.md` names its production hosts. Check the host before typing anything, and stop and ask if it isn't local or a test host.

- Fill every form with obviously fake data: names like `Testy McTestface` or `Jane Bogus`, `*@example.com` emails only (test environments often send real email), phones `555-0100` to `555-0199`, and invented addresses, dates, amounts and answers. Reuse fake account numbers from the repo's seeds or fixtures. The project may name its own test values.
- Never copy real customer data, even data already in a test environment.
- Never type into government-ID fields (SSN, passport and the like) or real bank or card fields, even with a test value. Pause and say which field needs the user.
- Final submits that leave the app need a quick confirmation first: e-signature envelopes, emails, CRM syncs and submissions to third parties.

### 10. Cap Jest and clean up after it

Several agents may share the machine, and parallel Jest runs can fill its memory. An `npm test` script can bake in its own `--maxWorkers`, and a second flag doesn't override it.

- From the repo folder, run `npx jest --config=jest.config.js --maxWorkers=4 <the spec files you touched>`. Wait while another agent's run is going.
- When you're done, kill your own run if it's still alive (`taskkill /PID <pid> /T /F`), and kill orphans with `node ~/agent-kit/tools/jest-procs.js --kill-orphans`. Never kill another agent's live run.

### 11. Check every subprocess every 5 minutes

Every background command, test run, build, migration, subagent and dev server you start gets a check at least every 5 minutes.

- **Stale** means no new output since the last check, such as a Jest suite count that isn't moving or an agent with no new tool calls. **Blocked** means waiting on something that won't come: a prompt, a lock, a port in use, a dead database, another process.
- When one is stale or blocked, find out why, then kill it (rule 10's `taskkill /T /F`, or stop the agent) and restart or report it. Never leave it running unwatched.
- Say what you checked in your next update, for example "suite at 412/570, moving".

### 12. Diagram every change

Every change gets a diagram before the code, so it can be checked and agreed on; typo-level edits are exempt. A small change needs one diagram, in chat and in its PR. Grilling, medium or large work, cross-repo changes and PR stacks get a full HTML page in the project's `diagrams/` that leads with the concept map (entities, ownership, lifecycles, rules); code-path diagrams come second. The PR body draws its diagrams from that concept map (rule 18). When the plan changes, update the picture before the code. The how-to is in the `diagram-page` skill.

### 13. Taste skills for UI

Any UI work gets a taste skill: `redesign-existing-projects` for app screens (dashboards, forms, settings, admin) and `design-taste-frontend` for public pages (marketing, landing, pricing). The project's design system wins: build with its components and tokens, and don't add a font, palette or animation library unless the user agrees. For a visible redesign, show the before → after on the rule 12 page first.

### 14. Show schema changes before making them

Before changing stored data, relationships or which record owns a value, show the current and proposed schema side by side, with the real collection and field names and fake example records, on the rule 12 page and readable in chat. Say which record is the source of truth and how existing records and completed history are preserved, with the migration and conflict plan. Never silently discard conflicting historical values. Don't substitute an abstract architecture diagram or prose for the actual data shape. Reach agreement before implementing; an agreement already given in the current task counts, so don't ask for it again. The page layout is in the `diagram-page` skill. In the PR body the data shape appears only as concepts in the rule table and map; the full schema stays on the page and in the ADR.

### 15. Retired

File maps are retired; rule 18 replaced them. The number stays reserved.

### 16. Read with Read, Grep and Glob, not the shell

Shell commands go through auto mode's classifier, which pauses auto mode after 3 blocks in a row or 20 in a session, and that buries the user in prompts. Built-in reads inside the project skip it.

- Read files with `Read`, search contents with `Grep` and find files with `Glob`. Never use `cat`, `head`, `tail`, `ls`, `dir`, `type`, `find`, `grep`, `rg`, `awk`, `sed -n`, `Get-Content`, `Get-ChildItem` or `Select-String` for that, even when a system reminder says the shell is fine. Piping git, gh or npm output into them is fine.
- Use the shell only for what the tools can't do: git history, builds, tests, installs and `gh`, batched into as few commands as you can.
- This covers subagents and workflow stages too, so name rule 16 in their prompts.
- If auto mode starts prompting for everything, approve one harmless read to turn it back on.

### 17. Done means verified

Before saying a change is done, run the narrowest check that proves it (the spec files you touched, a typecheck, a build, or a screenshot of the screen) and show the output. If something couldn't be verified, say so. The proof goes in the chat report and the review ledger; a PR body keeps only one "Not verified by anyone" line.

### 18. PR descriptions lower the reviewer's load

Every PR body follows the `pr-description` skill: it leads with how the system works differently, in the project's domain words, and gives the reviewer what the diff cannot (the decisions made with their ADRs, where to look first, rollout risk, what nobody verified). Rebuild the body from scratch on every update; never append. Branch history goes in a PR comment, not the body. Before saving a body, a fresh Haiku subagent must read it cold and restate it correctly.
