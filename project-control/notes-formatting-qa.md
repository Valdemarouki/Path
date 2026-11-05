# PAT-14: native Notes formatting regression

## Finding and focused fix

Baseline: `1da26a30911d30f0094784f03f3d56bc579ed92a`, also local
`paperclip-test`. The assigned PAT-13 execution branch is retained. The task's
explicit branch/remote exception applies; no remote operations were performed.

Reproduced in headless Chromium 156.0.8078.4 on Linux/WSL, with Playwright
1.64.1. All fixtures are synthetic. Browser requests are intercepted; the test
process also ran in a Bubblewrap network namespace with no external network,
no owner home mount, a temporary profile, and a cleared environment. Node's
runtime directory alone was mounted read-only from the host. Browser libraries
were extracted under `/tmp/pat14-tools`, without installing system packages.

Exact initial state: saved note body `Hello world`, editor DOM
`<p>Hello world</p>`, editor focused, collapsed caret at text offset 5, Bold off.
Click the Bold toolbar SVG twice, then type `X`:

| Step | Before fix | After fix |
| --- | --- | --- |
| First Bold click | DOM unchanged, pending Bold true | Same, as expected at a caret |
| Second Bold click | DOM unchanged, pending Bold **still true** | Pending Bold false |
| Type X | `<p>Hello<b>X</b> world</p>` | `<p>HelloX world</p>` |
| Autosaved Markdown | `Hello**X** world` | `HelloX world` |

The same failure occurs with keyboard Ctrl+B/Ctrl+I, Italic, and empty notes.
This is not toolbar selection loss: the pointerdown guard retains focus and
caret. Instrumenting `pathNoteRichRestore()` after the first Bold click gave
`queryCommandState('bold')` values `[true, true, false]`: before restore, after
`focus()`, and after `removeAllRanges()/addRange()` respectively. Replacing the
live range discards Chromium's pending typing style. Thus each subsequent
command enables the style again instead of toggling it off.

`notes-rich.js` now returns the existing focused editor when its current range
is still inside it. It retains the previous recovery path when focus or
selection has left. Native commands and the recovery path remain in use. Storage, history, and
export formats are unchanged.

Selected-text Bold already worked: select offsets 0–5 in `Hello world`, click
Bold → `<p><b>Hello</b> world</p>` / `**Hello** world`; click again → plain text.
Heading also applied immediately on the baseline: with that selection or a
caret at offset 5, click Heading → `<h2>Hello world</h2>` / `## Hello world`;
click again → paragraph / `Hello world`. In an empty note, Heading produced
`<h2><br></h2>` / `## ` immediately; typing fills the heading. A further multi-paragraph check exposed a separate Heading serialization defect:
start with `First\nSecond` (`<p>First</p><p>Second</p>`), select both paragraphs,
and click Heading. Chromium immediately produces `<h2>First<br>Second</h2>`,
but the old serializer saves `## First\nSecond`. Reopening renders the second
line as a paragraph. The regression failed with that actual body versus the
expected `## First\n## Second` before the serialization fix. Heading serialization
now prefixes each BR-separated line; reopening produces two H2 blocks, and a
repeated Heading action returns both to paragraphs. A focused jsdom serializer
fixture covers the same DOM shape without claiming native command coverage.

The reopen check exposed a related toggle failure: selecting both separate H2
blocks yields `queryCommandValue('formatBlock') === ''` in Chromium. The old
command handler consequently reapplies H2 instead of toggling to paragraphs.
`pathNoteRichHeadingSelected()` inspects the selected fragment for an all-H2
selection when issuing Heading; mixed H2/paragraph selections still apply H2.
The native regression failed with `## First\n## Second` instead of `First\nSecond`
before this guard, then passed with it. No browser command is mocked.

## Repeatable native test

In an isolated test environment with access to the package registry/download
host during setup only, prepare the existing jsdom checks as documented in
`QA_CHECKLIST.md`:

```bash
npm ci --prefix project-control/i18n-tools --include=dev --ignore-scripts --no-audit --no-fund
```

Install the optional native runner into a disposable directory, not the
application's dependencies:

```bash
notes_test_runtime=$(mktemp -d)
npm install --prefix "$notes_test_runtime" playwright@1.64.1 --ignore-scripts --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH="$notes_test_runtime/browsers" node "$notes_test_runtime/node_modules/playwright/cli.js" install chromium
```

Chromium needs its usual Linux runtime libraries. This run lacked `libnspr4`,
`libnss3`, and `libasound2t64`; their Ubuntu packages were downloaded and unpacked
with `dpkg-deb -x` into the disposable runtime, with `LD_LIBRARY_PATH` set there.
No Path installation, real account, production service, or owner browser
profile is needed. After setup, disable external networking and run:

```bash
python3 build.py
NODE_PATH="$notes_test_runtime/node_modules" PLAYWRIGHT_BROWSERS_PATH="$notes_test_runtime/browsers" node project-control/check-notes-native.cjs
```

For the current workspace the disposable runtime is `/tmp/pat14-tools`; the
actual offline command was:

```bash
/tmp/pat14-tools/sandbox env NODE_PATH=/tools/node_modules node project-control/check-notes-native.cjs
```

The runner loads the full rebuilt app at an intercepted `https://path.test/`
origin, aborts other requests, uses a fresh browser context, and never replaces
`execCommand`. Its first regression assertion failed on the original source:
`bold: second caret click must disable pending style` (`true !== false`).
The separate Heading regression failed before its serializer fix as described
above. All three regressions pass with the final change.

Coverage: selected text and collapsed carets; empty and nonempty notes; real
pointer clicks on SVG icons; keyboard Bold/Italic; typing with style enabled
and disabled; Heading DOM and computed size, repeated toggles, multiple
paragraphs, empty heading, Enter, Undo/Redo and reopen; focus recovery;
switching notes without stale selection; autosave to actual checkpoint storage
and browser reload; List, Quote, Code, Checklist; exact legacy Markdown and
metadata preservation on open/close and title save/reopen; read-only Trash.

## Validation results

The following commands ran through `/tmp/pat14-tools/sandbox`, which disables
networking. All passed:

- `python3 build.py`
- `node project-control/check-notes-native.cjs` (with `NODE_PATH=/tools/node_modules`)
- `node project-control/check-notes-lifecycle.cjs`
- `node project-control/check-notes-rich.cjs` — jsdom/mocked commands; separate from native evidence
- `node project-control/check-storage.cjs`
- `node project-control/check-media-storage.cjs`
- `node desktop/prepare.cjs`
- `node desktop/check.cjs`

Local `git merge-base --is-ancestor paperclip-test HEAD` and `git diff --check`
also passed. Generated HTML/module copies are not part of the commit.

Setup initially failed because the sandbox could not resolve the host's WSL
DNS symlink; binding its resolver target fixed setup. One later mock-suite
attempt found jsdom absent after the original failed npm process cleaned up;
reinstalling after that process exited resolved it. Final checks above passed.

NOT TESTED: Windows/Electron native launch, macOS/Meta shortcuts, Firefox,
WebKit, touch/IME, installed-app update flows. Headless Chromium evidence does
not establish those platform results. Existing Markdown limitations such as
representing explicitly normal-weight text inside a heading are unchanged.
Path QA must independently review the committed SHA and decide the native
review stage; Developer does not approve this work.
