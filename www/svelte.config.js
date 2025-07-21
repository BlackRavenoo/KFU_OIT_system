import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build_tmp',
      assets: 'build_tmp',
      fallback: 'index.html'
    }),
    prerender: {
      handleMissingId: 'ignore'
    }
  }
};

export default config;