// Copies the Nunjucks views (src/views/**/*.njk) next to the compiled output (dist/views).
import { cpSync } from 'node:fs';

cpSync('src/views', 'dist/views', {
  recursive: true,
  filter: (src) => !src.endsWith('.ts'),
});
