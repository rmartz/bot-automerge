import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/bot-automerge.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
