---
name: diagram-page
description: Build, serve and keep current the rule 12 HTML page with inline-SVG diagrams, and redraw it as Mermaid for PR descriptions. Also the side-by-side schema page that rule 14 requires. Use before medium or large work, cross-repo changes, PR stacks, schema or ownership changes, and whenever a plan changes.
---

# Diagram page (AGENTS.md rules 12 and 14)

Every change is diagrammed so it can be checked and agreed on before code. Typo-level edits (copy, a constant, a rename) are exempt. A small change needs one diagram, shown in chat and in the PR. Grilling, medium or large work, cross-repo changes and PR stacks get a full page.

## Build

- Pages live in the project's `diagrams/<topic>.html` (or wherever its `AGENTS.md` says), outside the product repos when the project has several. New pages get a generator in `diagrams/_gen/<topic>/`; the generator folder and page names needn't match. When a page has a generator, regenerate it rather than hand-editing the HTML; older pages without one are edited by hand.
- Use the kit's library:

  ```js
  const kit = require('os').homedir() + '/agent-kit/tools/diagrams';
  const { esc, box, edge, text, svg, seq } = require(`${kit}/lib`);
  const { page } = require(`${kit}/page`);
  // box(x, y, w, h, title, kind, sub) with kind = be | fe | db | q | ext | add | rm | chg | note
  // edge(points, label, kind) with kind = n | add | rm | chg; seq(participants, steps, opts) for sequences
  fs.writeFileSync('diagrams/<topic>.html', page({ title, lede, body }));
  ```

  `page()` supplies the CSS (light and dark), the arrow markers and the `.tbl`, `.warn`, `nav` and `figure` styles.
- Diagrams are inline SVG drawn from the real code paths, with file and function names. No generic boxes and no external libraries.
- Draw what fits the change:
  - **System flow:** request path, client → server → database, queues and third-party calls
  - **Functions:** the branches, early returns, loops and error paths, before → after
  - **Mappings:** source field → target field with transforms, defaults and dropped fields (integration, DTO and payload mappers). Highlight changed rows. A table is fine.
  - **Components:** the tree with props, state and events, and the hooks or services each one calls
  - **State:** a state machine for statuses and lifecycles
  - **End shape:** data model, states, screens
  - **Stacks:** the PR order and what each PR carries

## Schema changes (rule 14)

Before changing stored data, relationships or which record owns a value, put the current and proposed schema side by side on the page.

- Use real collection and field names, clearly labelled fake example records, and reference arrows.
- Mark fields added, removed, moved, or no longer authoritative.
- Say which record is the source of truth, what each write changes, and how existing records and completed history are preserved.
- Include the migration and conflict handling. Never silently discard conflicting historical values.
- Separate stored fields from derived API values.

Show a readable schema in chat too. Don't substitute an abstract architecture diagram or prose for the actual data shape. Get agreement before implementing; an agreement already given in the current task counts, so don't ask for it again.

## View

- Serve the folder with `node ~/agent-kit/tools/diagrams/serve.js diagrams` (127.0.0.1:8799), ideally as a `diagrams` entry in the project's `.claude/launch.json` started with `preview_start`, and open `http://127.0.0.1:8799/<topic>.html`.
- Never open `file://`. The browser pane renders it blank past the first screen, and Claude in Chrome can't open it at all.
- Publish a page as a private Artifact only when others will see it.

## Keep it current

- When the plan changes, update the page before the code, so the user agrees to the picture first.
- One set of diagrams, current state only. Fold a later fix into the existing after-diagram rather than adding a new before → after pair; its "before" never shipped.
- A PR's "before" is its base branch, and its "after" is the branch as it is now. Delete proposed or history sections and plan banners once the work is done.

## PR descriptions

GitHub strips HTML and inline SVG but renders Mermaid. Redraw the page's diagrams as Mermaid blocks in every PR body:

- the before → after for every flow, function, mapping or component the PR changes
- the end shape
- for stacks, where this PR sits and what it carries, plus the stack map
- for mappings, a Markdown table when it reads better

Each PR in a stack carries only its own slice. A PR without its diagrams isn't ready to open.

GitHub Mermaid quirks:

- `<id>` in sequence diagrams is stripped as HTML; write `{id}`.
- A cross-subgraph edge in a TB stack map stacks the subgraphs vertically; drop it and put the note in the node label.
- `before ~~~ after` puts two subgraphs side by side.
- Diagrams render in sandboxed, lazy-loaded iframes: check them by screenshot, and reload if one is blank. Parse-check each block with mermaid@11 in the browser pane first.
