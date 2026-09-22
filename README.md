# Filament Ledger

A local-first filament inventory tracker. Records stay in this browser's
`localStorage`; no account or server is required.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Use **Export backup** regularly. Importing a backup validates the file and
replaces the current inventory after confirmation. Clearing browser site data
removes records that have not been exported.
