// Where the tests find exported assets. Same convention as tools/serve.py: in a git
// worktree assets/ comes from the main checkout; CRAWLER_ASSETS_ROOT overrides (CI).
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const repo = resolve(import.meta.dirname, '..');
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim();
// Checkout that holds assets/; game URLs ("assets/...") resolve against it.
export const assetsRoot = resolve(process.env.CRAWLER_ASSETS_ROOT || resolve(common, '..'));
export const assets = resolve(assetsRoot, 'assets');
