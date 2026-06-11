import { sveltekit } from "@sveltejs/kit/vite";
import pluginYaml from "@rollup/plugin-yaml";
import yaml from "js-yaml";
import { dataToEsm } from "@rollup/pluginutils";
import { execSync } from "child_process";
import type { UserConfig } from "vite";

// Get the last commit date from git
let gitDate: string;
try {
  gitDate = execSync("git log -1 --format=%cI").toString().trim();
} catch {
  gitDate = new Date().toISOString();
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
          // Find --- at the start of a line (after the opening ---)
          const match = src.slice(3).match(/^([\s\S]*?)\r?\n---\r?\n/);
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
  plugins: [sveltekit(), pluginYaml() as any, markdown()],
  define: {
    __BUILD_DATE__: JSON.stringify(gitDate),
  },
};

export default config;
