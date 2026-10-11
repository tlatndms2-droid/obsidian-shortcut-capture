import { build } from 'esbuild';
await build({entryPoints: ['src/main.ts'], bundle: true, outfile: 'main.js',
  format: 'cjs', target: 'es2020', platform: 'browser', sourcemap: 'inline',
  external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view']});
