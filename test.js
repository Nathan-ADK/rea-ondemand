'use strict';
const { spawnSync } = require('child_process');
const hook = 'E:/AI-项目/rea-ondemand/hook.js';
function run(prompt) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt }),
    encoding: 'utf8'
  });
  try { return JSON.parse(r.stdout); } catch (_) { return { raw: r.stdout }; }
}
const cases = [
  ['普通任务-中文', '帮我写个排序函数', false],
  ['非hook事件', 'hello', false],
  ['普通任务-英文', 'fix the login bug please', false],
  ['空提示', '', false],
  ['逆向-中文反编译', '帮我反编译这个 exe', true],
  ['逆向-英文', 'please reverse engineer this binary', true],
  ['逆向-decompile', 'decompile this apk for me', true],
  ['逆向-分析bundle', '分析这个 web bundle', true],
  ['逆向-rea关键字', '用 rea 看看这个样本', true],
  ['误触发-反向销售', '反向推动销售增长策略', false]
];
let pass = 0, fail = 0;
for (const [name, prompt, wantInject] of cases) {
  const o = run(prompt);
  const injected = !!(o.hookSpecificOutput && o.hookSpecificOutput.additionalContext);
  const ok = injected === wantInject;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  inject=' + injected + (ok ? '' : ' (want ' + wantInject + ')'));
  ok ? pass++ : fail++;
}
// 非 hook 事件应静默
const o2 = (() => {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: 'Stop' }), encoding: 'utf8'
  });
  try { return JSON.parse(r.stdout); } catch (_) { return {}; }
})();
const ok2 = o2.continue === true && !o2.hookSpecificOutput;
console.log((ok2 ? 'PASS' : 'FAIL') + '  非UserPromptSubmit事件静默');
ok2 ? pass++ : fail++;
console.log('[REA hook] ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
