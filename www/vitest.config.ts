import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    testTimeout: 60000,
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        // Конфигурационные файлы
        '**/*.config.{js,ts}',
        '**/*.conf.{js,ts}',
        '**/vite.config.{js,ts}',
        '**/vitest.config.{js,ts}',
        '**/svelte.config.{js,ts}',
        
        // Файлы типов и константы
        '**/*.d.ts',
        '**/types/**',

        // Сборка и прочие служебные файлы
        'build/**',
        'dist/**',
        'coverage/**',
        '**/.svelte-kit/**',
        
        '**/stores.ts',
        '**/routes.ts',

        'tests/**.{js,ts}',
        'src/**/**/*.svelte',
        'src/**/+page.ts',
        '**/+layout.{js,ts}',
        '**/**/service-worker.js',
      ],
      excludeNodeModules: true,
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
      '$routes': path.resolve('./src/routes'),
      '$app': path.resolve('./node_modules/@sveltejs/kit/src/runtime/app')
    }
  }
});