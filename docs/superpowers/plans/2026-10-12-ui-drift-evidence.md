# UI drift repair evidence

Task 2, local branch codex/fix-drift-v1.6. No paid API calls or credential reads.

## Changes

- Tool options retain a 44 px footprint across selection and tool changes. The row scrolls horizontally rather than adding rows; its hint keeps a 180 px minimum. The row is keyboard focusable and controls retain their native keyboard behavior.
- Text focus fallback now restores every textarea ancestor scroll position as well as the document, including unsupported focus options. Options are copied before adding preventScroll, so caller-owned frozen options remain usable.
- Additional sizing defect: the canvas view wrapper inherited a 400 px minimum height and flex shrinking. Explicit logical page dimensions now take precedence. Safe centering aligns an oversized view to its accessible beginning instead of hiding its left edge beyond negative scroll space.

## RED / GREEN

Actual browser at 1440 x 900 with restored 1000 x 1417 comic:

- RED at 130%: selecting image changed canvas top from 153.6000 to 181.5125 (+27.9125 px); host height changed 716.4000 to 688.4875.
- GREEN at 160%: selected property strip hidden -> visible retained canvas top 163.6000, canvas height 1129.6000 and host height 706. Toolbar height 44.
- At 780 px screen width, keyboard reached naiObjectBiggerBtn. Row scrolled left 864 px; focused button bounds were x539..565.6 within row x56..604. Height remained 44.

Responsive layout fixture uses the real toolbar markup from index.html and production visual-studio.css:

| Toolbar width | RED top movement | GREEN top movement | GREEN height movement | GREEN scrollTop |
| --- | --- | --- | --- | --- |
| 1138 | 20.4 | 0 | 0 | 128 |
| 780 | 22.2 | 0 | 0 | 128 |
| 340 | 86 | 0 | 0 | 128 |

Actual fitCanvasViewToContainer source and production layout.css rendered in a browser fixture:

| Page / zoom | RED rendered dimensions | Expected / GREEN |
| --- | --- | --- |
| 1000 x 300 / 130%, host340x500 | 396.916 x 176.800 | 442 x 132.600 |
| 200 x 100 / 100%, host340x500 | 314.160 x 680 | 340 x 170 |

Both GREEN views retain an accessible left edge.

Nested focus test RED: document restored but outer scrollTop120 ->400 and textarea host240 ->700. GREEN: all six scroll coordinates retained for ignored options, unsupported options and frozen options.

## Verification and repeat commands

- `node scripts/fabric-text-focus-nested-test.cjs`: 3 cases PASS.
- `node scripts/fabric-text-focus-smoke-test.cjs`: PASS.
- `node scripts/import-image-keeps-page-test.cjs`: 9 checks PASS.
- `node scripts/manga-page-size-smoke-test.cjs`: PASS.
- `npx eslint js/ui/visual-studio.js js/canvas-manager.js js/core/util/fabric-text-focus.js --max-warnings 0`: exit0.
- Browser: open `/scripts/canvas-view-drift-test.html`, inspect JSON pass:true.
- `node scripts/canvas-fit-drift-fixture.cjs`, then browser open `/work/canvas-fit-drift-test.html`, inspect JSON pass:true. Generated fixture belongs to work and should not ship as user data.
- Full `npm test` ran through layout, privacy, editor regressions and GPT region tests, then exited1 at `scripts/gpt-panel-i18n-test.cjs:44`, `ja.mgpt_selection_replaced missing`. Concurrent GPT changes require the integrator's fresh full-suite run.

Browser screenshots saved outside the repository in workspace work/ui-evidence/canvas-fit-green.png and toolbar-footprint-green.png. Temporary viewport override was reset. Browser sessions are separate per agent; root integration should repeat the real app selection, scroll and import checks.

## Limits

Selection footprint, dimensions and native keyboard reachability were verified in Chromium. Nested text fallback uses controlled scroll/focus doubles to reproduce browsers that ignore preventScroll; browser-specific IME behavior remains unchanged by this repair. Full app integration and an independent final suite remain the root task's acceptance gate.
