import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseDocument, loadDocsGraph, validateDocs, generateIndexContent, updateIndexFile,
} from '../presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-workflow-'));
const now = new Date('2026-10-19T00:00:00Z');
function write(file, text) {
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}
function doc(file, id, type = 'spec', status = 'active', body = '', extra = '') {
  write(file, `---\nid: ${id}\ntitle: ${id}\ntype: ${type}\nstatus: ${status}\nsummary: ${id}の説明。\ncreated: 2026-10-19\nupdated: 2026-10-19\n${extra}---\n\n# ${id}\n\n${body}\n`);
}
function errors() { return validateDocs(loadDocsGraph(dir), { now }).errors; }
function run(...args) {
  const result = spawnSync(process.execPath, [cli, '--docs-dir', dir, ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}
try {
  doc('index.md', 'index', 'index', 'active', '手書きの目的別案内\n\n<!-- docs-index:start -->\n<!-- docs-index:end -->\n\n手書きの末尾');
  doc('specs/target.md', 'spec-target');
  doc('specs/日本語 file.md', 'spec-japanese');
  doc('specs/source.md', 'spec-source', 'spec', 'active', [
    '[対象](./target.md)', '[同じ対象](./target.md#example)',
    '[日本語](./%E6%97%A5%E6%9C%AC%E8%AA%9E%20file.md)', '[同じ日本語](<./日本語 file.md>)',
    '[既存](../legacy.md)', '[外部](https://example.com)',
    '`[コード](./missing-inline.md)`', '<!-- [コメント](./missing-comment.md) -->',
    '````md', '~~~', '[コード](./missing-code.md)', '```', '[コード](./still-missing.md)', '````',
  ].join('\n'), 'related: [spec-target, spec-target]\n');
  write('legacy.md', '# 取り込み前の文書\n');
  write('_config.json', JSON.stringify({ excludedFiles: ['legacy.md'] }));
  let graph = loadDocsGraph(dir);
  assert.equal(graph.documents.length, 4);
  assert.equal(graph.edges.filter((edge) => edge.sourceId === 'spec-source' && edge.targetId === 'spec-target').length, 2);
  assert.deepEqual(graph.byId.get('spec-target').backlinks, ['spec-source']);
  assert.deepEqual(graph.byId.get('spec-target').referenceBacklinks, ['spec-source']);
  assert.deepEqual(graph.byId.get('spec-japanese').backlinks, []);
  assert.deepEqual(graph.byId.get('spec-japanese').referenceBacklinks, ['spec-source']);
  assert.equal(errors().length, 0);

  doc('plans/archive/old.md', 'plan-old', 'plan', 'done');
  doc('adr/old.md', 'adr-0001', 'adr', 'superseded');
  doc('adr/new.md', 'adr-0002', 'adr', 'accepted', '', 'supersedes: adr-0001\n');
  doc('guides/draft.md', 'guide-draft', 'guide', 'draft');
  doc('notes/draft.md', 'note-draft', 'note', 'draft');
  doc('plans/next.md', 'plan-next', 'plan', 'active');
  doc('deprecated.md', 'spec-deprecated', 'spec', 'deprecated');
  write('_history.md', '# 手書きの履歴案内\n');
  assert.equal(updateIndexFile(dir), true);
  const index = fs.readFileSync(path.join(dir, 'index.md'), 'utf8');
  const history = fs.readFileSync(path.join(dir, '_history.md'), 'utf8');
  assert.ok(index.includes('手書きの目的別案内') && index.includes('手書きの末尾'));
  assert.ok(history.includes('手書きの履歴案内'));
  for (const id of ['plan-old', 'adr-0001', 'spec-deprecated']) {
    assert.ok(!index.includes(`[${id}]`));
    assert.ok(history.includes(`[${id}]`));
  }
  assert.ok(index.includes('[完了した計画・過去の文書](./_history.md)'));
  assert.ok(index.indexOf('[guide-draft]') > index.indexOf('## 下書き・未確認事項'));
  assert.ok(index.indexOf('[note-draft]') > index.indexOf('## 下書き・未確認事項'));
  assert.ok(index.indexOf('[plan-next]') > index.indexOf('## 進行中の変更案・作業計画'));
  assert.ok(!index.includes('## ガイド・手順書'));
  assert.equal(updateIndexFile(dir), false);
  assert.equal(errors().length, 0);

  const jsonRun = run('--json');
  assert.equal(jsonRun.status, 0, jsonRun.stderr);
  const json = JSON.parse(jsonRun.stdout);
  for (const key of ['valid', 'errors', 'warnings', 'documentCount', 'indexUpdated', 'documents']) assert.ok(key in json);
  assert.equal(json.formatVersion, 1);
  assert.ok(json.edges.some((edge) => edge.kind === 'supersedes'));
  assert.ok(json.documents.every((d) => Array.isArray(d.backlinks) && Array.isArray(d.supersededBy) && Array.isArray(d.referenceBacklinks)));
  assert.deepEqual(json.edges, loadDocsGraph(dir).edges);
  assert.equal(fs.readFileSync(path.join(dir, 'index.md'), 'utf8'), index, 'JSON-only reads must not mutate');
  assert.equal(typeof parseDocument, 'function');
  assert.equal(typeof generateIndexContent(loadDocsGraph(dir)), 'string');

  // Duplicate IDs cannot silently choose a target or source for any edge kind.
  doc('specs/duplicate.md', 'spec-target', 'spec', 'active', '[source](./source.md)');
  graph = loadDocsGraph(dir);
  assert.ok(errors().some((e) => e.code === 'DUPLICATE_ID'));
  assert.ok(graph.edges.every((e) => e.sourceId !== 'spec-target' && e.targetId !== 'spec-target'));
  assert.equal(updateIndexFile(dir), false);
  fs.unlinkSync(path.join(dir, 'specs/duplicate.md'));
  doc('invalid.md', 'spec-invalid', 'spec', 'active', '[missing](./missing.md)', 'related: [unknown]\n');
  assert.ok(errors().some((e) => e.code === 'BROKEN_RELATED_ID'));
  assert.ok(errors().some((e) => e.code === 'BROKEN_LINK'));
  fs.unlinkSync(path.join(dir, 'invalid.md'));

  // Invalid replacement target, self replacement and cycles.
  doc('adr/bad.md', 'adr-0003', 'adr', 'accepted', '', 'supersedes: spec-target\n');
  assert.ok(errors().some((e) => e.code === 'INVALID_SUPERSEDES'));
  doc('adr/bad.md', 'adr-0003', 'adr', 'superseded', '', 'supersedes: adr-0003\n');
  assert.ok(errors().some((e) => e.code === 'INVALID_SUPERSEDES'));
  doc('adr/bad.md', 'adr-0003', 'adr', 'superseded', '', 'supersedes: adr-0004\n');
  doc('adr/cycle.md', 'adr-0004', 'adr', 'superseded', '', 'supersedes: adr-0003\n');
  assert.ok(errors().some((e) => e.code === 'SUPERSEDES_CYCLE'));
  fs.unlinkSync(path.join(dir, 'adr/bad.md'));
  fs.unlinkSync(path.join(dir, 'adr/cycle.md'));
  doc('adr/proposal.md', 'adr-0003', 'adr', 'draft', '', 'supersedes: adr-0002\n');
  assert.ok(!validateDocs(loadDocsGraph(dir), { now }).warnings.some((w) => w.code === 'SUPERSEDED_STATUS_MISMATCH'), 'A draft proposal does not retire an accepted decision');
  fs.unlinkSync(path.join(dir, 'adr/proposal.md'));

  // Configuration must be explicit; malformed config must not hide unmanaged files.
  for (const config of ['{', '{"excludedFiles":"legacy.md"}', '{"unknown":[]}',
    ...['../outside.md', '/tmp/outside.md', '*.md', 'index.md', 'legacy', './legacy.md'].map((file) => JSON.stringify({ excludedFiles: [file] }))]) {
    write('_config.json', config);
    assert.ok(errors().some((e) => e.code === 'INVALID_CONFIG'));
    assert.equal(updateIndexFile(dir), false);
  }
  write('_config.json', JSON.stringify({ excludedFiles: ['legacy.md'] }));
  assert.equal(fs.readFileSync(path.join(dir, 'legacy.md'), 'utf8'), '# 取り込み前の文書\n');
  doc('legacy.md', 'note-legacy', 'note');
  write('_config.json', '{"excludedFiles":[]}');
  assert.equal(updateIndexFile(dir), true);
  assert.ok(loadDocsGraph(dir).byId.has('note-legacy'));
  assert.equal(errors().length, 0);

  // Bad markers produce structured errors, without partial edits.
  const beforeHistory = fs.readFileSync(path.join(dir, '_history.md'), 'utf8');
  write('index.md', fs.readFileSync(path.join(dir, 'index.md'), 'utf8').replace('<!-- docs-index:end -->', ''));
  const malformed = fs.readFileSync(path.join(dir, 'index.md'), 'utf8');
  const failed = run('--index', '--json');
  assert.equal(failed.status, 1);
  assert.ok(JSON.parse(failed.stdout).errors.some((e) => e.code === 'INDEX_UPDATE_FAILED'));
  assert.equal(fs.readFileSync(path.join(dir, 'index.md'), 'utf8'), malformed);
  assert.equal(fs.readFileSync(path.join(dir, '_history.md'), 'utf8'), beforeHistory);

  // Each template can be adopted independently without mandatory companion docs.
  const templatesDir = path.join(root, 'presets/solo/payload/docs/_templates');
  for (const file of fs.readdirSync(templatesDir)) {
    const isolated = path.join(dir, `template-${file}`);
    fs.mkdirSync(isolated);
    fs.copyFileSync(path.join(templatesDir, file), path.join(isolated, file));
    assert.equal(validateDocs(loadDocsGraph(isolated), { now }).valid, true, file);
  }

  // Readable example: follow the four entry routes and validate their relationships.
  const exampleDir = path.join(root, 'examples/auth-docs');
  const example = loadDocsGraph(exampleDir);
  assert.equal(validateDocs(example, { now }).valid, true);
  const entry = example.byId.get('index');
  for (const target of ['overview', 'spec-login', 'adr-0002', 'plan-login-limit']) {
    assert.ok(example.edges.some((e) => e.sourceId === entry.frontmatter.id && e.targetId === target && e.kind === 'references'));
  }
  assert.ok(example.edges.some((e) => e.sourceId === 'overview' && e.targetId === 'spec-login'));
  assert.ok(example.edges.some((e) => e.sourceId === 'spec-login' && e.targetId === 'adr-0002'));
  const exampleCopy = path.join(dir, 'example-copy');
  fs.cpSync(exampleDir, exampleCopy, { recursive: true });
  assert.equal(updateIndexFile(exampleCopy), false, 'Committed example indexes must be current');
  console.log('  [PASS] Typed graph, JSON compatibility, history, incremental adoption and reading routes verified.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
