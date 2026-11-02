import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('runtime data workflow never executes or publishes code from the data branch', () => {
  const root = mkdtempSync(join(tmpdir(), 'bombim-data-isolation-'));
  const remote = join(root, 'remote.git');
  const seed = join(root, 'seed');
  const runner = join(root, 'runner');
  const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']});
  const put = (cwd,path,value) => { mkdirSync(join(cwd,path,'..'),{recursive:true}); writeFileSync(join(cwd,path),value); };
  try {
    git(root,'init','--bare',remote); git(root,'clone',remote,seed);
    git(seed,'config','user.email','test@example.invalid'); git(seed,'config','user.name','Test');
    git(seed,'checkout','-b','main');
    for (const path of ['config/settings.json','data/all_lotteries.json','lottery_previous_results.json','status/status.json']) put(seed,path,'{}');
    put(seed,'lottery_checker.py','reviewed-main-code');
    git(seed,'add','.'); git(seed,'commit','-m','seed'); git(seed,'push','origin','main');
    git(seed,'checkout','-b','runtime-live');
    put(seed,'lottery_checker.py','unreviewed-data-branch-code');
    put(seed,'config/settings.json','{"runtime":true}');
    git(seed,'add','.');git(seed,'commit','-m','data config');git(seed,'push','origin','runtime-live');
    git(root,'clone','--branch','main',remote,runner);
    const yaml=readFileSync(new URL('../.github/workflows/lottery.yml',import.meta.url),'utf8');
    const script = name => {
      const step=yaml.split(`      - name: ${name}\n`)[1];
      assert.ok(step,`missing workflow step: ${name}`);
      return step.split('        run: |\n')[1].split(/\n      - name:/)[0].split('\n').map(l=>l.startsWith('          ')?l.slice(10):l).join('\n');
    };
    execFileSync('bash',['-c',script('Load runtime data without replacing reviewed application code')],{cwd:runner,stdio:'pipe'});
    assert.equal(readFileSync(join(runner,'lottery_checker.py'),'utf8'),'reviewed-main-code');
    assert.deepEqual(JSON.parse(readFileSync(join(runner,'config/settings.json'),'utf8')),{runtime:true});
    const mainBefore=git(runner,'rev-parse','origin/main').trim();
    put(runner,'status/status.json','{"checks":1}');put(runner,'lottery_previous_results.json','[{"result":"007-00"}]');
    execFileSync('bash',['-c',script('Commit only results to the runtime data branch')],{cwd:runner,stdio:'pipe'});
    git(runner,'fetch','origin','main','runtime-live');
    assert.equal(git(runner,'rev-parse','origin/main').trim(),mainBefore);
    assert.equal(git(runner,'show','origin/runtime-live:lottery_checker.py'),'unreviewed-data-branch-code');
    assert.deepEqual(JSON.parse(git(runner,'show','origin/runtime-live:status/status.json')),{checks:1});
    assert.deepEqual(JSON.parse(git(runner,'show','origin/runtime-live:config/settings.json')),{runtime:true});
    assert.deepEqual(git(runner,'diff-tree','--no-commit-id','--name-only','-r','origin/runtime-live').trim().split('\n').sort(),['lottery_previous_results.json','status/status.json']);
  } finally {rmSync(root,{recursive:true,force:true});}
});
