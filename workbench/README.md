# Workbench UI (served at /mobileplus/)

Built output of the illu SD Workbench UI. The extension serves this
folder at `/mobileplus/` (see `scripts/mobile-plus.py`); the actions
endpoint the UI calls (`/mobileplus/actions`) is not wired up yet.

**Sources live in the separate repository
`sd-webui-mobile-plus-workbench`** — do not edit these files directly.
Refresh them from that repository with:

```sh
bun run publish:extension   # builds, copies dist/ here, stamps VERSION
```

`VERSION` records which UI commit the build came from and when it was
published.
