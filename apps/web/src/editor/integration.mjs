import { fileURLToPath } from 'node:url';

export default {
  name: 'local-note-editor',
  hooks: {
    'astro:config:setup'({ command, injectRoute }) {
      if (command !== 'dev') return;
      for (const [pattern, file] of [['/write', 'Write.astro'], ['/write/api', 'api.js']]) {
        injectRoute({ pattern, entrypoint: fileURLToPath(new URL(file, import.meta.url)) });
      }
    },
  },
};
