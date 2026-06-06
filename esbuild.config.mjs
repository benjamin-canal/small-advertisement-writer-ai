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
      // The bundled AWS SDK does dynamic require() of Node built-ins (e.g.
      // node:https). In an ESM bundle require() doesn't exist, so the Lambda
      // crashes at init with "Dynamic require of X is not supported". Recreate
      // require() from import.meta.url so those calls resolve at runtime.
      banner: {
        js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
      },
      treeShaking: true,
      minify: true,
    })
  )
);

console.log('Build complete:', lambdaDirs.join(', '));
