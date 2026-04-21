import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs20.x'
    }),
    // Inline CSS chunks under ~64 KB (uncompressed) directly into the HTML
    // response to eliminate render-blocking stylesheet requests on the
    // critical path. The threshold is uncompressed bytes; Tailwind output
    // gzips ~4x, so 64 KB here covers chunks that PSI reports as ~15 KiB.
    inlineStyleThreshold: 65536,
  },
};
export default config;
