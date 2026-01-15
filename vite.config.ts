import { sveltekit } from "@sveltejs/kit/vite";
import { imagetools } from "vite-imagetools";
import pluginYaml from "@rollup/plugin-yaml";
import yaml from "js-yaml";
import { dataToEsm } from "@rollup/pluginutils";
import type { UserConfig } from "vite";

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
  plugins: [sveltekit(), imagetools(), pluginYaml() as any, markdown()],
};

export default config;
