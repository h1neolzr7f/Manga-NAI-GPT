# Manga-NAI-GPT 1.6 drift repair implementation plan

> Agentic workers: use subagent-driven-development for independent tasks and test-driven-development for each repair; root integrates and reviews the full branch.

Goal: repair reproducible drift and workflow defects and deliver a verified local package.

Architecture: retain Fabric, task launcher and local proxy. Repair pure image helpers and coordinate/layout handling; snapshot generation constraints instead of reading mutable UI state during each async call.

Tech stack: JavaScript/Fabric, Python stdlib/Pillow, Windows PowerShell, Node assertion tests.

Spec: ../specs/2026-10-12-drift-repair-design.md

## Global constraints
- No paid calls or credential disclosure. No new heavy model dependency.
- Do not alter original v1.6 archive or old installed editor. No remote publish.
- Regression tests first; run project suite after integration; retain reviewable candidates.

## Review focus
- Unusable masks must protect far background and bystanders.
- Local intended brightness and line geometry changes must remain visible.
- Layout/scroll changes must not corrupt selection coordinates or move the view.
- First panel, pronouns and subsequent pages must retain character constraints.
- Async completion/cancellation must not overwrite a different page or configuration.

## Task 1 — GPT region image helpers and stale selection bounds (worker gpt)
Files: js/ai/gpt-region-editor.js; scripts/gpt-drift-regression-test.cjs.
Interfaces: preserve existing helpers, optionally export a small pure quality check through MangaGPTRegionEditor for AutoSwap; root integrates its use.
- [x] Add failing pixel tests for intentional brightness and fine line geometry, plus live bounds mapping.
- [x] Repair tone consensus magnitude and change-mask geometry detection, preserving resampling tolerance.
- [x] Add conservative candidate geometry/context review, retain explicit review/override UX instead of claiming semantic identity.
- [x] Run focused tests and document limitations.

## Task 2 — Stable view and text focus (worker ui)
Files: css and js/ui/visual-studio.js, js/canvas-manager.js, js/core/util/fabric-text-focus.js; focused tests.
Interfaces: reserve stable toolbar footprint or compensate its layout without moving image objects; no edits to gpt-region-editor.js.
- [x] Reproduce selection tool-strip movement in a regression test; cover nested scroll text focus where possible.
- [x] Repair layout/view movement and applicable focus fallback; handle narrow screens.
- [x] Run focused tests; root repeats real UI measurement.

## Task 3 — Character/page generation consistency (worker continuity)
Files: js/ui/task-launcher.js, js/ai/character-library.js, js/ai/nai-engine-core.js; focused tests.
Interfaces: await role-library readiness and snapshot characters/style/seed once; preserve existing card and payload schemas.
- [x] Add failing tests for empty cache/pronouns/name-free follow-up, implicit conflicting left/right positions, positive/negative style collision, first-run engine setup.
- [x] Repair character state, avoid forced coordinates unless explicit; persist reusable page seed policy; do not pretend NAI supports image references if unsupported.
- [x] Inspect and repair nearby stale configuration, page/export flows in owned files.
- [x] Run focused tests.

## Task 4 — Swap protection, portable commands and version (root)
Files: js/ai/auto-swap.js, package.json, index.html, docs/CHANGELOG.
- [x] Add failing background-mask and uniform-outfit tests.
- [x] Limit mask fallback to target silhouette and controlled extension; unify first/batch policy and snapshot edit settings.
- [x] Integrate quality review for swap candidates if helper is ready; preserve all pixels outside permitted area.
- [x] Repair python3 portability and version labels; add new test commands without overwriting workers' tests.

## Task 5 — Integration, wider review and deliverable (root + fresh reviewer)
- [x] Run full Node suite, portability, relevant Python checks and lint; investigate new failures.
- [x] Review changed branch plus nearby untested async/crop/export cases; fix actionable additional defects with tests.
- [x] Run real browser view/import/edit/export checks; report download channel limits separately from product failures.
- [x] Commit local changes, create clean ZIP/source and patch in outputs, update case state and final report.
