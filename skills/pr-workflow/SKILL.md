---
name: pr-workflow
description: The path from finished work to shared PR links, in order. It covers splitting work into a stack, the survivable review and its ledger, the PR body, gh pr create, the file map and the status report (AGENTS.md rules 4, 5, 12, 15 and 6). Use when it is time to open, update, rebase or report PRs.
---

# PR workflow

Feature PRs target the project's base branch: the one its `AGENTS.md` or `.agents/guard.json` (`baseBranch`) names, otherwise the repo's default branch. Work through these steps in order. The kit's hooks (`~/agent-kit/hooks/guard.js`) enforce step 4 where the project turns on its review gate, and remind you of steps 5 and 6.

## 1. Split into a stack (rule 4)

- While developing, features may share a branch. At PR time, cut one branch and one PR per feature.
- Base the bottom PR on `origin/<base branch>` and each PR above on the one below it. Put shared or foundational changes lowest.
- A feature that spans repos gets a matching stack in each, and each PR names its counterpart.
- Carried fixes are allowed in any PR. The description lists each one: what it changes and why it is included. Don't split or block a PR only because it carries more than one area.
- Read every changed file and record its purpose. That per-file table feeds both the review ledger and the file map. Undocumented changes need disclosure, not automatically another PR.
- Keep dependencies, validation and security explicit. Fix real behaviour, security and build failures before publishing.
- GitHub native stacks: a PR inside a stack can't change base through the API (422). Use the REST Stacks API instead. `POST /repos/{o}/{r}/stacks/{n}/unstack` dissolves a stack and keeps its PRs open. `POST /repos/{o}/{r}/stacks` with `pull_requests[]` (bottom → top) creates one. A stack is linear, so side PRs can't join it.

## 2. Review each PR against its parent (rule 5)

- Run the `survivable-code-review` skill on each PR against its parent, bottom-up.
- The ledger `docs/reviews/<branch, with / as ->.md` is committed in that PR.
- A PR goes up only with **APPROVED** or **APPROVED WITH NOTES**. Never use the original thermo-nuclear review: it has no exit and loops.

## 3. Write the body

- the carried-fixes list (step 1)
- the Mermaid diagrams: before → after, end shape and stack map (`diagram-page` skill)
- the counterpart PR for cross-repo work
- the attribution line the session gives you

## 4. Open

`gh pr create`. Where the project's review gate is on, the hook asks the user first if the branch's committed ledger doesn't end on APPROVED.

## 5. File map (rule 15)

Run the `pr-file-map` skill right after opening, and again after any push that changes the diff. The same comment and link update in place.

## 6. Report (rule 6)

Before sharing any link, read the PR's current state with `ccd_pr` `get_status` or `gh pr view <n> --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,baseRefName`. Report the link with its state, base, CI (passing, failing or pending), mergeability and the file map link. For a stack, report every PR in it.

## After a lower PR changes

Rebase the PRs above it, re-run review delta passes where conflict resolutions changed code, and rebuild their file maps.
