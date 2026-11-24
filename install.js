'use strict';
/**
 * REA 按需插件 —— 本机安装适配器（零硬编码，动态自寻找）。
 * 自动探测本机 rea CLI 与可用 Node，生成 rea-path.json（仅本机、不分发）。
 * 探测顺序：REA_CLI/REA_HOME/REA_NODE 环境变量 > PATH(where/which rea)
 *           > npm 全局根 > 主目录标准路径。别人机器无需本脚本也能用（hook 走 PATH 回退）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';

function run(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8' }).trim(); } catch (_) { return ''; }
}

// —— 自寻找 rea CLI（rea.mjs）——
function findCLI() {
  if (process.env.REA_CLI && fs.existsSync(process.env.REA_CLI)) return process.env.REA_CLI;

  // 1) PATH 上的 rea（where/which）
  const found = run(IS_WIN ? 'where' : 'which', ['rea']);
  for (const line of found.split(/\r?\n/)) {
    const p = line.trim();
    if (!p || !fs.existsSync(p)) continue;
    // rea 可执行可能直接是 CLI，也可能是包装脚本；尝试解析其真实 mjs
    const candidates = [
      p,
      path.join(path.dirname(p), 'rea-agents', 'scripts', 'rea.mjs'),
      path.resolve(path.dirname(p), '..', 'rea-agents', 'scripts', 'rea.mjs'),
    ];
    for (const c of candidates) if (fs.existsSync(c) && /rea(\.mjs|\.js)?$/.test(path.basename(c))) return c;
  }

  // 2) npm 全局根
  const gRoot = run('npm', ['root', '-g']);
  if (gRoot) {
    const c = path.join(gRoot.trim(), 'rea-agents', 'scripts', 'rea.mjs');
    if (fs.existsSync(c)) return c;
  }

  // 3) REA_HOME
  if (process.env.REA_HOME) {
    const c = path.join(process.env.REA_HOME, 'rea-agents', 'scripts', 'rea.mjs');
    if (fs.existsSync(c)) return c;
  }

  // 4) 主目录标准路径
  for (const base of ['.rea', 'rea', path.join('.local', 'share', 'rea')]) {
    const c = path.join(HOME, base, 'rea-agents', 'scripts', 'rea.mjs');
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// —— 自寻找 Node（>=22.23.4）——
function nodeVersion(p) {
  try { return execFileSync(p, ['--version'], { encoding: 'utf8' }).trim(); } catch (_) { return ''; }
}
function versionOK(v) {
  const m = (v || '').match(/v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const [maj, min, patch] = [+m[1], +m[2], +m[3]];
  return maj > 22 || (maj === 22 && (min > 23 || (min === 23 && patch >= 4)));
}
function findNode() {
  if (process.env.REA_NODE && fs.existsSync(process.env.REA_NODE)) return process.env.REA_NODE;
  const sys = process.execPath;
  if (versionOK(nodeVersion(sys))) return sys; // 系统 node 够新就直接用
  const cands = [
    path.join(HOME, '.rea', 'node', IS_WIN ? 'node.exe' : 'bin/node'),
    path.join(HOME, '.nvm', 'versions', 'node'),
  ].filter(Boolean);
  for (const p of cands) {
    if (fs.existsSync(p) && versionOK(nodeVersion(p))) return p;
  }
  return sys;
}

const cli = findCLI();
const node = findNode();
const nodeVer = nodeVersion(node);
if (!versionOK(nodeVer)) {
  process.stderr.write('[REA install] 警告：Node ' + nodeVer + ' 低于 REA 要求的 22.23.4，可能运行失败。请用 REA_NODE 指向更高版本。\n');
}
if (!cli) {
  process.stderr.write('[REA install] 未自动找到 rea.mjs。请用 REA_CLI 指定，或 npm i -g rea-agents 后重试。\n');
  process.exit(1);
}
const cfg = { cli, node, detectedAt: new Date().toISOString() };
const out = path.join(__dirname, 'rea-path.json');
fs.writeFileSync(out, JSON.stringify(cfg, null, 2), 'utf8');
console.log('[REA install] 已写入 ' + out);
console.log('  cli : ' + cli);
console.log('  node: ' + node + ' (' + nodeVer + ')');
