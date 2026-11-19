// Optional browser regressions. Run only against an isolated, disposable DB.
const assert = require('node:assert/strict');
const baseURL = process.env.MUSCLE_E2E_URL;
assert.equal(process.env.MUSCLE_E2E_ALLOW_WRITES, '1', 'Use a disposable DB and set MUSCLE_E2E_ALLOW_WRITES=1');
assert.ok(baseURL, 'Set MUSCLE_E2E_URL to the isolated local Next.js server');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname), 'Only loopback test servers are allowed');
const cases = ['onboarding', 'dates', 'workout-network', 'workout-pending', 'empty', 'success-flow', 'other-failures', 'responsive'];
if (!process.argv[2]) {
  for (const name of cases) {
    const result = require('node:child_process').spawnSync(process.execPath, [__filename, name], { env: process.env, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  process.exit(0);
}
assert.ok(cases.includes(process.argv[2]), 'Unknown browser test case');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const context = await browser.newContext({baseURL,timezoneId:'Asia/Tokyo'});
    const credentials = {name:'QA',email:`qa-${require('node:crypto').randomUUID()}@example.invalid`,password:require('node:crypto').randomUUID()};
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    if (process.argv[2] === 'onboarding') {
      await page.goto('/login');
      await page.getByRole('button',{name:'新規登録',exact:true}).click();
      await page.locator('[name=name]').fill(credentials.name);
      await page.locator('[name=email]').fill(credentials.email);
      await page.locator('[name=password]').fill(credentials.password);
      await page.locator('[name=heightCm]').fill('174');
      await page.locator('[name=weightKg]').fill('68.5');
      assert.equal(await page.locator('[name=bodyFatRate]').inputValue(),'');
      await page.getByRole('button',{name:'アカウントを作成する',exact:true}).click();
      await page.waitForURL(url=>url.pathname==='/');
      await page.getByRole('img',{name:'身体データを反映したアバター'}).waitFor();
      assert.equal(await page.locator('.home-measurements dd').allTextContents().then(a=>a.join('|')),'174 cm|68.5 kg|未測定');
      const profile=await (await context.request.get('/api/body-profile')).json();
      assert.deepEqual(profile,{heightCm:174,weightKg:68.5,bodyFatRate:null,latestMetric:null});
      await page.getByRole('link',{name:/週間メニューを組む/}).click();
      await page.waitForURL('**/plan');
      await page.getByRole('link',{name:'ホーム',exact:true}).click();
      await page.waitForURL(url=>url.pathname==='/');
      await page.getByRole('link',{name:/目標ボディを設定する/}).click();
      await page.waitForURL('**/goal');
      await page.locator('[name=targetWeightKg]').fill('65');
      await page.locator('[name=targetBodyFatRate]').fill('20');
      await page.locator('[name=trainingDays]').selectOption('3');
      await page.locator('[name=equipment]').selectOption('dumbbells');
      assert.equal(await page.getByTestId('goal-reasoning').getAttribute('data-focus'),'general');
      assert.equal(await page.getByTestId('goal-menu').locator('[data-weekday]').count(),3);
      assert.equal(await page.getByTestId('goal-composition').count(),0);
      await page.getByRole('button',{name:'目標を保存',exact:true}).click();
      await page.getByTestId('goal-save-success').waitFor();
      const goals=await (await context.request.get('/api/body-goal')).json();
      assert.deepEqual(goals.goal,{targetWeightKg:65,targetBodyFatRate:20,trainingDays:3,equipment:'dumbbells'});
      await page.reload();
      assert.equal(await page.locator('[name=targetWeightKg]').inputValue(),'65');
      assert.equal(await page.getByTestId('goal-save-state').innerText(),'保存済み');
      await page.locator('[name=targetBodyFatRate]').fill('10');
      assert.equal(await page.getByTestId('goal-reasoning').getAttribute('data-focus'),'caution');
      assert.equal(await page.getByTestId('goal-menu').count(),0);
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.goto('/');
      await page.getByRole('img',{name:'身体データを反映したアバター'}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);
      console.log('PASS onboarding');
      return;
    }
    const register = await context.request.post('/api/auth/register', { data: {...credentials,heightCm:174,weightKg:68,bodyFatRate:22} });
    assert.equal(register.ok(),true,await register.text());
    await page.goto('/dashboard');
    await page.locator('#workout-date').waitFor();
    if (process.argv[2] === 'dates') {
      await page.waitForTimeout(500);
      const today = await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
      assert.equal(await page.locator('#workout-date').inputValue(),today,'workout defaults to local today');
      assert.equal(await page.locator('#metric-date').inputValue(),today,'body metric defaults to local today');
    }
    if (process.argv[2] === 'workout-network') {
      const form = page.locator('form').filter({has:page.locator('#workout-date')});
      await form.locator('[name=exerciseId]').selectOption({index:1});
      await form.locator('[name=weightKg]').fill('60');
      await form.locator('[name=reps]').fill('10');
      await form.locator('[name=sets]').fill('3');
      await form.locator('[name=memo]').fill('保持するメモ');
      await page.route('**/api/workouts',r=>r.abort('failed'));
      await form.locator('button[type=submit]').click();
      await page.locator('.error-text[role=alert]').waitFor({timeout:5000});
      assert.match(await page.locator('.error-text[role=alert]').textContent(),/通信/);
      assert.equal(await form.locator('[name=weightKg]').inputValue(),'60');
      assert.equal(await form.locator('[name=memo]').inputValue(),'保持するメモ');
      assert.equal(await form.locator('button[type=submit]').isEnabled(),true);
    }
    if (process.argv[2] === 'workout-pending') {
      const form=page.locator('form').filter({has:page.locator('#workout-date')});
      await form.locator('[name=exerciseId]').selectOption({index:1});
      await form.locator('[name=weightKg]').fill('60');
      await form.locator('[name=reps]').fill('10');
      await form.locator('[name=sets]').fill('3');
      let count=0;
      let release; const delayed=new Promise(r=>release=r);
      await page.route('**/api/workouts',async r=>{count++; await delayed; await r.continue();});
      await form.evaluate(f=>{f.requestSubmit();f.requestSubmit();});
      await page.waitForTimeout(500);
      const disabled=await form.locator('[name=weightKg]').isDisabled();
      release();
      assert.equal(count,1,'same-tick submits send one request');
      assert.equal(disabled,true,'inputs locked while saving to avoid lost edits');
      await page.getByRole('status').filter({hasText:'筋トレ記録を保存しました'}).waitFor();
      const data=await (await context.request.get('/api/dashboard')).json();
      assert.equal(data.workouts.length,1,'exactly one persisted record');
    }
    if (process.argv[2] === 'empty') {
      assert.equal(await page.getByText('まだ筋トレ記録がありません。').count(),1);
      assert.equal(await page.getByRole('link',{name:'最初の筋トレを記録する'}).count(),1);
      assert.equal(await page.getByText('まだ身体データがありません。').count(),1);
      assert.equal(await page.locator('#weightKg').count(),1,'label targets are unique');
    }
    if (process.argv[2] === 'success-flow') {
      const workout=page.locator('form').filter({has:page.locator('#workout-date')});
      await workout.locator('[name=date]').fill('2026-01-02');
      await workout.locator('[name=exerciseId]').selectOption({index:1});
      await workout.locator('[name=weightKg]').fill('60');
      await workout.locator('[name=reps]').fill('10');
      await workout.locator('[name=sets]').fill('3');
      await workout.locator('button[type=submit]').click();
      await page.getByRole('status').filter({hasText:'筋トレ記録を保存しました'}).waitFor();
      assert.equal(await workout.locator('[name=date]').inputValue(),'2026-01-02');
      assert.equal(await workout.locator('[name=weightKg]').inputValue(),'');
      const metric=page.locator('form').filter({has:page.locator('#metric-date')});
      await metric.locator('[name=date]').fill('2026-01-02');
      await metric.locator('[name=weightKg]').fill('70');
      await metric.locator('[name=muscleMassKg]').fill('30');
      await metric.locator('button[type=submit]').click();
      await page.getByRole('status').filter({hasText:'身体情報を保存しました'}).waitFor();
      assert.equal(await metric.locator('[name=date]').inputValue(),'2026-01-02');
      const data=await (await context.request.get('/api/dashboard')).json();
      assert.equal(data.workouts.length,1);
      assert.equal(data.workouts[0].weightKg,60);
      assert.equal(data.bodyMetrics.length,1);
      assert.equal(data.bodyMetrics[0].muscleMassKg,30);
      await page.goto('/plan');
      await page.getByText('筋肉量の記録・試算（任意）', {exact:true}).click();
      await page.getByLabel('試算期間').selectOption('6');
      await page.getByRole('button',{name:'週間プランを保存',exact:true}).click();
      await page.getByRole('status').filter({hasText:'週間プランを保存しました'}).waitFor();
      const plan=await (await context.request.get('/api/weekly-plan')).json();
      assert.equal(plan.settings.months,6);
      await page.getByRole('button',{name:'ログアウト',exact:true}).click();
      await page.waitForURL('**/login');
      assert.equal((await context.request.get('/api/auth/me')).status(),401);
      await page.locator('[name=email]').fill(credentials.email);
      await page.locator('[name=password]').fill(credentials.password);
      await page.locator('button[type=submit]').click();
      await page.waitForURL(url=>url.pathname==='/');
      assert.equal((await context.request.get('/api/auth/me')).status(),200);
    }
    if (process.argv[2] === 'responsive') {
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:require('node:path').join(process.env.MUSCLE_E2E_SCREENSHOTS || require('node:os').tmpdir(),'dashboard-mobile.png'),fullPage:true});
      await page.locator('section').filter({has:page.locator('#workout-date')}).screenshot({path:require('node:path').join(process.env.MUSCLE_E2E_SCREENSHOTS || require('node:os').tmpdir(),'dashboard-form.png')});
      await page.locator('section').filter({has:page.getByRole('heading',{name:'最近の筋トレ記録',exact:true})}).screenshot({path:require('node:path').join(process.env.MUSCLE_E2E_SCREENSHOTS || require('node:os').tmpdir(),'dashboard-empty.png')});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile has no horizontal overflow');
    }
    if (process.argv[2] === 'other-failures') {
      const failures=[];
      const check=async(name,fn)=>{try{await fn();console.log('PASS',name);}catch(e){failures.push(name+': '+e.message);}};
      await check('body-network',async()=>{
        const form=page.locator('form').filter({has:page.locator('#metric-date')});
        await form.locator('[name=weightKg]').fill('70');
        await page.route('**/api/body-metrics',r=>r.abort('failed'));
        await form.locator('button[type=submit]').click();
        await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('通信')),{},{timeout:3000});
        assert.equal(await form.locator('[name=weightKg]').inputValue(),'70');
      });
      await page.goto('/plan').catch(()=>page.goto('/plan'));
      await page.getByRole('button',{name:'週間プランを保存',exact:true}).waitFor();
      await check('plan-html-error',async()=>{
        await page.route('**/api/weekly-plan',r=>r.request().method()==='PUT'?r.fulfill({status:502,contentType:'text/html',body:'<h1>Bad gateway</h1>'}):r.continue());
        await page.getByRole('button',{name:'週間プランを保存',exact:true}).click();
        await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('502')),{},{timeout:3000});
      });
      await check('logout-network',async()=>{
        await page.route('**/api/auth/logout',r=>r.abort('failed'));
        await page.getByRole('button',{name:'ログアウト',exact:true}).click();
        await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('通信')),{},{timeout:3000});
        assert.match(page.url(),/\/plan$/);
      });
      const anon=await browser.newContext({baseURL});
      const login=await anon.newPage(); login.setDefaultTimeout(5000);
      await login.goto('/login');
      await check('auth-network',async()=>{
        await login.locator('[name=email]').fill('invalid@example.invalid');
        await login.locator('[name=password]').fill(require('node:crypto').randomUUID());
        await login.route('**/api/auth/login',r=>r.abort('failed'));
        await login.locator('button[type=submit]').click();
        await login.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('通信')),{},{timeout:3000});
        assert.equal(await login.locator('[name=email]').inputValue(),'invalid@example.invalid');
      });
      assert.deepEqual(failures,[]);
    }
    assert.deepEqual(errors,[], 'no uncaught client errors');
    console.log('PASS',process.argv[2]);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
