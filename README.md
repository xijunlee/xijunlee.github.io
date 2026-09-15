# Xijun Li academic homepage — design sample

A static bilingual academic and recruiting homepage with separate Chinese and English versions and full archives in both languages.
The existing personal site is preserved in `source/original.html`; the original checkout is unchanged.

## Preview and build

```sh
npm run build
npm run dev
```

The local preview runs at http://127.0.0.1:4317. Open `/index.html` for Chinese or `/en.html` for English. `dist/` is standalone static output and can also be opened directly from the filesystem or hosted on GitHub Pages.

## Content and metrics

- Original information and links are preserved in the full archives: `archive-zh.html` in Chinese and `archive.html` in English.
- All 38 publication entries and 11 preprint/technical-report entries are available in the homepage's searchable publication list.
- CCF classifications use the official seventh edition (2026) PDF, linked in `data.json` and the homepage.
- Initial counts from the supplied publication list: A 23, B 4, C 4. All author positions are included. The SIGMOD 2021 storage-system paper is temporarily excluded from A pending verification of its paper type. Workshops, competition reports and degree theses are separate. Conference/journal and preprint versions remain accessible but are not added twice to the CCF totals.
- Source profile lists 21 patent entries. This is not an assertion that all 21 are granted or legally active; one uses an internal-looking reference, and legal status/families have not been independently checked.
- Grants: 5 PI projects/funding entries and 1 core-participant national project.
- Spotlight: 2 papers as explicitly marked in the original publication list.
- The metrics strip shows publication, CCF A, patent and project counts. Google Scholar remains available as a profile link without a citation metric.
- Journal years 2026, 2025 and 2024 for the three TPAMI entries are based on source News/context. Other missing years are left blank.

## Editing

- `src/index.html`: Chinese homepage structure and copy.
- `src/en.html`: English homepage structure and copy.
- `src/styles.css`: responsive styles.
- `src/app.js`: navigation and publication search/category filters.
- `build.py`: original-content extraction, CCF mapping and static build validation.
- `source/original.html`: original English content and links.

Institution marks are bundled locally from the official SJTU visual identity package, the official USTC emblem download, and the Huawei website header asset. They appear only in the factual education and work history strip.

No backend, external JavaScript, tracking, or framework dependencies are required. Portrait is bundled locally from the image referenced by the supplied homepage.
