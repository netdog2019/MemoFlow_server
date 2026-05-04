# PDF Preview Notes

This document captures the current PDF preview implementation, the problems already encountered, and the recommended next optimization path for this repository.

## Scope

Relevant files today:

- `web/src/components/PreviewDocumentDialog.tsx`
- `web/src/utils/pdfjs.ts`
- `web/src/utils/pdf-thumbnail.ts`
- `web/vite.config.mts`
- `server/router/fileserver/fileserver.go`
- `server/router/api/v1/attachment_service.go`

## Current state

### Frontend reader

The app uses an in-app `pdf.js` reader for PDF attachments.

Important behavior:

- Uses `pdfjs-dist/legacy`
- Serves `pdf.js` resource directories from `/pdfjs/*`
- Loads PDF data with `fetch -> getDocument({ data })`
- Disables `isImageDecoderSupported` and `isOffscreenCanvasSupported`
- Uses a fast-preview-first rendering strategy:
  - render current page quickly at reduced scale
  - upgrade current page to full quality later
  - delay sidebar thumbnail rendering until the main reading area is visible

### Attachment PDF thumbnail

PDF attachment list thumbnails are currently generated in the browser:

- render the first page
- output a square thumbnail
- cache in memory + `sessionStorage`

This fixed earlier OCR/scanned-PDF white-thumbnail failures, but it is still client-side work.

### Existing server thumbnail infrastructure

The backend already has image thumbnail caching:

- `server/router/fileserver/fileserver.go`
- `.thumbnail_cache`

That existing infrastructure is the best future landing point for PDF first-page cover thumbnails.

## Problems already observed

### 1. OCR / scanned PDFs rendered blank

Root causes that were already fixed:

- missing `pdf.js` support assets (`cmaps`, `iccs`, `standard_fonts`, `wasm`)
- unstable `getDocument({ url })` behavior on large OCR/image-heavy PDFs

Current stable direction:

- serve `/pdfjs/*` correctly
- prefer `fetch -> getDocument({ data })`

### 2. PDF thumbnails turned white

This happened when the client-side thumbnail pipeline used more aggressive pixel-scanning/cropping heuristics.

Current stable direction:

- simple first-page render
- simple square thumbnail output
- bump thumbnail cache version after renderer changes

### 3. OCR PDFs still feel slow to open

Even after the above fixes, OCR/scanned PDFs remain expensive because:

- file size is large
- `pdf.js` parsing is heavy
- image/JBIG2/JPX/ICC decoding is heavy
- the browser still has to render canvases

So optimization must separate:

- **cover/thumbnail speed**
- **actual interactive reader speed**

These are related, but not the same problem.

## Recommended optimization strategy

## A. Highest-value next step: server-side first-page thumbnail prebuild

### What to do

When a PDF is uploaded:

- save the attachment as usual
- asynchronously generate a first-page cover thumbnail
- store it in a cache path similar to existing thumbnail behavior

For old PDFs:

- run a background backfill job
- detect PDFs missing a cover thumbnail
- generate them during idle/low-priority work

### Why this is the best next step

This improves:

- attachment list speed
- memo attachment card speed
- perceived PDF open speed

Because the UI can show a ready-made cover image immediately, before the full reader finishes parsing/rendering.

### Why this is better than more browser pre-rendering

Browser-only pre-rendering:

- costs user CPU every time
- consumes memory in each tab
- scales badly for large OCR files
- is unreliable across sessions

Server-side prebuild:

- happens once
- is reusable for every client
- is much better for repeated access

## B. Save lightweight PDF metadata

If server-side PDF preprocessing is added, the best metadata to persist is:

- `pageCount`
- `firstPageWidth`
- `firstPageHeight`
- first-page thumbnail path / cache key

### Why this helps

The frontend can:

- build page skeletons faster
- size the scroll region faster
- size the left sidebar thumbnails faster
- reduce layout jump during open

## C. Use prebuilt cover as open-time placeholder

Once server-side first-page cover thumbnails exist:

- attachment list uses them directly
- PDF dialog can show the cover instantly while `pdf.js` initializes
- then switch to the real in-app PDF reader

This improves perceived speed without pretending the real reader is ready before it is.

## D. Backfill old PDFs in background

This is recommended.

### Good approach

- low-priority runner / maintenance task
- limit concurrency
- skip PDFs that already have a cover thumbnail
- retry failures separately

### Why this matters

Without backfill, only newly uploaded PDFs benefit.

With backfill, historical content becomes faster too.

## What not to do

## 1. Do not block uploads on PDF preprocessing

Upload should complete first.

Thumbnail and metadata generation should be:

- async
- retriable
- low-risk

Otherwise:

- upload latency increases
- failures become user-visible
- system coupling gets worse

## 2. Do not pre-render all PDF pages to images by default

This is not the preferred path for this app.

Reasons:

- too much storage
- too much CPU
- too much complexity
- poor fit for large OCR/scanned PDFs

This repo should stay with:

- real `pdf.js` reader for actual reading
- prebuilt first-page cover only for fast preview/thumbnail usage

## 3. Do not aggressively warm all PDFs in the browser

Browser-side idle prewarming is okay only in a narrow scope:

- recently opened PDFs
- currently visible PDF cards
- maybe nearby list items

Not okay:

- prefetching all historical PDFs
- background rendering many PDF pages in the client

That would waste bandwidth and memory.

## Suggested implementation order

Recommended order if this work is implemented later:

1. **Server-side PDF first-page thumbnail generation**
2. **Historical PDF backfill job**
3. **Frontend prefers server-side PDF cover thumbnail**
4. **Frontend uses cover thumbnail as PDF-open placeholder**
5. **Persist basic PDF metadata**
6. **Optional: small-scope browser idle prewarm for recently used PDFs only**

## Suggested backend landing points

### Upload path

Likely entry:

- `server/router/api/v1/attachment_service.go`

After attachment save:

- if `attachment.Type == "application/pdf"`
- enqueue async first-page cover generation
- optionally extract basic PDF metadata

### File serving / cache path

Likely entry:

- `server/router/fileserver/fileserver.go`

Reuse the existing thumbnail cache conventions if possible.

If adding a new PDF-specific cached cover path:

- keep naming predictable
- keep invalidation simple
- avoid mixing full reader assets with cover thumbnails

### Background backfill

Possible landing points:

- a new runner under `server/runner/`
- or a maintenance job integrated with existing background runner patterns

Requirements:

- low concurrency
- resumable
- safe to rerun

## Suggested frontend landing points

### Attachment cards / lists

Current PDF thumbnail entry:

- `web/src/utils/pdf-thumbnail.ts`

Future direction:

- prefer server-provided prebuilt cover thumbnail when available
- keep current client-side renderer only as fallback

### PDF dialog

Current reader:

- `web/src/components/PreviewDocumentDialog.tsx`

Future direction:

- show prebuilt cover thumbnail immediately
- then replace with live reader once `pdf.js` is ready

## Testing advice

Any future PDF optimization work should be tested on at least:

1. normal text PDF
2. image-heavy PDF
3. OCR/scanned PDF
4. large PDF

And verify separately:

- attachment list thumbnail
- PDF dialog open time
- first interactive page render
- left sidebar page thumbnails

## Current practical conclusion

The most worthwhile next optimization is:

- **server-side first-page PDF thumbnail prebuild**
- plus **background backfill for historical PDFs**

This gives the best speed/complexity tradeoff for this repository.
