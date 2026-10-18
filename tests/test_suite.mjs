import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFrontmatterYaml,
  parseDocument,
  loadDocsGraph,
  validateDocs,
  updateIndexFile,
} from '../presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. manifest.yaml と SKILL.md の整合性検証
// ---------------------------------------------------------------------------
{
  const manifestPath = path.join(repoRoot, 'presets/solo/manifest.yaml');
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const srcMatches = [...manifestText.matchAll(/^\s*-\s*src:\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.ok(srcMatches.length >= 15, 'manifest.yaml should list payload files');
  const version = manifestText.match(/^version: (.+)$/m)[1];
  const block = fs.readFileSync(path.join(repoRoot, 'presets/solo/payload/AGENTS.block.md'), 'utf8');
  assert.ok(block.includes(`:solo:start v${version} `), 'Manifest and managed block versions must match');

  for (const srcRel of srcMatches) {
    const fullSrc = path.join(repoRoot, 'presets/solo', srcRel);
    assert.ok(fs.existsSync(fullSrc), `manifest src must exist: ${srcRel}`);
  }

  // 配布先で解決する参照とmanifestへの収録を確認する。
  // 通常文書の例示リンクを除き、スキル・共通規約・詳細ガイドの実リンクをたどる。
  const entries = [...manifestText.matchAll(
    /^  - src: (.+)\n    dest: (.+)\n    policy: (.+)$/gm
  )].map((m) => ({ src: m[1], dest: m[2], policy: m[3] }));
  const byDest = new Map(entries.map((entry) => [entry.dest, entry]));
  const instructionEntries = entries.filter((entry) =>
    entry.dest === 'AGENTS.md' || entry.dest.endsWith('/SKILL.md') ||
    entry.dest === 'docs/_conventions.md' || entry.dest.startsWith('docs/_guides/')
  );
  const guidesDir = path.join(repoRoot, 'presets/solo/payload/docs/_guides');
  for (const name of fs.readdirSync(guidesDir)) {
    const entry = byDest.get(`docs/_guides/${name}`);
    assert.ok(entry, `Guide must be distributed: ${name}`);
    assert.equal(entry.policy, 'overwrite', `Guide must be updated on reinstall: ${name}`);
  }
  for (const entry of instructionEntries) {
    const content = fs.readFileSync(path.join(repoRoot, 'presets/solo', entry.src), 'utf8');
    const prose = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^(?:[a-z]+:|#)/i.test(href)) continue;
      const target = path.posix.normalize(path.posix.join(
        path.posix.dirname(entry.dest), href.split('#')[0]
      ));
      assert.ok(byDest.has(target), `${entry.dest}: reference must be distributed: ${href}`);
    }
  }

  // SKILL.md の name とフォルダ名の一致チェック
  const skillsRoot = path.join(repoRoot, 'presets/solo/payload/.agents/skills');
  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.equal(skillDirs.length, 3, 'Should have 3 skills (docs-author, docs-sync, docs-bootstrap)');

  for (const dir of skillDirs) {
    const skillFile = path.join(skillsRoot, dir.name, 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), `SKILL.md must exist in ${dir.name}`);
    assert.ok(byDest.has(`.agents/skills/${dir.name}/SKILL.md`), 'Skill must be distributed');
    const parsed = parseDocument(fs.readFileSync(skillFile, 'utf8'), skillFile);
    assert.ok(parsed.hasFrontmatter, `${dir.name}/SKILL.md must have frontmatter`);
    assert.equal(parsed.frontmatter.name, dir.name, `Skill name must match folder name: ${dir.name}`);
    assert.ok(
      typeof parsed.frontmatter.description === 'string' && parsed.frontmatter.description.length > 20,
      `Skill ${dir.name} must have a meaningful description`
    );
  }
  console.log('  [PASS] manifest.yaml and SKILL.md integrity verified.');
}

// ---------------------------------------------------------------------------
// 2. YAML パーサー単体テスト（日本語・複数行・インライン配列・ブロック配列）
// ---------------------------------------------------------------------------
{
  const yamlSample = `
id: spec-japanese-test
title: "日本語タイトル: サンプル仕様"
type: spec
status: active
summary: >-
  1行目の要約テキストです。
  2行目の要約テキストです。
tags: [認証, auth, "tag with, comma"]
related:
  - overview
  - adr-0001
created: 2026-10-17
updated: 2026-10-17
`.trim();

  const { data, parseErrors } = parseFrontmatterYaml(yamlSample);
  assert.equal(parseErrors.length, 0);
  assert.equal(data.id, 'spec-japanese-test');
  assert.equal(data.title, '日本語タイトル: サンプル仕様');
  assert.equal(data.summary, '1行目の要約テキストです。 2行目の要約テキストです。');
  assert.deepEqual(data.tags, ['認証', 'auth', 'tag with, comma']);
  assert.deepEqual(data.related, ['overview', 'adr-0001']);
  console.log('  [PASS] YAML frontmatter parser unit test passed.');
}

// ---------------------------------------------------------------------------
// 3. 正常系グラフ構築・逆リンク（backlinks / supersededBy）・--index 自動生成テスト
// ---------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-doc-valid-'));
  try {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(path.join(docsDir, 'adr'), { recursive: true });
    fs.mkdirSync(path.join(docsDir, 'specs'), { recursive: true });

    // index.md と _conventions.md をコピー
    fs.copyFileSync(
      path.join(repoRoot, 'presets/solo/payload/docs/index.md'),
      path.join(docsDir, 'index.md')
    );
    fs.copyFileSync(
      path.join(repoRoot, 'presets/solo/payload/docs/_conventions.md'),
      path.join(docsDir, '_conventions.md')
    );

    // adr-0001 (superseded)
    fs.writeFileSync(
      path.join(docsDir, 'adr/0001-old-auth.md'),
      `---
id: adr-0001
title: 旧認証方式の採用
type: adr
status: superseded
summary: セッションCookie方式を採用する（現在はADR-0002により置き換え済み）。
tags: [auth]
related: []
created: 2026-10-01
updated: 2026-10-17
---
# 旧認証方式
`
    );

    // adr-0002 (supersedes adr-0001)
    fs.writeFileSync(
      path.join(docsDir, 'adr/0002-jwt-auth.md'),
      `---
id: adr-0002
title: JWT認証の採用
type: adr
status: accepted
summary: スケーラビリティ向上のためJWTを採用する。
tags: [auth, jwt]
related: []
supersedes: adr-0001
created: 2026-10-17
updated: 2026-10-17
---
# JWT認証
[旧ADR](./0001-old-auth.md) を置き換える。
`
    );

    // spec-login (related to adr-0002)
    fs.writeFileSync(
      path.join(docsDir, 'specs/login.md'),
      `---
id: spec-login
title: ログイン機能仕様
type: spec
status: active
summary: JWTを用いたログインAPIと画面の仕様。
tags: [auth, 仕様]
related: [adr-0002]
created: 2026-10-17
updated: 2026-10-17
---
# ログイン機能仕様
詳細は [ADR-0002](../adr/0002-jwt-auth.md) を参照。
`
    );

    // index更新を実行
    const changed = updateIndexFile(docsDir);
    assert.ok(changed, 'index.md should be updated');

    const graph = loadDocsGraph(docsDir);
    const res = validateDocs(graph);
    assert.equal(res.valid, true, `Expected valid docs, got errors: ${JSON.stringify(res.errors)}`);
    assert.equal(res.warnings.length, 0, `Expected 0 warnings, got: ${JSON.stringify(res.warnings)}`);

    // 逆リンク（backlinks）の検証: adr-0002 は spec-login から参照されているはず
    const adr2 = graph.byId.get('adr-0002');
    assert.deepEqual(adr2.backlinks, ['spec-login']);

    // supersededBy の検証: adr-0001 は adr-0002 に置き換えられているはず
    const adr1 = graph.byId.get('adr-0001');
    assert.deepEqual(adr1.supersededBy, ['adr-0002']);

    console.log('  [PASS] Valid graph, backlinks calculation, and --index generation verified.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 4. 異常系（エラー検出）テスト
// ---------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-doc-invalid-'));
  try {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    // 1) フロントマター欠落
    fs.writeFileSync(path.join(docsDir, 'no-fm.md'), '# フロントマターなし\n');

    // 2) ID重複 + 不正な statusの組み合わせ (spec なのに accepted) + 存在しない related + リンク切れ
    fs.writeFileSync(
      path.join(docsDir, 'bad1.md'),
      `---
id: dup-id
title: 異常系テスト1
type: spec
status: accepted
summary: テスト用
related: [non-existent-id]
created: 2026-10-17
updated: 2026-10-17
---
# 異常系1
[壊れたリンク](./missing-file.md)
`
    );

    // 3) 重複する相方 + 不正な日付形式
    fs.writeFileSync(
      path.join(docsDir, 'bad2.md'),
      `---
id: dup-id
title: 異常系テスト2
type: note
status: active
summary: テスト用2
created: 2026/10/17
updated: 2026-10-17
---
# 異常系2
`
    );

    const graph = loadDocsGraph(docsDir);
    const res = validateDocs(graph);
    assert.equal(res.valid, false, 'Invalid docs must fail validation');

    const errorCodes = new Set(res.errors.map((e) => e.code));
    assert.ok(errorCodes.has('FRONTMATTER_MISSING'), 'Should detect missing frontmatter');
    assert.ok(errorCodes.has('DUPLICATE_ID'), 'Should detect duplicate ID');
    assert.ok(errorCodes.has('INVALID_TYPE_STATUS'), 'Should detect invalid type+status combination');
    assert.ok(errorCodes.has('BROKEN_RELATED_ID'), 'Should detect non-existent related ID');
    assert.ok(errorCodes.has('BROKEN_LINK'), 'Should detect broken markdown link');
    assert.ok(errorCodes.has('INVALID_DATE'), 'Should detect invalid date format');

    console.log('  [PASS] Invalid docs error detection verified (all 6 error types caught).');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Behavior tests for the 0.2 document workflow and viewer contract.
await import('./test_workflow.mjs');
