# Photo Library Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build-time discovery turns each photo album directory into validated site content, while homepage memory uses an explicit JSON sequence.

**Architecture:** A Node script is the sole filesystem owner: it scans `public/media/photos`, validates directory names and `meta.json`, and writes a generated JSON module consumed by the existing synchronous content module. Content keeps runtime validation; `albums` receives validated memory items instead of deriving them from album media.

**Tech Stack:** Node 24, TypeScript, tsx, Vite, Vitest, React 19.

## Global Constraints

- No backend, database, runtime directory enumeration, new package, thumbnail, or theme-UI sharing.
- Album directory: `YYYY-MM-SequenceNN-相册名`; newest first globally.
- Album image ordering: `topNN.*` numeric ascending, then natural filename ascending.
- `meta.json` contains photo metadata only; `home-memory.json` owns homepage order.

---

### Task 1: Generate and validate directory index

**Files:** Create `scripts/generate-photo-index.ts`, `scripts/generate-photo-index.test.ts`; modify `package.json`, `scripts/validate-content.ts`, `scripts/validate-content.test.ts`.

**Interfaces:** Produce `generatePhotoIndex(photosDir, outputPath): Promise<SiteContent>` and generated `src/content/generated-photo-index.json`.

- [ ] Write tests for valid directory discovery, malformed directory names, unmatched meta keys, `topNN` ordering, and natural ordering.
- [ ] Run `npm test -- --run scripts/generate-photo-index.test.ts`; expect failures before implementation.
- [ ] Implement `generatePhotoIndex`: list only directories matching `/^(\\d{4})-(\\d{2})-Sequence(\\d{2})-(.+)$/`, reject unsupported entries, collect `.jpg/.jpeg/.png/.webp`, validate `meta.json` keys, and serialize deterministic generated content.
- [ ] Run the focused tests and `npm run validate:content`; expect pass.

### Task 2: Replace content and memory contracts

**Files:** Modify `src/content/index.ts`, `model.ts`, `validate.ts`, `content.test.ts`, `module.md`; modify `src/albums/home-memory.ts`, `home-memory.test.ts`, `module.md`; modify both `src/themes/*/ThemePages.tsx`.

**Interfaces:** `content` imports generated content; export `homeMemoryItems`. `createHomeMemory(items: HomeMemoryItem[]): HomeMemory` preserves supplied order.

- [ ] Add tests proving media order is preserved and explicit memory preserves JSON order without a 12-item limit.
- [ ] Run affected Vitest files; expect old derivation tests to fail.
- [ ] Remove thumbnail fields and date sorting, validate generated schema and memory photo fields, pass explicit memory data through app/theme contracts, and replace thumbnail fallbacks with source images.
- [ ] Run content, albums, and theme tests; expect pass.

### Task 3: Migrate fixtures and wire commands

**Files:** Create three `public/media/photos/*/meta.json` files and `home-memory.json`; move six example images; delete `src/content/albums.json` and six `public/media/thumbs/*.webp`; modify `package.json`, `README.md`.

- [ ] Rename/move the six existing example images into the three confirmed album directories, using `top01.jpg` where priority is desired.
- [ ] Write `meta.json` entries for every image and explicit `home-memory.json` entries; run `npm run generate:photo-index`.
- [ ] Make `dev`, `validate:content`, and `build` generate first; document the new add-photo workflow and remove thumbnail command documentation.
- [ ] Run `npm run validate:content`; expect three albums and six photos.

### Task 4: Verify and synchronize baselines

**Files:** Modify `docs/requirements.md`, `docs/architecture.md`, `README.md`, `docs/changes/photo-library-layout/{change.json,tasks.md,verification.md}`.

- [ ] Update requirements, architecture, and module docs to describe generated directory content, explicit memory, and ordering.
- [ ] Run `npm run check`, `npm run build`, and targeted or complete `npm run test:e2e`; record exact results and environment in `verification.md`.
- [ ] Update task checks and actual `change.json.verification`; only archive after all acceptance evidence is recorded.
