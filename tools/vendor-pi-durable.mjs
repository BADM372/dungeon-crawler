// Builds vendor/pi-durable/pi-durable.js: one browser ES module with the parts of Pi the guide's
// tutor uses (learn/tutor/): the durable agent harness (@earendil-works/pi-durable), model access
// (@earendil-works/pi-ai: Radius, Anthropic, OpenAI and the scripted "faux" provider for tests) and Chord
// contexts. The game has no build step, so like three.js the bundle is checked in.
//
//   node tools/vendor-pi-durable.mjs ~/Development/pi-mono
//
// Needs a Pi checkout with its dependencies installed (npm install there); its esbuild is used.
// Everything is bundled from the packages' TypeScript sources, not their dist/.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor/pi-durable/pi-durable.js');
const pi = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(join(pi, 'packages/durable/package.json'))) {
  console.error('usage: node tools/vendor-pi-durable.mjs <pi checkout>');
  process.exit(1);
}
const esbuild = await import(pathToFileURL(createRequire(join(pi, 'package.json')).resolve('esbuild')));
const pkg = name => JSON.parse(readFileSync(join(pi, 'packages', name, 'package.json'), 'utf8'));
const git = (...args) => { try { return execFileSync('git', ['-C', pi, ...args], { encoding: 'utf8' }).trim(); } catch { return '?'; } };

// What the tutor imports. Keep it to what learn/tutor/ and tests/tutor.test.js use.
const ENTRY = `
export { BACKGROUND_CONTEXT, withCancel } from '@earendil-works/chord/context';
export { Type, createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
export { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
export { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
export { radiusProvider } from '@earendil-works/pi-ai/providers/radius';
export { AgentDoc, AssistantEntry, Harness, LiveDoc, MemoryStorage, createRegistry, defineDoc, defineExtension, defineTool, section } from '@earendil-works/pi-durable';
export { JsonlStorage } from '@earendil-works/pi-durable/storage/jsonl';
export { FileError, ok, err } from '@earendil-works/pi-durable/env';
`;

// pi-ai's package exports point at dist/ only; send its imports to the sources like the others'
const piAiSource = {
  name: 'pi-ai-source',
  setup(build) {
    build.onResolve({ filter: /^@earendil-works\/pi-ai(\/.*)?$/ }, args => {
      const sub = args.path.slice('@earendil-works/pi-ai'.length).replace(/^\//, '');
      return { path: join(pi, 'packages/ai/src', (sub || 'index') + '.ts') };
    });
  },
};

const versions = ['durable', 'ai', 'chord'].map(p => `${pkg(p).name}@${pkg(p).version}`).join(', ');
const dirty = git('status', '--porcelain', '--', 'packages/durable/src', 'packages/ai/src', 'packages/chord/src') ? ' with local changes' : '';
const banner = `// Pi (https://github.com/earendil-works/pi), MIT licensed: ${versions}.
// Built from ${git('rev-parse', '--short', 'HEAD')} (${git('log', '-1', '--format=%cs')})${dirty} by tools/vendor-pi-durable.mjs; do not edit.`;

mkdirSync(dirname(OUT), { recursive: true });
const result = await esbuild.build({
  stdin: { contents: ENTRY, resolveDir: pi, loader: 'js' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  conditions: ['source'],
  nodePaths: [join(pi, 'node_modules')],
  plugins: [piAiSource],
  minify: true,
  legalComments: 'none',
  banner: { js: banner },
  outfile: OUT,
  metafile: true,
  logLevel: 'warning',
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`wrote ${OUT.slice(ROOT.length + 1)} (${(bytes / 1024).toFixed(0)} KiB): ${versions}`);
writeFileSync(join(dirname(OUT), 'VERSION'), banner.replace(/^\/\/ /gm, '') + '\n');
copyFileSync(join(pi, 'LICENSE'), join(dirname(OUT), 'LICENSE'));
