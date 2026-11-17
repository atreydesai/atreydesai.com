import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import pluginYaml from "@rollup/plugin-yaml";
import yaml from "js-yaml";
import { dataToEsm } from "@rollup/pluginutils";
import { execSync } from "child_process";
import type { UserConfig } from "vite";

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
          frontmatter = yaml.load(match[1].trim()) as any;
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
      adapter: adapter({ runtime: 'nodejs26.x' }),
      // Inline CSS chunks under ~64 KB (uncompressed) directly into the HTML
      // response to eliminate render-blocking stylesheet requests on the
      // critical path. The threshold is uncompressed bytes; Tailwind output
      // gzips ~4x, so 64 KB here covers chunks that PSI reports as ~15 KiB.
      inlineStyleThreshold: 65536
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
