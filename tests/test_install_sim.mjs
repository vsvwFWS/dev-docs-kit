import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadDocsGraph,
  validateDocs,
} from '../presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const presetDir = path.join(repoRoot, 'presets/solo');

/**
 * INSTALL.md のステップ 4 (policy: overwrite / create-only / merge-block) をシミュレートする関数
 */
function simulateInstall(targetDir) {
  const blockContent = fs.readFileSync(path.join(presetDir, 'payload/AGENTS.block.md'), 'utf8').trim();
  const agentsPath = path.join(targetDir, 'AGENTS.md');

  // merge-block の処理
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `# AGENTS.md\n\n${blockContent}\n`, 'utf8');
  } else {
    const existing = fs.readFileSync(agentsPath, 'utf8');
    const startMarker = '<!-- repository-name:solo:start';
    const endMarker = '<!-- repository-name:solo:end -->';
    const sIdx = existing.indexOf(startMarker);
    const eIdx = existing.indexOf(endMarker);

    if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
      const merged =
        existing.slice(0, sIdx) + blockContent + existing.slice(eIdx + endMarker.length);
      fs.writeFileSync(agentsPath, merged, 'utf8');
    } else {
      fs.writeFileSync(agentsPath, `${existing.trimEnd()}\n\n${blockContent}\n`, 'utf8');
    }
  }

  // payload/docs と payload/.agents を配置 (index.md と _config.json は create-only)
  const copyRecursive = (srcDir, destDir, isCreateOnlyFn) => {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const s = path.join(srcDir, entry.name);
      const d = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(s, d, isCreateOnlyFn);
      } else {
        if (isCreateOnlyFn(d) && fs.existsSync(d)) {
          continue;
        }
        fs.copyFileSync(s, d);
      }
    }
  };

  copyRecursive(
    path.join(presetDir, 'payload/docs'),
    path.join(targetDir, 'docs'),
    (destPath) => ['index.md', '_config.json'].includes(path.basename(destPath))
  );
  copyRecursive(
    path.join(presetDir, 'payload/.agents'),
    path.join(targetDir, '.agents'),
    () => false
  );

  // lock ファイルの記録
  fs.writeFileSync(
    path.join(targetDir, '.agents/repository-name.lock.json'),
    JSON.stringify(
      {
        preset: 'solo',
        version: '0.2.1',
        source: presetDir,
        installedAt: '2026-10-17',
      },
      null,
      2
    ),
    'utf8'
  );
}

const dummyRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-doc-install-sim-'));
try {
  // 既存の AGENTS.md がある状態を準備
  fs.writeFileSync(
    path.join(dummyRepo, 'AGENTS.md'),
    `# Project AGENTS.md\n\n## Build Commands\n- \`npm test\`\n`,
    'utf8'
  );

  // 1回目の導入
  simulateInstall(dummyRepo);

  const agentsAfterFirst = fs.readFileSync(path.join(dummyRepo, 'AGENTS.md'), 'utf8');
  assert.ok(agentsAfterFirst.includes('## Build Commands'), 'Original AGENTS.md content must be preserved');
  assert.ok(
    agentsAfterFirst.includes('<!-- repository-name:solo:start v0.2.1'),
    'Block marker must be appended'
  );

  // docs/index.md をユーザーが編集したと仮定
  const indexPath = path.join(dummyRepo, 'docs/index.md');
  const customIndexContent = fs
    .readFileSync(indexPath, 'utf8')
    .replace('ドキュメント目次 (MOC)', 'カスタム目次タイトル');
  fs.writeFileSync(indexPath, customIndexContent, 'utf8');

  // 対象外一覧と既存文書は再導入でも保持する。
  const configPath = path.join(dummyRepo, 'docs/_config.json');
  const config = JSON.stringify({ excludedFiles: ['legacy.md'] });
  fs.writeFileSync(configPath, config);
  fs.writeFileSync(path.join(dummyRepo, 'docs/legacy.md'), '# Existing document without metadata\n');

  // 管理ガイドは再導入で配布元へ戻る。
  const guideNames = fs.readdirSync(path.join(presetDir, 'payload/docs/_guides'));
  for (const name of guideNames) {
    fs.writeFileSync(path.join(dummyRepo, 'docs/_guides', name), '# Stale guide\n');
  }

  // 2回目の導入（アップデート・冪等性の確認）
  simulateInstall(dummyRepo);

  const agentsAfterSecond = fs.readFileSync(path.join(dummyRepo, 'AGENTS.md'), 'utf8');
  assert.equal(
    agentsAfterSecond,
    agentsAfterFirst,
    'Running install twice must not duplicate the AGENTS.md block'
  );

  const indexAfterSecond = fs.readFileSync(indexPath, 'utf8');
  assert.ok(
    indexAfterSecond.includes('カスタム目次タイトル'),
    'create-only policy must preserve user edits to docs/index.md'
  );

  assert.equal(fs.readFileSync(configPath, 'utf8'), config, 'create-only must preserve exclusions');
  assert.equal(fs.readFileSync(path.join(dummyRepo, 'docs/legacy.md'), 'utf8'), '# Existing document without metadata\n');

  for (const name of guideNames) {
    assert.equal(
      fs.readFileSync(path.join(dummyRepo, 'docs/_guides', name), 'utf8'),
      fs.readFileSync(path.join(presetDir, 'payload/docs/_guides', name), 'utf8'),
      `Reinstall must overwrite managed guide: ${name}`
    );
  }

  // 旧版の管理ブロックを更新し、後続のユーザー記述も保持する。
  const userSuffix = '\n## Project notes\nKeep this section.\n';
  fs.writeFileSync(path.join(dummyRepo, 'AGENTS.md'),
    agentsAfterFirst.replace(/:solo:start v[\d.]+/, ':solo:start v0.1.0') + userSuffix);
  simulateInstall(dummyRepo);
  assert.equal(fs.readFileSync(path.join(dummyRepo, 'AGENTS.md'), 'utf8'),
    agentsAfterFirst + userSuffix, 'Upgrade must replace the old block and preserve surrounding content');

  // 導入後の docs/ で lint が通ることを確認
  const graph = loadDocsGraph(path.join(dummyRepo, 'docs'));
  const res = validateDocs(graph);
  assert.equal(res.valid, true, 'Installed docs must pass validation');

  console.log('  [PASS] Installation, AGENTS.md block merge, and idempotency verified.');
} finally {
  fs.rmSync(dummyRepo, { recursive: true, force: true });
}
