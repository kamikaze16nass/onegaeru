import { test, expect } from '@playwright/test'

for (const width of [375, 390, 430]) {
  test(`background continuity and parallax at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.route('**/background-test', route => route.fulfill({ contentType: 'text/html', body: `
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
      <div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
      const {default:React}=await import('/node_modules/.vite/deps/react.js');
      const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {default:{flushSync}}=await import('/node_modules/.vite/deps/react-dom.js');
      const {PyonBackground}=await import('/src/game/PyonBackground.tsx');
      await import('/src/game/pyon.css');
      document.body.style.margin='0';
      const root=createRoot(document.getElementById('root'));
      window.show=(step,motion)=>flushSync(()=>root.render(React.createElement('div',
        {style:{position:'relative',width:'100%',height:550}},React.createElement(PyonBackground,{step,motion}))));
      window.show(0,'idle');
      </script></body></html>` }))
    await page.goto('/background-test')
    await expect(page.locator('.pyon-bg-strip')).toHaveCount(3)
    await page.locator('.pyon-background img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
    const far = page.locator('.pyon-far-background')
    const farPosition = await far.boundingBox()
    await page.screenshot({ path: `test-results/pyon-background-${width}.png` })
    const snapshot = () => page.locator('.pyon-bg-strip img').evaluateAll(images => images.map(img => ({
      layer: img.closest('.pyon-bg-strip')!.className,
      id: img.getAttribute('data-tile'), src: img.getAttribute('src'), y: img.getBoundingClientRect().y,
    })))
    const show = (step: number, motion: string) => page.evaluate(({ step, motion }) => {
      (window as unknown as { show: (step: number, motion: string) => void }).show(step, motion)
    }, { step, motion })
    const variants = new Set<string>()
    const connections = new Set<string>()
    for (let step = 0; step < 50; step++) {
      const idle = await snapshot()
      const left = idle.filter(tile => tile.layer.endsWith('left'))
      for (let i = 0; i < left.length; i++) {
        const right = idle.find(tile => tile.layer.endsWith('right') && tile.id === left[i].id)!
        if (right) {
          expect(right.src).not.toBe(left[i].src)
          expect(right.y).toBeGreaterThan(left[i].y)
        }
        if (i) connections.add(`${left[i - 1].src?.includes('_a.') ? 'A' : 'B'}${left[i].src?.includes('_a.') ? 'A' : 'B'}`)
      }
      const phase = await page.locator('.pyon-background').evaluate(root => {
        const track = (side: string) => root.querySelector(`.pyon-bg-strip--${side} .pyon-bg-travel`) as HTMLElement
        const distance = (side: string) => {
          const el = track(side)
          const img = el.querySelector('img') as HTMLImageElement
          return parseFloat(el.style.getPropertyValue('--bg-from')) + parseFloat(img.style.top) + (Number(img.dataset.tile) + 1) * parseFloat(img.style.height)
        }
        const tileHeight = parseFloat((track('right').querySelector('img') as HTMLImageElement).style.height)
        return (distance('right') - distance('left')) / tileHeight
      })
      expect(phase).toBeCloseTo(0.35, 5)
      await show(step, 'jump')
      expect(await snapshot()).toEqual(idle)
      await show(step, 'advance')
      await page.locator('.pyon-bg-travel').evaluateAll(elements => {
        for (const element of elements) for (const animation of element.getAnimations()) animation.finish()
      })
      const end = await snapshot()
      for (const tile of end) {
        variants.add(tile.src!)
        const start = idle.find(old => old.layer === tile.layer && old.id === tile.id)!
        if (tile.layer.endsWith('water')) expect(tile.y - start.y).toBeCloseTo(18, 2)
        // Projected bank velocity varies with depth. The underlying travel stays 44px.
        else if (start.y >= 0 && start.y < 550) {
          expect(tile.y - start.y).toBeGreaterThan(30)
          expect(tile.y - start.y).toBeLessThan(60)
        }
      }
      await show(step + 1, 'idle')
      expect(await far.boundingBox()).toEqual(farPosition)
      const next = await snapshot()
      for (const tile of end.filter(tile => tile.y >= 0 && tile.y < 550)) {
        const same = next.find(other => other.layer === tile.layer && other.id === tile.id)!
        expect(same.src).toBe(tile.src)
        expect(Math.abs(same.y - tile.y)).toBeLessThan(1 / 64 + 0.001)
      }
      expect(next.length).toBeLessThan(30)
    }
    expect(variants.size).toBe(3)
    expect([...connections].sort()).toEqual(['AA', 'AB', 'BA', 'BB'])
    expect(await page.locator('.pyon-bg-strip--right img').first().evaluate(el => getComputedStyle(el).transform)).toBe('matrix(-1, 0, 0, 1, 0, 0)')
    expect(await page.locator('.pyon-background').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  })
}
