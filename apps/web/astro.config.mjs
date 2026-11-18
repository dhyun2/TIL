import { defineConfig } from 'astro/config';
import localEditor from './src/editor/integration.mjs';

export default defineConfig({
  integrations: [localEditor],
  site: 'https://dhyun2.github.io',
  base: '/TIL',
  trailingSlash: 'always',
  vite: { ssr: { external: ['@til/journal'] }, build: { assetsInlineLimit: 0 } },
});
