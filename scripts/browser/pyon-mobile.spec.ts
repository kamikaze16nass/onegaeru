import { test, expect } from '@playwright/test'

test.use({ isMobile: true, hasTouch: true })
for (const width of [375, 390, 430]) {
  test(`LAN HTTP touch entry and play at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    const errors: string[] = []
    const ids: string[] = []
    const lanes: number[] = []
    let score = 0
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.includes('/rest/v1/rpc/')) {
        const method = url.pathname.split('/').pop()
        if (method === 'pyon_today') return route.fulfill({ json: 0 })
        const args = route.request().postDataJSON()
        if (method === 'pyon_start') { ids.push(args.run_id); score = 0 }
        else { lanes.push(args.lane); if (args.lane !== -1) score++ }
        return route.fulfill({ json: { id: args.run_id, score, picked: 0,
          stage: [{ kind: 'safe', kp: false }, { kind: 'safe', kp: false }],
          state: args.lane === -1 ? 'gameOver' : 'playing', reason: 'timeout',
          base: 0, awarded: 0, today: 0, timeMs: 10000, rules: { jumpMs: 240 } } })
      }
      if (url.hostname !== '192.0.2.1') return route.abort()
      if (url.pathname === '/mobile-test') return route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
        const {default:React}=await import('/node_modules/.vite/deps/react.js');
        const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {PyonCard}=await import('/src/game/PyonCard.tsx');
        const {PyonGame}=await import('/src/game/PyonGame.tsx');
        await import('/src/style.css'); await import('/src/mascot.css');
        class Entry extends React.Component {state={playing:false};render(){
          return this.state.playing ? React.createElement(PyonGame,{onBack:()=>this.setState({playing:false}),onReward:()=>{}})
            : React.createElement(PyonCard,{onPlay:()=>this.setState({playing:true})});}}
        createRoot(document.getElementById('root')).render(React.createElement(Entry));
        </script></body></html>` })
      // Real non-secure browser origin, locally served assets; no crypto overrides.
      url.hostname = '127.0.0.1'; url.port = '5178'
      return route.fulfill({ response: await route.fetch({ url: url.href }) })
    })
    await page.goto('http://192.0.2.1/mobile-test')
    expect(await page.evaluate(() => ({ secure: isSecureContext, uuid: typeof crypto.randomUUID })))
      .toEqual({ secure: false, uuid: 'undefined' })
    await page.getByRole('button', { name: 'あそぶ！' }).tap()
    await expect(page.locator('.pyon-intro')).toBeVisible()
    await page.getByRole('button', { name: 'あそぶ！' }).tap()
    await expect(page.locator('.pyon-field')).toBeVisible()
    await expect(page.locator('.pyon-bank-plane')).toHaveCount(2)
    await page.locator('.pyon-field img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
    const left = page.getByRole('button', { name: '← 左', exact: true })
    await left.tap()
    await expect(left).toBeEnabled()
    await page.getByRole('button', { name: '右 →', exact: true }).tap()
    await expect(left).toBeEnabled()
    expect(lanes).toEqual([0, 1])
    await page.setViewportSize({ width, height: 700 })
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBeTruthy()
    expect((await page.locator('.pyon-field').boundingBox())!.height).toBeGreaterThan(300)
    await page.getByRole('button', { name: 'ここでおわる' }).tap()
    await page.getByRole('button', { name: 'もう一回！' }).tap()
    await page.getByRole('button', { name: 'あそぶ！' }).tap()
    await expect(left).toBeEnabled()
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(errors).toEqual([])
  })
}
