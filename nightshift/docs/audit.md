# Original script audit

Inputs reviewed: install-codex-browser-agent.ps1, install-codex-browser-agent_old.ps1, uninstall-codex-browser-agent.ps1.

| Original behavior | Replacement |
|---|---|
| Both installers use official standalone installer; changing that URL offers no speed improvement | Same official standalone installer, pinned upstream source bundled; session-local CODEX_HOME and CODEX_INSTALL_DIR |
| NoUpdate still invokes uv tool install --upgrade | No browser-use install or global upgrade; pinned npm ci only |
| browser-use skill nonzero reported as installed/green | Optional browser-use not shipped; no unsupported success claim |
| Dashboard timeout only writes failure state | Solver deadline terminates its child; Codex installer timeout kills the exact owned process; no detached install lanes |
| Every winget failure retried, final retry sleeps | No winget dependency or blanket retry |
| Upgrade/uninstall exit codes ignored | Every invoked native setup command checks its exit status |
| Playwright mode still installs Python, uv, PS7, Terminal, git and rg | Node + Playwright only; existing Edge preferred |
| Configured Python 3.13 plus browser-use Python 3.12 | No Python requirement for runtime |
| MCP status detected by substring | No MCP required; typed model/account metadata via JSON-RPC |
| Concurrent lanes overwrite shared state directory | Unique session directories; sequential dependency setup; install mutex; mission launch waits for setup owner to exit |
| Broad recursive deletion of user project and pre-existing tools | Validated random session root, explicit ownership records, hash-checked package deletion, preserved unknown/modified files |
| Fake progress and decorative delays | State transitions and actual command outcomes only |
| Assumes auth file means account ready | CLI login status and account/read email check; explicit confirmation if metadata lacks email |
| “No traces left” claim | No forensic erasure claim; Windows history/security logs untouched |

No legacy installer/uninstaller is executed by this package. The old global installations, if any, are not adopted or removed.
