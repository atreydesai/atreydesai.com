import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import pluginYaml from "@rollup/plugin-yaml";
import { load } from "js-yaml";
import { dataToEsm } from "@rollup/pluginutils";
import { execSync } from "child_process";
import type { UserConfig } from "vite";
import { withStaticRoutes } from "./src/lib/server/static-routes.js";

// Get the last commit date from git
let gitDate: string;
let cvDate: string;
try {
  gitDate = execSync("git log -1 --format=%cI").toString().trim();
  cvDate =
    execSync("git log -1 --format=%cI -- static/atreydesai_cv.pdf").toString().trim() ||
    gitDate;
} catch {
  gitDate = new Date().toISOString();
  cvDate = gitDate;
}

// Reported once per build (see prerender.handleMissingId below).
let footnoteWarned = false;

/** A custom Markdown plugin for Vite, with YAML frontmatter support. */
function markdown() {
  return {
    name: "markdown",

    transform(src: string, id: string) {
      if (/\.md$/.test(id)) {
        let frontmatter = {};
        let content = src;
        if (src.startsWith("---")) {
          // Find --- at the start of a line (after the opening ---).
          // The closing --- may sit at end-of-file with no trailing newline.
          const match = src
            .slice(3)
            .match(/^([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/);
          if (!match) {
            throw new Error(`Unclosed YAML frontmatter in ${id}`);
          }
          // js-yaml 5 throws on empty input, where 4 returned undefined.
          const fm = match[1].trim();
          frontmatter = fm ? (load(fm) as any) : {};
          content = src.slice(3 + match[0].length).trim();
        }
        return {
          code: dataToEsm({ ...frontmatter, content }),
          map: null,
        };
      }
    },
  };
}

const config: UserConfig = {
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      // Pages are prerendered; the wrapper adds the route table that serves
      // their Markdown twins and headers (src/lib/server/static-routes.js).
      adapter: withStaticRoutes(adapter({ runtime: 'nodejs26.x' })),
      // Inline CSS chunks under ~96 KB (uncompressed) directly into the HTML
      // response to eliminate render-blocking stylesheet requests on the
      // critical path. The threshold is uncompressed bytes; Tailwind output
      // gzips ~4x, so 96 KB here covers chunks that PSI reports as ~22 KiB.
      // At 64 KB the paper launch page's own CSS (81 KB) was a separate
      // render-blocking request, and the site layout's (65.2 KB) sat 300
      // bytes under the line. tests/render-blocking.test.mjs holds it.
      inlineStyleThreshold: 98304,
      // The site's own origin while prerendering, so `url.origin` and the
      // absolute links the pages print (canonical, the Markdown alternate)
      // are its own: the crawler follows those to build every page's twin.
      paths: { origin: "https://atreydesai.com" },
      prerender: {
        // Broken links fail the build, with one known exception that is
        // reported on every build until it is fixed: the paper launch page's
        // Paper and Thread buttons still point at placeholders (#PAPER_URL,
        // #THREAD_URL in src/lib/who-wrote-this/content.json).
        // Its footnote links (#fn-…) also point at ids the footnote list
        // only renders in the browser, so they dangle in the static HTML.
        handleMissingId: ({ path, id, message }) => {
          if (path === "/blog/who-wrote-this/" && /^[A-Z]+_URL$/.test(id)) {
            console.warn(`⚠️  Placeholder link #${id} on ${path}: replace it in src/lib/who-wrote-this/content.json`);
            return;
          }
          if (path === "/blog/who-wrote-this/" && id.startsWith("fn-")) {
            if (!footnoteWarned) {
              footnoteWarned = true;
              console.warn(`⚠️  Footnote links on ${path} point at ids rendered only in the browser`);
            }
            return;
          }
          throw new Error(message);
        },
      },
    }),
    pluginYaml() as any,
    markdown()
  ],
  define: {
    __BUILD_DATE__: JSON.stringify(gitDate),
    __CV_DATE__: JSON.stringify(cvDate),
  },
};

export default config;
