---
name: pr-file-map
description: Build and publish the interactive file map every PR needs (AGENTS.md rule 15). It covers every created, changed, deleted and moved file, with what changed and why, riders flagged, a treemap and an aligned before/after folder table. It is published as a download on the repo's pr-maps pre-release and linked from one PR comment. Use it right after opening a PR, after any push that changes a PR's diff, or when asked for a PR's file map.
---

# PR file map

Every PR gets one, every layer of a stack included. The tools are in `~/agent-kit/tools/pr-maps/`. They run from the **workspace folder**: the folder that holds the repo checkout as `<workspace>/<repo name>`.

What each part writes, all inside the workspace and never in the kit:

- **State:** `diagrams/_gen/pr-maps/`, which holds `prs/<repo>-<pr>/` (notes), `ledger.json` and `backups/`.
- **Maps:** `diagrams/pr-maps/<repo>/pr-<pr>-file-map.html`.

## When

- Run it right after `gh pr create`, once rule 5's review has passed. The comment needs the PR number.
- Run it again after any push that changes the PR's diff, such as a rebase or a review fix. The same comment and the same download link update in place.
- Before reporting the PR to the user (rule 6), so the report carries the map link.

## Steps

`<repo>` is the PR's `owner/name`. `T=~/agent-kit/tools/pr-maps`.

1. **List the files:** `node $T/build.js <repo> <pr> --prep`. This fetches the PR's base and head and writes `diagrams/_gen/pr-maps/prs/<name>-<pr>/status.tsv` plus `chunk-N.tsv`: one chunk for 40 files or fewer, otherwise about 60 files per chunk.
2. **Annotate every file.** This is the same per-file reading as `pr-workflow` step 1 and the review ledger, so do it once and use it twice.
   - **40 files or fewer:** write the notes yourself.
   - **More than 40:** run one `general-purpose` subagent per chunk, in parallel, in the background, with the prompt below. Check them every 5 minutes (rule 11).
   - Notes go in `prs/<name>-<pr>/*.why.json`, as one array or several; the build merges them. Each entry looks like this:
     `{ "path", "from" (renames only), "status": "A|M|D|R", "what" (≤20 words), "why" (≤35 words), "theme", "replacedBy" (deletions only: the file that took over its job, or null), "key": true (only on the ~10% that matter most) }`
   - Write `prs/<name>-<pr>/themes.json` with 4–9 themes for this PR's feature, as `{ "key": ["Label", "#hex", "One-line blurb"] }`. Pick colours that stay readable on light and dark backgrounds.
   - Four themes always exist: `rider`, `no-op`, `tooling` and `other`. A rider is a file or hunk that doesn't serve the feature in the PR's title and isn't a carried fix listed in the description (rule 4).
   - **Carried fixes** get one theme per fix listed in the description, so they show as disclosed areas, not riders.
   - Optionally, write `prs/<name>-<pr>/story.html`: an `<ol class="story">` with 4–7 points on why the folders changed, using real paths and real counts.
3. **Build:** `node $T/build.js <repo> <pr>`. The build refuses to finish if a file has no note, a note has no file, or a theme is unknown. It writes the map and `prs/<name>-<pr>/comment.md`.
4. **Check it in Chrome** at `http://127.0.0.1:8799/pr-maps/<name>/pr-<pr>-file-map.html`. If nothing serves it, start `node ~/agent-kit/tools/diagrams/serve.js diagrams` (the `diagrams` preview). Expect no console errors, and the map, trees and riders tile to look right.
5. **Riders need disclosure, not another PR.** If the map shows riders, list each one in the PR description as a carried fix (what it changes and why) and re-tag it with that fix's theme, or give a waiver reason in its `why`. Their presence alone doesn't block the PR.
6. **Publish:** run `node $T/publish.js <repo> <pr> --dry-run`, read what it would do, then run it without `--dry-run`.
   - The first run in a repo creates the `pr-maps` pre-release. Its tag goes on the project's `baseBranch` (from `.agents/guard.json`), or the repo's default branch. It refuses if any workflow on that branch fires on tags or releases.
   - Every outside change goes into `ledger.json`.
7. **Report:** the PR link with its state (rule 6) plus the map's download link, `https://github.com/<repo>/releases/download/pr-maps/pr-<pr>-file-map.html`.

## Undo

- `node $T/teardown.js --dry-run` (from the workspace folder) lists what it would undo. `node $T/teardown.js` undoes everything, newest first:
  - edited comments get their exact original text back, and it checks they match;
  - comments it posted are deleted;
  - map files are removed;
  - the release and its tag are deleted.
- Never edit `ledger.json` or `backups/` by hand. They are the only record of what changed in GitHub.

## Never

- **No GitHub Pages:** a Pages site from a private repo can be public, depending on the plan.
- **No public Artifact link.**
- **No browser upload of attachments:** the permission classifier blocks it, and `gh` has no API for comment attachments. The release asset replaces both.

## Subagent prompt (one per chunk)

> You are annotating every file in one chunk of a GitHub PR so a human can see what changed and why. READ-ONLY on the repo. Repo: `<abs path to <workspace>/<name>>`. PR: `<repo>#<pr>` "<title>". Base `B=<base sha>`, head `H=<head sha>` (from `--prep`'s output). Never checkout, switch, stash, reset, restore or commit, and never edit the repo; other agents have uncommitted changes there. Read only from git objects: `git -C <repo> diff -M B H -- <path>`, `git show H:<path>`, `git show B:<path>`, `git log --format='%h %s' B..H -- <path>`. Run no tests or builds. The PR's feature is: <one paragraph from the PR body>. Annotate EVERY line of `<chunk tsv>` (git name-status: A, M, D, Rnnn old→new). Write a JSON array to `<prs dir>/chunk-N.why.json` with one object per file: path (path at H; for deletions the deleted path), from (renames only), status (A/M/D/R), what (≤20 words), why (≤35 words, tied to the feature), theme (one of: <keys from themes.json>, rider, no-op, tooling, other), replacedBy (deletions only, or null), key (true only for the ~10% that matter most). A file that doesn't serve the feature and isn't a listed carried fix is `rider`: trace it with `git log` to the commit that brought it in, and name that commit in the why. Never guess; read the code at H when a diff is unclear. Check that the file parses and that its length equals the chunk's line count. Final message: the count written and any file you were unsure about.
