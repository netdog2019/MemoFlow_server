# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Self-hosted note-taking tool. Go 1.26 backend (Echo v5, Connect RPC + gRPC-Gateway), React 18 + TypeScript 6 + Vite 7 frontend, Protocol Buffers API, SQLite/MySQL/PostgreSQL.

## Commands

```bash
# Backend
go run ./cmd/memos --port 8081    # Start dev server
go test ./...                      # Run all tests
go test -v ./store/...             # Run store tests (all 3 DB drivers via TestContainers)
go test -v -race ./server/...      # Run server tests with race detection
go test -v -race ./internal/...    # Run internal package tests with race detection
go test -v -run TestFoo ./pkg/...  # Run a single test
go mod tidy -go=1.26.1             # Match CI tidy check
golangci-lint run                  # Lint (v2, config: .golangci.yaml)
golangci-lint run --fix            # Auto-fix lint issues (includes goimports)

# Frontend (cd web)
pnpm install                       # Install deps
pnpm dev                           # Dev server (:3001, proxies API to :8081)
pnpm lint                          # Type check + Biome lint
pnpm lint:fix                      # Auto-fix lint issues
pnpm format                        # Format code
pnpm build                         # Production build
pnpm release                       # Build to server/router/frontend/dist

# Protocol Buffers (cd proto)
buf generate                       # Regenerate Go + TypeScript + OpenAPI
buf lint                           # Lint proto files
buf format -w                      # Format proto files
```

## Architecture

```
cmd/memos/main.go           # Cobra CLI + Viper config, server init

server/
├── server.go               # Echo v5 HTTP server, background runners
├── auth/                   # JWT access (15min) + refresh (30d) tokens, PAT
├── router/
│   ├── api/v1/             # 8 gRPC services (Connect + Gateway)
│   │   ├── acl_config.go   # Public endpoints whitelist
│   │   ├── sse_hub.go      # Server-Sent Events (live updates)
│   │   └── mcp/            # MCP server for AI assistants
│   ├── frontend/           # SPA static file serving
│   ├── fileserver/         # Native HTTP file server (thumbnails, range requests)
│   └── rss/                # RSS feeds
└── runner/                 # Background: memo payload processing, S3 presign refresh

store/
├── driver.go               # Database driver interface
├── store.go                # Store wrapper + in-memory cache (TTL 10min, max 1000)
├── migrator.go             # Migration logic (LATEST.sql for fresh, incremental for upgrades)
└── db/{sqlite,mysql,postgres}/  # Driver implementations

proto/
├── api/v1/                 # Service definitions
├── store/                  # Internal storage messages
└── gen/                    # Generated Go, TypeScript, OpenAPI

internal/                   # app-private packages: scheduler, cron, email, filter (CEL),
                            # webhook, markdown (Goldmark), httpgetter, idp (OAuth2), storage/s3

web/src/
├── connect.ts              # Connect RPC client + auth interceptor + token refresh
├── auth-state.ts           # Token storage (localStorage + BroadcastChannel cross-tab)
├── contexts/               # AuthContext, InstanceContext, ViewContext, MemoFilterContext
├── hooks/                  # React Query hooks (useMemoQueries, useUserQueries, etc.)
├── lib/query-client.ts     # React Query v5 (staleTime: 30s, gcTime: 5min)
├── router/index.tsx        # Route definitions
├── components/             # UI components (Radix UI primitives, MemoEditor, Settings, etc.)
├── themes/                 # CSS themes (default, dark, paper) — OKLch color tokens
└── pages/                  # Page components
```

## Conventions

### Go
- **Errors:** `errors.Wrap(err, "context")` from `github.com/pkg/errors`. Never `fmt.Errorf` (lint-enforced via forbidigo).
- **gRPC errors:** `status.Errorf(codes.X, "message")` from service methods.
- **Imports:** stdlib, then third-party, then local (`github.com/usememos/memos`). Enforced by goimports (runs as golangci-lint formatter).
- **Comments:** All exported functions must have doc comments (godot enforced).

### Frontend
- **Imports:** Use `@/` alias for absolute imports.
- **Formatting:** Biome — 140 char lines, double quotes, always semicolons, 2-space indent.
- **State:** Server data via React Query hooks (`hooks/`). Client state via React Context (`contexts/`).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`), `cn()` utility (clsx + tailwind-merge), CVA for variants.
- **PDF preview:** In-app PDF preview lives mainly in `web/src/components/PreviewDocumentDialog.tsx`, `web/src/utils/pdfjs.ts`, and `web/src/utils/pdf-thumbnail.ts`.
  - Use `pdfjs-dist/legacy` build, not the non-legacy entry, for browser compatibility.
  - Keep frontend dev on `:3001` only; PDF debugging/verification should target the Chrome/Vite path on port `3001`.
  - `pdf.js` resource directories (`cmaps`, `iccs`, `standard_fonts`, `wasm`) must be served at `/pdfjs/*` by Vite (`web/vite.config.mts`). OCR/scanned PDFs and image-heavy PDFs may render blank if these resources are missing.
  - Prefer `fetch -> getDocument({ data })` over `getDocument({ url })` in this app. For large OCR PDFs, URL-loading repeatedly hung during document load, while data-loading was stable.
  - Keep `isImageDecoderSupported: false` and `isOffscreenCanvasSupported: false` in current `pdf.js` options unless there is a verified reason to change them; Chrome-like environments produced unstable behavior on scanned/image-heavy PDFs otherwise.
  - If PDF thumbnails suddenly turn blank after renderer changes, bump the thumbnail cache version in `web/src/utils/pdf-thumbnail.ts`; stale sessionStorage thumbnails can mask fixes.
  - Avoid expensive pixel-scanning/cropping heuristics for PDF attachment thumbnails unless revalidated on OCR samples; they previously produced white thumbnails for scanned PDFs. Current approach is simple first-page render + square thumbnail output.
  - For perceived performance, preserve the current "fast preview first, full-quality second" strategy in `PreviewDocumentDialog.tsx`: render the current page quickly at reduced scale, then upgrade to full quality in the background, and delay sidebar thumbnail rendering until after the main page is visible.
  - If further optimization is needed, the highest-value next step is server-side PDF first-page thumbnail prebuild, not more aggressive browser-side pre-rendering. Generate a cover thumbnail on upload and backfill old PDFs during idle/background work.
  - Distinguish "thumbnail speed" from "real viewer speed": prebuilt cover thumbnails improve attachment lists and perceived open speed, but they do not replace `pdf.js` page parsing/rendering for the actual reader.
  - Prefer async/background PDF preprocessing over blocking uploads. Upload should succeed first; thumbnail extraction and metadata extraction should be retried separately if needed.
  - Do not pre-render all PDF pages to images by default. For this app, that would be too heavy in storage/CPU and is not the preferred optimization path.
  - If server-side PDF preprocessing is added later, the best metadata to persist is: page count, first-page width/height, and prebuilt first-page thumbnail path. See `docs/pdf-preview.md` for the detailed strategy.

### Database & Proto
- **DB changes:** Migration files for all 3 drivers + update `LATEST.sql`.
- **Proto changes:** Run `buf generate`. Generated code: `proto/gen/` and `web/src/types/proto/`.
- **Public endpoints:** Add to `server/router/api/v1/acl_config.go`.

## CI/CD

- **backend-tests.yml:** Go 1.26.1, `go mod tidy -go=1.26.1`, golangci-lint v2.11.3, tests parallelized by group (store, server, internal, other)
- **build-canary-image.yml:** Builds frontend with `pnpm release`, then publishes canary multi-arch container images for linux/amd64 and linux/arm64
- **frontend-tests.yml:** Node 24, pnpm 10, lint + build
- **proto-linter.yml:** buf lint + format check
- **release.yml:** On version tags, builds frontend once, packages binaries for Linux/macOS/Windows, and publishes release container images/tags
- **Docker:** Multi-stage (`scripts/Dockerfile`), Alpine 3.21, non-root user, port 5230, multi-arch (amd64/arm64/arm/v7)

## Local Packaging Notes

When packaging a Synology-testable image from this customized 0.27.1 tree:

- Build frontend first so assets are embedded into the Go binary:
  ```bash
  cd web
  PATH=/tmp/memos-node24/bin:$PATH corepack pnpm release
  ```
- Build the backend with the explicit 0.27.1 version and disable VCS stamping if `.git` is incomplete:
  ```bash
  GOCACHE=/tmp/memos-go-cache GOMODCACHE=/tmp/memos-go-mod \
    go build -buildvcs=false -trimpath \
    -ldflags="-s -w -X github.com/usememos/memos/internal/version.Version=0.27.1 -X github.com/usememos/memos/internal/version.Commit=backup-build -extldflags '-static'" \
    -tags netgo,osusergo \
    -o build/memos ./cmd/memos
  ```
- Verify the binary before packaging:
  ```bash
  ldd build/memos        # should report "not a dynamic executable"
  build/memos version    # should print 0.27.1
  ```
- Do not package database or attachment data. Runtime data belongs outside the image and must be mounted to `/var/opt/memos` on Synology.
- The image tag used for manual export is `memoflow:0.27.1`; container port is `5230`; data volume is `/var/opt/memos`.
- If Docker/Podman/Buildah are unavailable locally, a `docker load` compatible archive can be generated manually from a static rootfs layer. The archive must contain `manifest.json`, `repositories`, one config JSON, and one layer directory with `VERSION`, `json`, and `layer.tar`. Keep `/var/opt/memos` as an empty directory in the layer.
- Source backup archives should exclude `.git`, `.agents`, `.codex`, `.dev-data`, `.dev-cache`, `web/node_modules`, build outputs, root `memos`, database files, logs, and uploaded assets.
