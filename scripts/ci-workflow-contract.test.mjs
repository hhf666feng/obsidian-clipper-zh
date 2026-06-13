import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');
const workflow = readFileSync(workflowPath, 'utf8');

for (const expected of [
	'actions/checkout@v4',
	'actions/setup-node@v4',
	'cache: npm',
	'npm ci',
	'npm test',
	'npm run build',
	'npm run verify:release-package',
]) {
	assert.match(workflow, new RegExp(escapeRegExp(expected)), `missing CI step: ${expected}`);
}

assert.match(workflow, /node-version:\s*22/, 'CI must use the project Node version used by local verification');

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
