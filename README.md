# notion-sync-desktop

Electron desktop wrapper for the `notion-sync` CLI.

It provides a local control panel for:
- `doctor`
- `status`
- `report`
- `dry-run`
- `run`
- `remote`
- `open`

## Start

```bash
cd notion-sync-desktop
npm install
npm start
```

## Requirements

- `notion-sync` available in `PATH`
  or set `NOTION_SYNC_CLI_PATH`
- optional `NOTION_SYNC_WORKDIR` if you want the app to run the CLI from a specific directory

## Notes

- This app is a local wrapper, not a cloud service.
- It does not upload anything by itself; it delegates actions to the `notion-sync` CLI.
- The current design assumes the CLI is already configured and working.
