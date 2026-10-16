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

  // payload/docs と payload/.agents を配置 (index.md のみ create-only)
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
    (destPath) => destPath.endsWith('docs/index.md')
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
        version: '0.1.1',
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
    agentsAfterFirst.includes('<!-- repository-name:solo:start v0.1.1'),
    'Block marker must be appended'
  );

  // docs/index.md をユーザーが編集したと仮定
  const indexPath = path.join(dummyRepo, 'docs/index.md');
  const customIndexContent = fs
    .readFileSync(indexPath, 'utf8')
    .replace('ドキュメント目次 (MOC)', 'カスタム目次タイトル');
  fs.writeFileSync(indexPath, customIndexContent, 'utf8');

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

  // 導入後の docs/ で lint が通ることを確認
  const graph = loadDocsGraph(path.join(dummyRepo, 'docs'));
  const res = validateDocs(graph);
  assert.equal(res.valid, true, 'Installed docs must pass validation');

  console.log('  [PASS] Installation, AGENTS.md block merge, and idempotency verified.');
} finally {
  fs.rmSync(dummyRepo, { recursive: true, force: true });
}
