# Xijun Li academic homepage — design sample

A static, Chinese-first academic and recruiting homepage, with an English full archive.
The existing personal site is preserved in `source/original.html`; the original checkout is unchanged.

## Preview and build

```sh
npm run build
npm run dev
```

The local preview runs at http://127.0.0.1:4317. `dist/` is standalone static output and can also be opened directly from the filesystem or hosted on GitHub Pages.

## Content and metrics

- All original visible text and distinct original links are preserved in `archive.html` and checked during the build.
- All 38 publication entries and 11 preprint/technical-report entries are available in the homepage's searchable publication list.
- CCF classifications use the official seventh edition (2026) PDF, linked in `data.json` and the homepage.
- Initial counts from the supplied publication list: A 23, B 4, C 4. All author positions are included. The SIGMOD 2021 storage-system paper is temporarily excluded from A pending verification of its paper type. Workshops, competition reports and degree theses are separate. Conference/journal and preprint versions remain accessible but are not added twice to the CCF totals.
- Source profile lists 21 patent entries. This is not an assertion that all 21 are granted or legally active; one uses an internal-looking reference, and legal status/families have not been independently checked.
- Grants: 5 PI projects/funding entries and 1 core-participant national project.
- Spotlight: 2 papers as explicitly marked in the original publication list.
- Google Scholar citations and h-index are unverified. No fabricated metric is displayed; the page links directly to the profile.
- Journal years 2026, 2025 and 2024 for the three TPAMI entries are based on source News/context. Other missing years are left blank.

## Editing

- `src/index.html`: homepage structure and curated Chinese copy.
- `src/styles.css`: responsive styles.
- `src/app.js`: navigation and publication search/category filters.
- `build.py`: original-content extraction, CCF mapping and static build validation.
- `source/original.html`: original English content and links.

No backend, external JavaScript, tracking, or framework dependencies are required. Portrait is bundled locally from the image referenced by the supplied homepage.
