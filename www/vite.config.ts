import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import htmlMinifier from 'vite-plugin-html-minifier-terser';

export default defineConfig({
  plugins: [
    sveltekit(),
    htmlMinifier({
      minify: true,
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: true,
      useShortDoctype: true
    })
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      format: {
        comments: false
      }
    },
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  optimizeDeps: { exclude: ['fsevents'], },
});