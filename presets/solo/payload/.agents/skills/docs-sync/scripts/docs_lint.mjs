#!/usr/bin/env node
/**
 * docs_lint.mjs
 *
 * ゼロ依存（Node.js 標準組み込みモジュールのみ）で動作する開発ドキュメントの
 * フロントマター解析・グラフ構築・整合性検証・MOC（index.md）生成スクリプト。
 *
 * - CLI として実行可能:
 *     node .agents/skills/docs-sync/scripts/docs_lint.mjs [--docs-dir docs] [--index] [--json] [--stale-days 14]
 * - 将来のビューアー／エディターから ES Module として import 可能:
 *     import { parseFrontmatterYaml, parseDocument, loadDocsGraph, validateDocs, generateIndexContent } from './docs_lint.mjs';
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SCHEMA = {
  required: ['id', 'title', 'type', 'status', 'summary', 'created', 'updated'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
    title: { type: 'string', minLength: 1 },
    type: {
      type: 'string',
      enum: ['index', 'overview', 'architecture', 'glossary', 'spec', 'adr', 'plan', 'note', 'guide'],
    },
    status: {
      type: 'string',
      enum: ['draft', 'active', 'accepted', 'superseded', 'deprecated', 'done'],
    },
    summary: { type: 'string', minLength: 1, maxLength: 200 },
    tags: { type: 'array', items: { type: 'string', minLength: 1 } },
    related: { type: 'array', items: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' } },
    supersedes: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
    created: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    updated: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
  typeStatusRules: {
    index: ['active'],
    overview: ['draft', 'active', 'deprecated'],
    architecture: ['draft', 'active', 'deprecated'],
    glossary: ['draft', 'active', 'deprecated'],
    spec: ['draft', 'active', 'deprecated'],
    adr: ['draft', 'accepted', 'superseded', 'deprecated'],
    plan: ['draft', 'active', 'done'],
    note: ['draft', 'active', 'deprecated'],
    guide: ['draft', 'active', 'deprecated'],
  },
};

/**
 * クォート剥がしとエスケープ解除
 * @param {string} raw
 * @returns {string}
 */
function unquoteYamlScalar(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    const inner = trimmed.slice(1, -1);
    if (trimmed.startsWith('"')) {
      return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
    }
    return inner.replace(/''/g, "'");
  }
  // 行末コメントの除去（クォート外で ` #` がある場合）
  const commentIdx = trimmed.indexOf(' #');
  if (commentIdx !== -1) {
    return trimmed.slice(0, commentIdx).trim();
  }
  return trimmed;
}

/**
 * インライン配列 `[a, "b, c", d]` をパースする
 * @param {string} raw
 * @returns {string[]}
 */
function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  const items = [];
  let current = '';
  let inQuote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQuote) {
      if (ch === inQuote && inner[i - 1] !== '\\') {
        inQuote = null;
      }
      current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(unquoteYamlScalar(current));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    items.push(unquoteYamlScalar(current));
  }
  return items;
}

/**
 * フロントマター用の軽量 YAML パーサー（標準機能をカバー）
 * 対応構文:
 * - key: value（文字列・日本語・クォート付き文字列）
 * - key: [item1, item2]（インライン配列）
 * - key:\n  - item1\n  - item2（ブロック配列）
 * - key: >- / > / |- / |（複数行ブロックスカラー）
 *
 * @param {string} yamlText
 * @returns {{ data: Record<string, any>, parseErrors: string[] }}
 */
export function parseFrontmatterYaml(yamlText) {
  const lines = yamlText.replace(/\r\n/g, '\n').split('\n');
  const data = {};
  const parseErrors = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) {
      parseErrors.push(`YAML構文エラー (行 ${i + 1}): "${line}"`);
      i++;
      continue;
    }

    const key = match[1];
    const rest = match[2].trim();

    // 複数行スカラー (>, >-, |, |-)
    if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      const fold = rest.startsWith('>');
      const blockLines = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim() === '') {
          blockLines.push('');
          i++;
          continue;
        }
        if (/^[ \t]+/.test(nextLine)) {
          blockLines.push(nextLine.trim());
          i++;
        } else {
          break;
        }
      }
      // 末尾の空行をトリム
      while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') {
        blockLines.pop();
      }
      if (fold) {
        // 段落区切り（空行）は改行として残し、連続行はスペースで結合（日本語文字間はスペースなしで結合しても自然だがYAML仕様に準拠しつつ整形）
        const paragraphs = [];
        let buf = [];
        for (const bl of blockLines) {
          if (bl === '') {
            if (buf.length) {
              paragraphs.push(buf.join(' '));
              buf = [];
            }
          } else {
            buf.push(bl);
          }
        }
        if (buf.length) paragraphs.push(buf.join(' '));
        data[key] = paragraphs.join('\n');
      } else {
        data[key] = blockLines.join('\n');
      }
      continue;
    }

    // 値が空 → 次の行からのブロック配列か空文字列かを確認
    if (rest === '') {
      const arr = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.trim() === '' || nextLine.trim().startsWith('#')) {
          j++;
          continue;
        }
        const itemMatch = nextLine.match(/^[ \t]*-\s+(.*)$/);
        if (itemMatch) {
          arr.push(unquoteYamlScalar(itemMatch[1]));
          j++;
        } else {
          break;
        }
      }
      if (arr.length > 0) {
        data[key] = arr;
        i = j;
      } else {
        data[key] = '';
        i++;
      }
      continue;
    }

    // インライン配列
    if (rest.startsWith('[') && rest.endsWith(']')) {
      data[key] = parseInlineArray(rest);
      i++;
      continue;
    }

    // 通常のスカラー値
    data[key] = unquoteYamlScalar(rest);
    i++;
  }

  return { data, parseErrors };
}

/**
 * Markdown テキストからコードブロックやインラインコードを除いた本文中のリンクを抽出する
 * @param {string} body
 * @returns {Array<{ text: string, target: string, line: number }>}
 */
export function extractMarkdownLinks(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const links = [];
  let fence = null;
  let inHtmlComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // A fence closes only with the same delimiter and at least the opening length.
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }

    // 複数行 HTML コメントの簡易スキップ
    if (inHtmlComment) {
      const endIdx = line.indexOf('-->');
      if (endIdx === -1) continue;
      line = line.slice(endIdx + 3);
      inHtmlComment = false;
    }
    // 同一行内の HTML コメントを除去
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    if (line.includes('<!--')) {
      inHtmlComment = true;
      line = line.slice(0, line.indexOf('<!--'));
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) { fence = openingFence[1]; continue; }

    // インラインコード `...` を除去
    const cleaned = line.replace(/`[^`]*`/g, '');

    const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(cleaned)) !== null) {
      const text = match[1];
      let target = match[2].trim();
      // タイトル付きリンク `path "title"` の場合
      if (target.startsWith('<') && target.includes('>')) {
        target = target.slice(1, target.indexOf('>'));
      } else {
        const spaceIdx = target.search(/\s/);
        if (spaceIdx !== -1) target = target.slice(0, spaceIdx);
      }
      links.push({ text, target, line: i + 1 });
    }
  }

  return links;
}

/**
 * 1つの Markdown ドキュメントをパースする（ビューアーからも利用可能）
 * @param {string} content
 * @param {string} filePath
 * @param {string} [docsDir]
 */
export function parseDocument(content, filePath, docsDir = '') {
  const normalized = content.replace(/\r\n/g, '\n');
  const relativePath = docsDir
    ? path.relative(docsDir, filePath).split(path.sep).join('/')
    : filePath;

  if (!normalized.startsWith('---\n')) {
    return {
      filePath,
      relativePath,
      hasFrontmatter: false,
      frontmatter: null,
      parseErrors: ['ファイル先頭に YAML フロントマター (---) がありません'],
      body: normalized,
      bodyStartLine: 1,
      links: extractMarkdownLinks(normalized),
    };
  }

  const endMarkerIdx = normalized.indexOf('\n---\n', 4);
  const endMarkerEofIdx = normalized.endsWith('\n---') ? normalized.length - 4 : -1;
  const closeIdx = endMarkerIdx !== -1 ? endMarkerIdx : endMarkerEofIdx;

  if (closeIdx === -1) {
    return {
      filePath,
      relativePath,
      hasFrontmatter: false,
      frontmatter: null,
      parseErrors: ['YAML フロントマターの終了マーカー (---) が見つかりません'],
      body: normalized,
      bodyStartLine: 1,
      links: [],
    };
  }

  const yamlText = normalized.slice(4, closeIdx);
  const body = normalized.slice(closeIdx + 5);
  const fmLineCount = yamlText.split('\n').length + 2;
  const { data, parseErrors } = parseFrontmatterYaml(yamlText);
  const rawLinks = extractMarkdownLinks(body);
  const links = rawLinks.map((l) => ({
    ...l,
    line: l.line + fmLineCount,
  }));

  return {
    filePath,
    relativePath,
    hasFrontmatter: true,
    frontmatter: data,
    parseErrors,
    body,
    bodyStartLine: fmLineCount + 1,
    links,
  };
}

/**
 * docs/ 配下の対象 Markdown ファイルを再帰的に走査する（`_` 始まりは除外）
 * @param {string} dir
 * @returns {string[]}
 */
export function collectDocFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    // `_templates`, `_schema`, `_conventions.md`, 隠しファイルを除外
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDocFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

/** Read explicit migration exclusions. Invalid config never silently excludes files. */
export function loadDocsConfig(docsDir) {
  const configPath = path.join(docsDir, '_config.json');
  const errors = [];
  let excludedFiles = [];
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!config || Array.isArray(config) || typeof config !== 'object' ||
          Object.keys(config).some((key) => key !== 'excludedFiles') ||
          (config.excludedFiles !== undefined && !Array.isArray(config.excludedFiles))) {
        throw new Error('excludedFiles 配列だけを持つオブジェクトを指定してください');
      }
      excludedFiles = config.excludedFiles || [];
      for (const file of excludedFiles) {
        if (typeof file !== 'string' || !file.endsWith('.md') ||
            /[\\*?\[\]\x00]/.test(file) || file.includes(':') ||
            path.posix.isAbsolute(file) || file.split('/').some((part) => !part || part === '.' || part === '..') ||
            file === 'index.md' || file.split('/').some((part) => part.startsWith('_') || part.startsWith('.'))) {
          throw new Error('excludedFiles は docs/ 相対の通常 Markdown ファイルを個別指定します（index.md・ワイルドカード不可）');
        }
      }
    } catch (error) {
      excludedFiles = [];
      errors.push({ level: 'error', file: '_config.json', code: 'INVALID_CONFIG', message: error.message, line: null });
    }
  }
  return { excludedFiles: [...new Set(excludedFiles)], errors };
}

// Same path resolution for graph, lint and index checks; fragments are not document IDs.
function resolveLocalLink(doc, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.startsWith('#')) return null;
  const pathname = target.split('#')[0].split('?')[0];
  if (!pathname) return null;
  try {
    return path.resolve(path.dirname(doc.filePath), decodeURIComponent(pathname));
  } catch {
    return path.resolve(path.dirname(doc.filePath), pathname);
  }
}

/** Load managed documents. Keep legacy backlinks (related only) and add typed edges. */
export function loadDocsGraph(docsDir) {
  const absDocsDir = path.resolve(docsDir);
  const config = loadDocsConfig(absDocsDir);
  const excluded = new Set(config.excludedFiles);
  const files = collectDocFiles(absDocsDir).filter((file) => !excluded.has(path.relative(absDocsDir, file).split(path.sep).join('/')));
  const documents = [];
  const byId = new Map();
  const duplicateIds = new Map();
  const byPath = new Map();
  for (const filePath of files) {
    const doc = parseDocument(fs.readFileSync(filePath, 'utf8'), filePath, absDocsDir);
    doc.backlinks = [];
    doc.referenceBacklinks = [];
    doc.supersededBy = [];
    documents.push(doc);
    byPath.set(filePath, doc);
    const id = doc.frontmatter?.id;
    if (typeof id === 'string' && id.length > 0) {
      if (byId.has(id)) {
        const existing = duplicateIds.get(id) || [byId.get(id).relativePath];
        existing.push(doc.relativePath);
        duplicateIds.set(id, existing);
      } else byId.set(id, doc);
    }
  }
  const edges = [];
  const seen = new Set();
  function addEdge(source, target, kind, reverseField) {
    const sourceId = source.frontmatter?.id;
    const targetId = target?.frontmatter?.id;
    if (typeof sourceId !== 'string' || typeof targetId !== 'string' || !sourceId || !targetId || duplicateIds.has(sourceId) || duplicateIds.has(targetId)) return;
    const key = JSON.stringify([sourceId, targetId, kind]);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ sourceId, targetId, kind });
    target[reverseField].push(sourceId);
  }
  for (const doc of documents) {
    const fm = doc.frontmatter;
    if (!fm) continue;
    if (Array.isArray(fm.related)) {
      for (const id of fm.related) addEdge(doc, byId.get(id), 'related', 'backlinks');
    }
    if (typeof fm.supersedes === 'string') addEdge(doc, byId.get(fm.supersedes), 'supersedes', 'supersededBy');
    for (const link of doc.links) {
      const targetPath = resolveLocalLink(doc, link.target);
      if (targetPath) addEdge(doc, byPath.get(targetPath), 'references', 'referenceBacklinks');
    }
  }
  return { docsDir: absDocsDir, documents, byId, duplicateIds, edges, config };
}

/**
 * 日付文字列 YYYY-MM-DD の妥当性検証
 * @param {string} str
 * @returns {boolean}
 */
function isValidDateString(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().startsWith(str);
}

/**
 * ドキュメントグラフ全体を検証する
 * @param {ReturnType<typeof loadDocsGraph>} graph
 * @param {object} [options]
 * @param {object} [options.schema]
 * @param {number} [options.staleDays]
 * @param {Date} [options.now]
 */
export function validateDocs(graph, options = {}) {
  const schema = options.schema || loadSchemaFromDocsDir(graph.docsDir);
  const staleDays = options.staleDays ?? 14;
  const now = options.now || new Date();

  const errors = [...(graph.config?.errors || [])];
  const warnings = [];

  const addError = (file, code, message, line = null) => {
    errors.push({ level: 'error', file, code, message, line });
  };
  const addWarning = (file, code, message, line = null) => {
    warnings.push({ level: 'warning', file, code, message, line });
  };

  // ID重複エラー
  for (const [id, paths] of graph.duplicateIds.entries()) {
    for (const p of paths) {
      addError(p, 'DUPLICATE_ID', `id "${id}" が複数のファイルで重複しています: ${paths.join(', ')}`);
    }
  }

  const allowedKeys = new Set(Object.keys(schema.properties || {}));
  const idRegex = new RegExp(schema.properties?.id?.pattern || '^[a-z0-9]+(-[a-z0-9]+)*$');
  const maxSummaryLen = schema.properties?.summary?.maxLength || 200;

  for (const doc of graph.documents) {
    const rel = doc.relativePath;

    if (!doc.hasFrontmatter || !doc.frontmatter) {
      for (const msg of doc.parseErrors) {
        addError(rel, 'FRONTMATTER_MISSING', msg, 1);
      }
      continue;
    }

    for (const msg of doc.parseErrors) {
      addError(rel, 'YAML_PARSE_ERROR', msg, 1);
    }

    const fm = doc.frontmatter;

    // 未知のプロパティチェック
    for (const key of Object.keys(fm)) {
      if (!allowedKeys.has(key)) {
        addError(rel, 'UNKNOWN_PROPERTY', `未知のフロントマター項目 "${key}" が指定されています`);
      }
    }

    // 必須項目チェック
    for (const reqKey of schema.required || []) {
      if (fm[reqKey] === undefined || fm[reqKey] === null || fm[reqKey] === '') {
        addError(rel, 'MISSING_REQUIRED', `必須項目 "${reqKey}" がありません`);
      }
    }

    // Scalar and array item types are part of the public frontmatter contract.
    for (const [key, rule] of Object.entries(schema.properties || {})) {
      const value = fm[key];
      if (value === undefined) continue;
      if (rule.type === 'string' && typeof value !== 'string') {
        addError(rel, 'INVALID_FIELD_TYPE', `${key} は文字列で指定してください`);
      }
      if (rule.type === 'array' && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item !== 'string' || !item.trim() || (rule.items?.pattern && !new RegExp(rule.items.pattern).test(item))) {
            addError(rel, 'INVALID_ARRAY_ITEM', `${key} の項目が不正です`);
          }
        }
      }
    }

    // id 形式
    if (typeof fm.id === 'string' && fm.id.length > 0 && !idRegex.test(fm.id)) {
      addError(
        rel,
        'INVALID_ID',
        `id "${fm.id}" の形式が不正です（英小文字・数字・ハイフンのみ使用可能）`
      );
    }

    // type 検証
    const validTypes = schema.properties?.type?.enum || [];
    if (typeof fm.type === 'string' && fm.type.length > 0 && !validTypes.includes(fm.type)) {
      addError(rel, 'INVALID_TYPE', `type "${fm.type}" は許可されていません（許可値: ${validTypes.join(', ')}）`);
    }

    // status 検証および type x status の組み合わせ検証
    const validStatuses = schema.properties?.status?.enum || [];
    if (typeof fm.status === 'string' && fm.status.length > 0) {
      if (!validStatuses.includes(fm.status)) {
        addError(
          rel,
          'INVALID_STATUS',
          `status "${fm.status}" は許可されていません（許可値: ${validStatuses.join(', ')}）`
        );
      } else if (
        fm.type &&
        schema.typeStatusRules &&
        schema.typeStatusRules[fm.type] &&
        !schema.typeStatusRules[fm.type].includes(fm.status)
      ) {
        addError(
          rel,
          'INVALID_TYPE_STATUS',
          `type "${fm.type}" に対して status "${fm.status}" は使用できません（許可値: ${schema.typeStatusRules[fm.type].join(', ')}）`
        );
      }
    }

    // summary 長さ検証
    if (typeof fm.summary === 'string') {
      if (fm.summary.length > maxSummaryLen) {
        addError(
          rel,
          'SUMMARY_TOO_LONG',
          `summary が ${fm.summary.length} 文字あります（上限 ${maxSummaryLen} 文字以内にしてください）`
        );
      }
    }

    // created / updated の日付形式検証
    for (const dateField of ['created', 'updated']) {
      if (typeof fm[dateField] === 'string' && fm[dateField].length > 0) {
        if (!isValidDateString(fm[dateField])) {
          addError(rel, 'INVALID_DATE', `${dateField} "${fm[dateField]}" は有効な YYYY-MM-DD 日付ではありません`);
        }
      }
    }

    // tags の型検証
    if (fm.tags !== undefined && !Array.isArray(fm.tags)) {
      addError(rel, 'INVALID_TAGS', `tags は配列形式で指定してください（例: [tag1, tag2]）`);
    }

    // related の型・参照先存在検証
    if (fm.related !== undefined) {
      if (!Array.isArray(fm.related)) {
        addError(rel, 'INVALID_RELATED', `related は id の配列形式で指定してください（例: [overview, adr-0001]）`);
      } else {
        for (const relId of fm.related) {
          if (relId === fm.id) {
            addError(rel, 'SELF_REFERENCE', `related に自身の id "${relId}" が含まれています`);
          } else if (!graph.byId.has(relId)) {
            addError(rel, 'BROKEN_RELATED_ID', `related で指定された id "${relId}" のドキュメントが存在しません`);
          }
        }
      }
    }

    // supersedes の検証
    if (fm.supersedes !== undefined && fm.supersedes !== '') {
      if (fm.type !== 'adr') {
        addError(rel, 'INVALID_SUPERSEDES', `supersedes は type: adr のドキュメントでのみ指定できます`);
      } else if (fm.supersedes === fm.id) {
        addError(rel, 'INVALID_SUPERSEDES', 'ADR は自身を置き換えられません');
      } else if (!graph.byId.has(fm.supersedes)) {
        addError(rel, 'BROKEN_SUPERSEDES_ID', `supersedes で指定された旧 ADR "${fm.supersedes}" が存在しません`);
      } else {
        const oldAdr = graph.byId.get(fm.supersedes);
        if (oldAdr.frontmatter?.type !== 'adr') {
          addError(rel, 'INVALID_SUPERSEDES', '置き換え対象は ADR に限ります');
        } else if (fm.status !== 'draft' && oldAdr.frontmatter?.status !== 'superseded') {
          addWarning(
            rel,
            'SUPERSEDED_STATUS_MISMATCH',
            `置き換え対象の旧 ADR "${fm.supersedes}" (${oldAdr.relativePath}) の status が "superseded" になっていません（現在: "${oldAdr.frontmatter?.status}"）`
          );
        }
      }
    }

    // 本文中の相対リンク切れ検証
    for (const link of doc.links) {
      const target = link.target;
      const resolvedPath = resolveLocalLink(doc, target);
      if (!resolvedPath) continue;
      if (!fs.existsSync(resolvedPath)) {
        addError(
          rel,
          'BROKEN_LINK',
          `本文中のリンク先が存在しません: "${target}"`,
          link.line
        );
      }
    }

    // 長期間更新されていない active plan の警告
    if (fm.type === 'plan' && fm.status === 'active' && isValidDateString(fm.updated)) {
      const updatedDate = new Date(`${fm.updated}T00:00:00Z`);
      const diffDays = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > staleDays) {
        addWarning(
          rel,
          'STALE_ACTIVE_PLAN',
          `status: active の計画が ${diffDays} 日間更新されていません（完了している場合は status: done にして plans/archive/ へ移動してください）`
        );
      }
    }

    // done なのに archive に入っていない plan の警告
    if (fm.type === 'plan' && fm.status === 'done' && !rel.includes('archive/')) {
      addWarning(
        rel,
        'UNARCHIVED_DONE_PLAN',
        `status: done の計画です。docs/plans/archive/ 配下への移動を推奨します`
      );
    }
  }

  // A replacement chain must be acyclic and every ID unambiguous.
  for (const doc of graph.documents) {
    if (doc.frontmatter?.type !== 'adr') continue;
    const visited = new Set();
    let current = doc;
    while (current?.frontmatter?.supersedes && !graph.duplicateIds.has(current.frontmatter.id)) {
      const id = current.frontmatter.id;
      if (visited.has(id)) {
        addError(doc.relativePath, 'SUPERSEDES_CYCLE', 'ADR の置き換え関係が循環しています');
        break;
      }
      visited.add(id);
      current = graph.byId.get(current.frontmatter.supersedes);
    }
  }

  // index.md に未掲載のアクティブ文書の警告チェック
  const indexDoc = graph.byId.get('index');
  if (indexDoc) {
    const linkedFiles = new Set(
      indexDoc.links
        .map((l) => resolveLocalLink(indexDoc, l.target))
        .filter(Boolean)
    );

    for (const doc of graph.documents) {
      const fm = doc.frontmatter;
      if (!fm || fm.id === 'index') continue;
      // アーカイブ済み plan や deprecated/superseded は index 未掲載でも警告しない
      if (fm.status === 'done' || fm.status === 'deprecated' || fm.status === 'superseded') {
        continue;
      }
      if (!linkedFiles.has(doc.filePath)) {
        addWarning(
          doc.relativePath,
          'NOT_IN_INDEX',
          `ドキュメント "${fm.id}" が docs/index.md からリンクされていません（--index オプションで自動反映できます）`
        );
      }
    }
  } else {
    addWarning('index.md', 'MISSING_INDEX_DOC', 'docs/index.md (id: index) が見つかりません');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    documentCount: graph.documents.length,
  };
}

/**
 * docs/_schema/frontmatter.schema.json があれば読み込み、なければ DEFAULT_SCHEMA を返す
 * @param {string} docsDir
 */
export function loadSchemaFromDocsDir(docsDir) {
  const schemaPath = path.join(docsDir, '_schema', 'frontmatter.schema.json');
  if (fs.existsSync(schemaPath)) {
    try {
      return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch {
      return DEFAULT_SCHEMA;
    }
  }
  return DEFAULT_SCHEMA;
}

/**
 * docs/index.md のマーカー間（<!-- docs-index:start --> 〜 <!-- docs-index:end -->）に挿入する
 * 目次 Markdown を生成する
 * @param {ReturnType<typeof loadDocsGraph>} graph
 * @returns {string}
 */
function isHistory(doc) {
  return ['done', 'superseded', 'deprecated'].includes(doc.frontmatter?.status);
}

function indexDocuments(graph) {
  return graph.documents.filter((doc) => typeof doc.frontmatter?.id === 'string' && doc.frontmatter.id !== 'index')
    .sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
}

function formatEntry(doc) {
  const fm = doc.frontmatter;
  // Markdown link labels and paths may contain punctuation or spaces.
  const title = String(fm.title || fm.id).replace(/[\[\]\\]/g, '\\$&');
  const target = doc.relativePath.split('/').map((part) => encodeURIComponent(part).replace(/[()]/g, (c) => c === '(' ? '%28' : '%29')).join('/');
  const summary = String(fm.summary || '').replace(/\s+/g, ' ');
  return `- [${title}](./${target}) \`[${fm.status}]\` — ${summary}`;
}

export function generateIndexContent(graph) {
  const docs = indexDocuments(graph);
  const current = docs.filter((doc) => !isHistory(doc) && doc.frontmatter.status !== 'draft' && doc.frontmatter.type !== 'plan');
  const sections = [
    ['全体像・基本設計', current.filter((d) => ['overview', 'architecture', 'glossary'].includes(d.frontmatter.type))
      .sort((a, b) => ['overview', 'architecture', 'glossary'].indexOf(a.frontmatter.type) - ['overview', 'architecture', 'glossary'].indexOf(b.frontmatter.type))],
    ['現行の機能仕様', current.filter((d) => d.frontmatter.type === 'spec')],
    ['有効な設計判断（実装完了を意味しません）', current.filter((d) => d.frontmatter.type === 'adr')],
    ['ガイド・手順書', current.filter((d) => d.frontmatter.type === 'guide')],
    ['調査メモ・知見（確定仕様とは区別）', current.filter((d) => d.frontmatter.type === 'note')],
    ['下書き・未確認事項', docs.filter((d) => d.frontmatter.status === 'draft')],
    ['進行中の変更案・作業計画', docs.filter((d) => d.frontmatter.type === 'plan' && d.frontmatter.status === 'active')],
  ];
  const lines = ['<!-- docs-index:start -->'];
  for (const [heading, items] of sections) {
    if (items.length) lines.push(`## ${heading}`, '', ...items.map(formatEntry), '');
  }
  if (docs.some(isHistory)) lines.push('## 履歴', '', '[完了した計画・過去の文書](./_history.md)', '');
  lines.push('<!-- docs-index:end -->');
  return lines.join('\n');
}

export function generateHistoryContent(graph) {
  return ['<!-- docs-history:start -->', ...indexDocuments(graph).filter(isHistory).map(formatEntry), '<!-- docs-history:end -->'].join('\n');
}

function replaceGeneratedBlock(original, generated, name) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const s = original.indexOf(start);
  const e = original.indexOf(end);
  if (s === -1 && e === -1) return `${original.trimEnd()}\n\n${generated}\n`;
  if (s === -1 || e < s || original.indexOf(start, s + start.length) !== -1 || original.indexOf(end, e + end.length) !== -1) {
    throw new Error(`${name} の開始・終了マーカーを一組に修正してください`);
  }
  return original.slice(0, s) + generated + original.slice(e + end.length);
}

/** Update generated regions only; history lives beside index so relative links are shared. */
export function updateIndexFile(docsDir) {
  const graph = loadDocsGraph(docsDir);
  const indexPath = path.join(graph.docsDir, 'index.md');
  if (!fs.existsSync(indexPath)) return false;
  // Never generate an apparently complete index from ambiguous/invalid metadata.
  const result = validateDocs(graph);
  if (result.errors.some((error) => error.code !== 'BROKEN_LINK')) return false;
  const writes = [[indexPath, replaceGeneratedBlock(fs.readFileSync(indexPath, 'utf8'), generateIndexContent(graph), 'docs-index')]];
  const historyPath = path.join(graph.docsDir, '_history.md');
  if (graph.documents.some(isHistory) || fs.existsSync(historyPath)) {
    const original = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '# 過去の文書・完了した計画\n\n[現在の文書へ](./index.md)\n';
    writes.push([historyPath, replaceGeneratedBlock(original, generateHistoryContent(graph), 'docs-history')]);
  }
  let changed = false;
  for (const [file, content] of writes) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      fs.writeFileSync(file, content, 'utf8');
      changed = true;
    }
  }
  return changed;
}

/**
 * CLI エントリーポイント
 */
function runCli(argv) {
  let docsDir = 'docs';
  let shouldUpdateIndex = false;
  let jsonOutput = false;
  let staleDays = 14;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--docs-dir' && argv[i + 1]) {
      docsDir = argv[++i];
    } else if (arg === '--index') {
      shouldUpdateIndex = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--stale-days' && argv[i + 1]) {
      staleDays = Number(argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node docs_lint.mjs [--docs-dir <dir>] [--index] [--json] [--stale-days <days>]'
      );
      process.exit(0);
    }
  }

  const absDocsDir = path.resolve(docsDir);
  if (!fs.existsSync(absDocsDir)) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({ formatVersion: 1, edges: [], documents: [], indexUpdated: false, valid: false, errors: [{ code: 'DOCS_DIR_NOT_FOUND', message: `Directory not found: ${absDocsDir}` }], warnings: [] }, null, 2)
      );
    } else {
      console.error(`[ERROR] ドキュメントディレクトリが見つかりません: ${absDocsDir}`);
    }
    process.exit(1);
  }

  let indexUpdated = false;
  let indexError;
  if (shouldUpdateIndex) {
    try { indexUpdated = updateIndexFile(absDocsDir); }
    catch (error) { indexError = { level: 'error', file: 'index.md / _history.md', code: 'INDEX_UPDATE_FAILED', message: error.message, line: null }; }
  }

  const graph = loadDocsGraph(absDocsDir);
  const result = validateDocs(graph, { staleDays });
  if (indexError) { result.errors.push(indexError); result.valid = false; }

  if (jsonOutput) {
    const graphSummary = graph.documents.map((d) => ({
      file: d.relativePath,
      frontmatter: d.frontmatter,
      backlinks: d.backlinks,
      referenceBacklinks: d.referenceBacklinks,
      supersededBy: d.supersededBy,
    }));
    console.log(
      JSON.stringify(
        {
          ...result,
          formatVersion: 1,
          edges: graph.edges,
          indexUpdated,
          documents: graphSummary,
        },
        null,
        2
      )
    );
  } else {
    if (indexUpdated) {
      console.log(`[INDEX] docs/index.md の目次を更新しました。`);
    }
    for (const err of result.errors) {
      const loc = err.line ? `${err.file}:${err.line}` : err.file;
      console.error(`[ERROR] (${err.code}) ${loc} - ${err.message}`);
    }
    for (const warn of result.warnings) {
      const loc = warn.line ? `${warn.file}:${warn.line}` : warn.file;
      console.warn(`[WARN]  (${warn.code}) ${loc} - ${warn.message}`);
    }
    if (result.valid) {
      console.log(
        `[OK] ${result.documentCount} 件のドキュメントを検証しました（エラー: 0, 警告: ${result.warnings.length}）。`
      );
    } else {
      console.error(
        `[FAIL] ${result.documentCount} 件中、エラー ${result.errors.length} 件、警告 ${result.warnings.length} 件が見つかりました。`
      );
    }
  }

  process.exit(result.valid ? 0 : 1);
}

// 直接実行された場合のみ CLI を起動
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  runCli(process.argv.slice(2));
}
