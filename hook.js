'use strict';
/**
 * REA 按需插件（WBD 侧）—— 零常驻 token。
 *
 * 与 ctx-forge 完全独立：本插件只负责"REA 逆向能力按需可用"，
 * 不精简输出、不压缩上下文。
 *
 * 两种运行模式：
 *  1) 被 WorkBuddy 以 UserPromptSubmit 命令钩子调用（stdin 为 JSON）：
 *     平时静默放行（0 注入 = 0 token）；仅当输入命中"逆向需求"关键词时，
 *     才注入一次 REA 调用指引。用完即走，不驻留进程。
 *  2) `node hook.js --call <cmd> [args...]`：按需单次拉起 REA CLI。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function emit(o) {
  try { process.stdout.write(JSON.stringify(o)); }
  catch (_) { process.stdout.write('{"continue":true}'); }
}
function pass() { emit({ continue: true }); }
function inject(ctx) {
  emit({ continue: true, hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } });
}

// 命中才视为"有逆向需求"；平时不命中 → 0 注入（零常驻核心）。
const KW = /(?:逆向|反编译|反向工程|脱壳|加壳|静态重建|\brea\b|reverse[ -]?engineer|decompil|macho|analyze-(?:javascript-application|web-bundle)|web[\s-]*bundle|javascript[\s-]*application|分析\s*(?:exe|dll|so|dylib|二进制|样本|固件|bundle|程序|应用包))/i;

function findWrapper() {
  const c = [];
  if (process.env.REA_WRAPPER) c.push(process.env.REA_WRAPPER);
  c.push(path.join(__dirname, 'rea-on-demand.sh'));
  c.push(path.join(__dirname, 'bin', 'rea-on-demand.sh'));
  if (process.env.REA_HOME) c.push(path.join(process.env.REA_HOME, 'rea-on-demand.sh'));
  for (const x of c) { if (x && fs.existsSync(x)) return x; }
  return null;
}

function loadLocalConfig() {
  // 本机安装生成的适配文件（含 cli/node 绝对路径），不随发布包分发。
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'rea-path.json'), 'utf8')); }
  catch (_) { return {}; }
}

function callREA(argv) {
  const cfg = loadLocalConfig();
  let r = null, err = null;
  if (cfg.cli) {
    // 本机配置：用专用 node 跑 REA CLI（不依赖 bash）
    r = spawnSync(cfg.node || process.execPath, [cfg.cli, ...argv], { stdio: 'inherit' });
    err = r.error;
  } else if (process.env.REA_WRAPPER || findWrapper()) {
    const w = process.env.REA_WRAPPER || findWrapper();
    r = spawnSync('bash', [w, ...argv], { stdio: 'inherit' });
    err = r.error;
  } else {
    // 发布版通用回退：PATH 上的 rea（使用者 npm i -g rea-agents）
    r = spawnSync('rea', argv, { stdio: 'inherit', shell: process.platform === 'win32' });
    err = r.error;
  }
  if (!r || err) {
    process.stderr.write('[REA] 无法启动 REA。请用 install.js 生成 rea-path.json，或安装 rea-agents 到 PATH。\n');
    process.exit(127);
  }
  process.exit(r.status == null ? 1 : r.status);
}

function onPrompt(input) {
  const p = String(input.prompt || input.user_prompt || input.message || '');
  if (!KW.test(p)) return pass(); // 零常驻：不命中就 0 注入
  const self = path.join(__dirname, 'hook.js').replace(/\\/g, '/');
  const guide = [
    '[REA 按需已激活] 本轮涉及逆向分析，REA 仅此时可用。',
    '调用（按需单次进程，用完即走）：',
    '  node "' + self + '" --call capabilities        看能力',
    '  node "' + self + '" --call analyze <路径>       分析文件/应用',
    '  node "' + self + '" --call --help              全部命令',
    '非逆向任务忽略本提示；仅本轮注入，平时 0 token。'
  ].join('\n');
  return inject(guide);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--call') return callREA(argv.slice(1));
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) {}
  const ev = input.hook_event_name || '';
  if (ev === 'UserPromptSubmit') return onPrompt(input);
  return pass();
}
main();
