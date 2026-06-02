import * as esbuild from 'esbuild';
import { readdirSync } from 'fs';

const lambdaDirs = readdirSync('./lambdas', { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== 'shared')
  .map(d => d.name);

await Promise.all(
  lambdaDirs.map(name =>
    esbuild.build({
      entryPoints: [`lambdas/${name}/handler.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      outfile: `dist/${name}/handler.mjs`,
      external: [],
      treeShaking: true,
      minify: true,
    })
  )
);

console.log('Build complete:', lambdaDirs.join(', '));
