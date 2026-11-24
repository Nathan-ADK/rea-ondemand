'use strict';
/**
 * REA 按需插件 —— 本机安装适配器。
 * 自动探测本机 rea(mjs) CLI 与可用 Node，生成 rea-path.json（仅本机、不分发）。
 * 发布版用户若把 rea 装在 PATH 上，可不跑本脚本，hook 会自动走 PATH 回退。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const HOME = os.homedir();
const candidates = [
  path.join(process.env.REA_HOME || '', 'rea-agents', 'scripts', 'rea.mjs'),
  path.join(HOME, '.rea', 'rea-agents', 'scripts', 'rea.mjs'),
  path.join(HOME, 'rea', 'rea-agents', 'scripts', 'rea.mjs'),
  path.join(HOME, 'tools', 'rea', 'rea-agents', 'scripts', 'rea.mjs'),
  path.join(HOME, 'AI-工具+插件', 'WBD', 'tools', 'rea', 'rea-agents', 'scripts', 'rea.mjs'),
];
let cli = null;
for (const c of candidates) {
  if (c && fs.existsSync(c)) { cli = c; break; }
}
if (process.env.REA_CLI && fs.existsSync(process.env.REA_CLI)) cli = process.env.REA_CLI;

// 找 >=22.23.4 的 Node：优先 REA_NODE 环境变量，其次专用 runtime，最后系统 node
function nodeOK(p) {
  try { const v = execFileSync(p, ['--version'], { encoding: 'utf8' }); return v.trim(); } catch (_) { return null; }
}
function versionOK(v) {
  const m = (v || '').match(/v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const [maj, min, patch] = [+m[1], +m[2], +m[3]];
  return maj > 22 || (maj === 22 && (min > 23 || (min === 23 && patch >= 4)));
}
let node = process.execPath;
const nodeCandidates = [
  process.env.REA_NODE,
  path.join(HOME, '.rea', 'node', 'node.exe'),
  path.join(HOME, 'AI-工具+插件', 'WBD', 'tools', 'node-runtime', 'node-v22.23.5-win-x64', 'node.exe'),
].filter(Boolean);
let found = false;
for (const p of nodeCandidates) {
  const v = fs.existsSync(p) ? nodeOK(p) : null;
  if (v && versionOK(v)) { node = p; found = true; break; }
}
const nodeVer = nodeOK(node) || '(unknown)';
if (!versionOK(nodeVer)) {
  process.stderr.write('[REA install] 警告：Node ' + nodeVer + ' 低于 REA 要求的 22.23.4，可能运行失败。请用 REA_NODE 指向更高版本。\n');
}

if (!cli) {
  process.stderr.write('[REA install] 未自动找到 rea.mjs。请设置 REA_CLI 后重试，或把 rea-agents 装到 PATH。\n');
  process.exit(1);
}
const cfg = { cli, node, detectedAt: new Date().toISOString() };
const out = path.join(__dirname, 'rea-path.json');
fs.writeFileSync(out, JSON.stringify(cfg, null, 2), 'utf8');
console.log('[REA install] 已写入 ' + out);
console.log('  cli : ' + cli);
console.log('  node: ' + node + ' (' + nodeVer + ')');
