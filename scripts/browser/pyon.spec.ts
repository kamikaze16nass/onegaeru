import { test, expect } from '@playwright/test'

for (const width of [375,390,430,1024]) {
  test(`lane controls, retry, timeout and layout at ${width}px`, async ({page}) => {
    page.on('pageerror', error => console.error(error.message))
    await page.setViewportSize({width,height:812})
    let moves=0, starts=0, dropped=false
    let run: Record<string,unknown>
    await page.route('**/rest/v1/rpc/*', async route => {
      const method=route.request().url().split('/').pop()
      const args=route.request().postDataJSON()
      if (method==='pyon_start') {
        starts++
        run={id:args.run_id,score:0,picked:0,stage:[{kind:'safe',kp:true},{kind:'hole',kp:false}],state:'playing',reason:null,base:0,awarded:0,today:26,timeMs:2500,rules:{jumpMs:240,playCap:10,dailyCap:30}}
      } else {
        moves++
        if (args.lane===0 && args.expected_score===0 && run!.score===0) {
          run={...run!,score:1,picked:1,stage:[{kind:'water',kp:false},{kind:'safe',kp:false}]}
          // Simulate committed move whose response was lost.
          if (!dropped) { dropped=true; await route.abort(); return }
        } else if (args.expected_score===run!.score) {
          run={...run!,state:'gameOver',reason:'timeout',base:2,awarded:3,today:29}
        }
      }
      await route.fulfill({json:run!})
    })
    await page.route('**/pyon-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
      const {default:React}=await import('/node_modules/.vite/deps/react.js'); const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      await import('/src/style.css'); await import('/src/mascot.css'); const {PyonGame}=await import('/src/game/PyonGame.tsx');
      createRoot(document.getElementById('root')).render(React.createElement(PyonGame,{onBack:()=>{},onReward:()=>{}}));</script></body></html>`}))
    await page.goto('/pyon-test')
    await page.getByRole('button',{name:'あそぶ！'}).click()
    const left=page.getByRole('button',{name:'← 左',exact:true})
    await expect(left).toBeEnabled()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBeTruthy()
    await page.screenshot({path:`test-results/pyon-${width}.png`})
    const box=await left.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(70)
    if (width===375) await left.click()
    else await page.keyboard.press('a')
    await expect(page.locator('.pyon-field')).toHaveAttribute('data-motion','jump')
    await expect(left).toBeDisabled()
    await expect(page.locator('[data-pose]')).toHaveAttribute('data-pose','frog_jump_straight')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('button',{name:'通信を再確認'})).toBeVisible()
    expect(moves).toBe(1)
    await page.getByRole('button',{name:'通信を再確認'}).click()
    await expect(page.getByText('ひろった 1 KP')).toBeVisible()
    await expect(left).toBeEnabled()
    expect(moves).toBe(2)
    await expect(page.locator('.pyon-field')).toHaveAttribute('data-motion','idle')
    await expect(page.getByRole('heading',{name:'1ぴょん！'})).toBeVisible({timeout:6000})
    await expect(page.getByText('+3 KP')).toBeVisible()
    expect(moves).toBe(3)
    expect(starts).toBe(1)
    await page.getByRole('button',{name:'もう一回！'}).click()
    await expect(page.getByRole('button',{name:'あそぶ！'})).toBeVisible()
  })
}

test('arrival, camera travel, directions and dangerous landing', async ({page}) => {
  await page.setViewportSize({width:390,height:812})
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  let moves=0
  const stage=[{kind:'safe',kp:false},{kind:'safe',kp:false}]
  await page.route('**/rest/v1/rpc/*', async route => {
    const start=route.request().url().endsWith('pyon_start')
    if (!start) moves++
    await route.fulfill({json:{id:'animation-run',score:Math.min(moves,3),picked:0,
      stage:moves===3 ? [{kind:'hole',kp:false},{kind:'safe',kp:false}] : stage,
      state:moves===4 ? 'gameOver' : 'playing',reason:moves===4 ? 'hole' : null,
      base:2,awarded:2,today:2,timeMs:2500,rules:{jumpMs:240,playCap:10,dailyCap:30}}})
  })
    await page.route('**/pyon-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
      const {default:React}=await import('/node_modules/.vite/deps/react.js'); const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      await import('/src/style.css'); await import('/src/mascot.css'); const {PyonGame}=await import('/src/game/PyonGame.tsx');
      createRoot(document.getElementById('root')).render(React.createElement(PyonGame,{onBack:()=>{},onReward:()=>{}}));</script></body></html>`}))

  await page.goto('/pyon-test')
  await page.getByRole('button',{name:'あそぶ！'}).click()
  const field=page.locator('.pyon-field')
  const left=page.getByRole('button',{name:'← 左',exact:true})
  const right=page.getByRole('button',{name:'右 →',exact:true})
  for (const [button,pose] of [[right,'right'],[right,'straight'],[left,'left']] as const) {
    await expect(button).toBeEnabled()
    const before=moves
    await button.click()
    await expect(page.locator('[data-pose]')).toHaveAttribute('data-pose',`frog_jump_${pose}`)
    expect(moves).toBe(before)
    await page.keyboard.press('d')
    await page.clock.runFor(320)
    await expect(page.locator('.pyon-heading>strong')).toContainText(`${before+1}`)
    await page.clock.runFor(64)
    await expect(field).toHaveAttribute('data-motion','advance')
    await expect(left).toBeDisabled()
    await page.clock.runFor(200)
    await expect(left).toBeEnabled()
    expect(moves).toBe(before+1)
    await page.clock.runFor(2400)
    await expect(left).toBeEnabled()
    expect(moves).toBe(before+1)
  }
  await left.click()
  await expect(field).toHaveAttribute('data-motion','jump')
  await expect(page.getByRole('heading',{name:'3ぴょん！'})).toHaveCount(0)
  await page.clock.runFor(320)
  await expect(field).toHaveAttribute('data-motion','fall')
  await page.clock.runFor(200)
  await expect(page.getByRole('heading',{name:'3ぴょん！'})).toBeVisible()
  expect(moves).toBe(4)
})
