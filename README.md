<div align="center">
    <h1><b>Docmost-db</b></h1>
    <p>
        A fork of <a href="https://github.com/docmost/docmost"><strong>Docmost</strong></a> that adds Notion-style <b>database</b> features.
        <br />
        <a href="./README.ko.md">한국어</a>
    </p>
</div>
<br />

> [!NOTE]
> **This is a fork.**
> Built on top of [`docmost/docmost`](https://github.com/docmost/docmost), it aims to bring Notion-style database views (Table / Board) and row filtering, sorting, and bulk editing into wiki pages.
> For original Docmost usage and self-hosting, see the [official docs](https://docmost.com/docs). The [upstream README](#upstream-docmost) below is preserved as-is.

## What this fork adds

A lightweight database that can be embedded in wiki pages, built incrementally:

- **Database / Table view** — persistence, multiple views, view switcher, column visibility & width
- **Board (Kanban) view** — grouping by Select/Status columns, card drag & drop
- **Row filter / sort** — server-side filter & sort API + a filter/sort builder toolbar
- **Row multi-select** — gutter checkboxes for multi-select & bulk delete

> ⚠️ Experimental, work in progress. Not recommended for production use.
>
> Inspired by an [issue](https://github.com/docmost/docmost/issues/78)

## What does it look like

**Page embeded preview**
<img width="1647" height="1312" alt="image" src="https://github.com/user-attachments/assets/85369aaf-a06c-4359-b261-0c9a681bd9df" />

**Board (Kanban) view** — columns grouped by the `Status` property, property tags on cards, per-column count + "+ New"; dragging a card to another column updates its status value.

<img width="1258" alt="Board (Kanban) view" src="https://github.com/user-attachments/assets/e63c0814-aea6-474e-a83f-127aa5fbc363" />

**Table view** — the default grid view (Title + Status columns); the same data toggles between Table and Board tabs.

<img width="1252" alt="Table view" src="https://github.com/user-attachments/assets/421b706c-aa00-48be-b27c-5f6fdfaafa61" />

**Filter / sort builder toolbar** — Filter & Sort buttons with active-count badges; per-type value widgets and drag-to-reorder sorts.

<img width="1266" alt="Filter / sort builder toolbar" src="https://github.com/user-attachments/assets/e4c665b8-6ca5-4a80-aeac-b811c48ddd68" />

## QA & bug reports

Bugs found while QA-ing this fork are tracked in the **[Docmost-db QA board](https://github.com/users/JunHCha/projects/3)**.

- Found a bug? Open one with the [🐞 QA Bug Report](https://github.com/JunHCha/docmost-db/issues/new?template=qa_bug_report.yml) template.
- New issues are labeled `bug` and `qa`, and their progress is tracked on the QA board.

## Quick start (development)

```bash
# Install dependencies (pnpm via corepack)
corepack enable
pnpm install

# Start dev Postgres/Redis
docker compose -f docker-compose.dev.yml up -d

# Run dev servers
pnpm dev
```

For upstream Docmost self-hosting and deployment, follow the [official docs](https://docmost.com/docs/self-hosting/development).

---

# Upstream (Docmost)

The section below preserves the README of the fork's upstream, [`docmost/docmost`](https://github.com/docmost/docmost).

<div align="center">
    <h1><b>Docmost</b></h1>
    <p>
        Open-source collaborative wiki and documentation software.
        <br />
        <a href="https://docmost.com"><strong>Website</strong></a> | 
        <a href="https://docmost.com/docs"><strong>Documentation</strong></a> |
        <a href="https://twitter.com/DocmostHQ"><strong>Twitter / X</strong></a>
    </p>
</div>
<br />

## Getting started

To get started with Docmost, please refer to our [documentation](https://docmost.com/docs) or try our [cloud version](https://docmost.com/pricing) .

## Features

- Real-time collaboration
- Diagrams (Draw.io, Excalidraw and Mermaid)
- Spaces
- Permissions management
- Groups
- Comments
- Page history
- Search
- File attachments
- Embeds (Airtable, Loom, Miro and more)
- Translations (10+ languages)

### Screenshots

<p align="center">
<img alt="home" src="https://docmost.com/screenshots/home.png" width="70%">
<img alt="editor" src="https://docmost.com/screenshots/editor.png" width="70%">
</p>

### License
Docmost core is licensed under the open-source AGPL 3.0 license.  
Enterprise features are available under an enterprise license (Enterprise Edition).  

All files in the following directories are licensed under the Docmost Enterprise license defined in `packages/ee/License`.
  - apps/server/src/ee
  - apps/client/src/ee
  - packages/ee

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development)

## Thanks
Special thanks to;

<img width="100" alt="Crowdin" src="https://github.com/user-attachments/assets/a6c3d352-e41b-448d-b6cd-3fbca3109f07" />

[Crowdin](https://crowdin.com/) for providing access to their localization platform.


<img width="48" alt="Algolia-mark-square-white" src="https://github.com/user-attachments/assets/6ccad04a-9589-4965-b6a1-d5cb1f4f9e94" />

[Algolia](https://www.algolia.com/) for providing full-text search to the docs.

