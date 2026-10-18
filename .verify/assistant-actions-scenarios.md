# Assistant action cards — Task 3 verification

Date: 2026-10-19 (Asia/Shanghai)

## Automated checks actually run

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` in `Mu-mirror-F` | Passed; Vite transformed 200 modules and produced the production bundle. | Local command output, 2026-10-19. |
| `./mvnw.cmd '-Dtest=ChatLoopTest,ActionProposalServiceTest' test` in `Mu-mirror-B` | Passed; 39 tests, 0 failures/errors/skips. | Local command output, 2026-10-19. |
| `./.venv/Scripts/python.exe -m pytest tests/test_plan_next_step.py -q` in `Mu-mirror-AI` | Passed; 48 tests. | Local command output, 2026-10-19. |
| Proto generation in `Mu-mirror-AI` | Passed; generated Python stubs and `upload/generated` mirror synchronized. | `generate_proto.py` output, 2026-10-19. |

## Browser scenarios

No authenticated product session or running F+B+AI application stack was available. I used the local browser runner with a temporary, synthetic API fixture and a local Vite dev server to exercise the UI recovery path. This is a controlled replay of the shipped frontend, not authenticated backend acceptance.

| Scenario | Result | What remains to verify in a live authenticated app |
| --- | --- | --- |
| Restore a persisted proposal in Chat | Passed in controlled browser replay: one assistant card rendered for the proposal's user turn; no duplicate card appeared. | Confirm against a real session response and authenticated SSE. |
| Confirm after simulated lost response | Passed in controlled browser replay: the fixture changed the proposal to `SUCCEEDED` and created one synthetic todo, then returned HTTP 500. The client fetched the proposal, rendered `已完成`, and issued `/todos` refresh; fixture state showed one todo and one todo refresh. | Verify the actual Java commit/response-loss race and todo page after a real backend reload. |
| Create todo → edit due date → confirm → todo visible → reload | Partial: confirmation/recovery was exercised from a persisted pending proposal. Due-date editing and an authenticated todo page/reload were not run. | Verify edited due date persistence, actual todo list display, and reload using the product stack. |
| Cancel leaves todo list unchanged | Not run. | Verify persisted action state is `CANCELLED` and no todo row is created. |
| Two clients confirm one card | Not run in browser. | Verify only one todo is created under concurrent authenticated HTTP requests; server-side Task 1/2 tests are recorded in their reports. |
| Leave Chat and return while SSE is active | Not run. | Verify the Pinia-owned stream continues and the proposal card/history is restored. |
| Sources and file references remain available; intent/tool/reasoning traces hidden | Build-only. | Check source links/file previews and confirm those internal traces do not render in the browser. |

The replay used synthetic session/action/todo data, Chromium 155, a temporary local Vite server, and a temporary API fixture. No product backend, database, migration, push, or deployment was involved. Task 1/2 disposable database evidence is in their B-side reports; Task 3 itself added no database changes.
