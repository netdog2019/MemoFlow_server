import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { extname, resolve } from "path";
import { defineConfig, type Plugin } from "vite";

let devProxyServer = "http://localhost:8081";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

let devHost = "0.0.0.0";
if (process.env.DEV_HOST && process.env.DEV_HOST.length > 0) {
  console.log("Use devHost from environment: ", process.env.DEV_HOST);
  devHost = process.env.DEV_HOST;
}

const PDFJS_PUBLIC_BASE = "/pdfjs";
const PDFJS_RESOURCE_DIRS = ["cmaps", "iccs", "standard_fonts", "wasm"] as const;
const pdfjsDistDir = resolve(__dirname, "node_modules/pdfjs-dist");
const skipPdfjsResourceCopy = process.env.SKIP_PDFJS_RESOURCE_COPY === "1";

const getPdfjsContentType = (filePath: string): string => {
  switch (extname(filePath)) {
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".ttf":
      return "font/ttf";
    case ".pfb":
    case ".bcmap":
    case ".icc":
      return "application/octet-stream";
    case ".txt":
    case "":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
};

const resolvePdfjsResourcePath = (requestUrl: string): string | undefined => {
  const [requestPath] = requestUrl.split(/[?#]/, 1);
  const relativePath = requestPath.replace(/^\/?(pdfjs\/)?/, "").replace(/^\/+/, "");
  const [resourceDirectory, ...segments] = relativePath.split("/").filter(Boolean);
  if (
    !resourceDirectory ||
    segments.length === 0 ||
    !PDFJS_RESOURCE_DIRS.includes(resourceDirectory as (typeof PDFJS_RESOURCE_DIRS)[number])
  ) {
    return undefined;
  }

  const resourceRoot = resolve(pdfjsDistDir, resourceDirectory);
  const filePath = resolve(resourceRoot, ...segments);
  if (filePath !== resourceRoot && !filePath.startsWith(`${resourceRoot}/`)) {
    return undefined;
  }
  return filePath;
};

const copyPdfjsResources = (targetRootDir: string) => {
  for (const resourceDirectory of PDFJS_RESOURCE_DIRS) {
    copyDirectorySync(resolve(pdfjsDistDir, resourceDirectory), resolve(targetRootDir, resourceDirectory));
  }
};

const copyDirectorySync = (sourceDirectory: string, targetDirectory: string) => {
  mkdirSync(targetDirectory, { recursive: true });
  for (const entryName of readdirSync(sourceDirectory)) {
    const sourcePath = resolve(sourceDirectory, entryName);
    const targetPath = resolve(targetDirectory, entryName);
    if (statSync(sourcePath).isDirectory()) {
      copyDirectorySync(sourcePath, targetPath);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
};

const pdfjsResourcePlugin = (): Plugin => {
  let buildOutDir = "";

  return {
    name: "memos-pdfjs-resource-plugin",
    configResolved(config) {
      buildOutDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(PDFJS_PUBLIC_BASE, (request, response, next) => {
        const filePath = resolvePdfjsResourcePath(request.url ?? "/");
        if (!filePath) {
          next();
          return;
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          response.statusCode = 404;
          response.end("Not Found");
          return;
        }

        response.setHeader("Content-Type", getPdfjsContentType(filePath));
        response.setHeader("Cache-Control", "no-store");
        createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      if (!buildOutDir || skipPdfjsResourceCopy) {
        return;
      }
      copyPdfjsResources(resolve(buildOutDir, PDFJS_PUBLIC_BASE.slice(1)));
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsResourcePlugin()],
  server: {
    host: devHost,
    port: 3001,
    proxy: {
      "^/api/v1/sse": {
        target: devProxyServer,
        xfwd: true,
        // SSE requires no response buffering and longer timeout.
        timeout: 0,
      },
      "^/api": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/memos.api.v1": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/file": {
        target: devProxyServer,
        xfwd: true,
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
  build: {
    rollupOptions: {
      maxParallelFileOps: 64,
      output: {
        manualChunks: {
          "utils-vendor": ["dayjs", "lodash-es"],
          "mermaid-vendor": ["mermaid"],
          "leaflet-vendor": ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
