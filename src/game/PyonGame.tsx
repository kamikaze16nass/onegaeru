import { useCallback, useEffect, useRef, useState } from 'react'
import { moveRun, startRun, type Lane, type Phase, type Run } from './pyon'
import { PyonField } from './PyonArt'
import { createPyonRunId } from './pyonRunId'
import { ADVANCE_MS, FALL_MS, JUMP_MS, LAND_MS, type Motion } from './pyonMotion'
import './pyon.css'

export function PyonGame({ onBack, onReward }: { onBack: () => void; onReward: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [run, setRun] = useState<Run | null>(null)
  const [lane, setLane] = useState<Lane>(0)
  const [target, setTarget] = useState<Lane>(0)
  const [motion, setMotion] = useState<Motion>('idle')
  const [progress, setProgress] = useState(0)
  const [scene, setScene] = useState<Run | null>(null)
  const frame = useRef(0)
  const [picked, setPicked] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const deadline = useRef(0)
  const live = useRef(true)
  const retry = useRef<null | (() => Promise<void>)>(null)
  const [initialId] = useState(createPyonRunId)
  const startId = useRef(initialId)
  useEffect(() => { live.current = true; return () => { live.current = false; cancelAnimationFrame(frame.current) } }, [])

  const animate = useCallback((kind: Motion, duration: number) => new Promise<void>(resolve => {
    setMotion(kind); setProgress(0)
    const began = performance.now()
    const tick = (now: number) => {
      if (!live.current) return
      const value = Math.min(1, (now - began) / duration)
      setProgress(value)
      if (value < 1) frame.current = requestAnimationFrame(tick)
      else resolve()
    }
    frame.current = requestAnimationFrame(tick)
  }), [])

  const execute = useCallback(async (operation: () => Promise<void>) => {
    retry.current = operation
    setBusy(true); setError('')
    try { await operation(); retry.current = null }
    catch { if (live.current) setError('通信を確認できませんでした。同じ操作を再確認できます（KPは重複しません）。') }
    finally { if (live.current) setBusy(false) }
  }, [])

  const start = () => {
    if (lock.current) return
    lock.current = true
    void execute(async () => {
      const next = await startRun(startId.current)
      if (!live.current) return
      setRun(next); setScene(next); setMotion('idle'); setLane(0); setTarget(0); setPicked(false)
      deadline.current = performance.now() + next.timeMs
      setPhase(next.state); lock.current = next.state === 'gameOver'
    })
  }

  const choose = useCallback((requested: Lane | -1) => {
    if (lock.current || phase !== 'playing' || !run) return
    lock.current = true
    const direction = performance.now() >= deadline.current ? -1 : requested
    setTarget(direction === -1 ? lane : direction)
    setPhase('jumping'); setPicked(false)
    // Finish the visible arrival once; a retry only repeats the idempotent RPC.
    void (async () => {
      await animate(direction === -1 ? 'sink' : 'jump', direction === -1 ? FALL_MS : Math.max(JUMP_MS, run.rules.jumpMs))
      if (!live.current) return
      setMotion(direction === -1 ? 'sink' : 'land')
      await execute(async () => {
        const next = await moveRun(run, direction)
        if (!live.current) return
        setPicked(next.picked > run.picked)
        setRun(next)
        if (next.state === 'gameOver') {
          if (direction !== -1) await animate('fall', FALL_MS)
        } else {
          await animate('land', LAND_MS)
          await animate('advance', ADVANCE_MS)
        }
        if (!live.current) return
        setScene(next)
        if (direction !== -1) setLane(direction)
        setMotion('idle')
        deadline.current = performance.now() + next.timeMs
        setPhase(next.state)
        lock.current = next.state === 'gameOver'
        if (next.state === 'gameOver') onReward()
      })
    })()
  }, [animate, execute, lane, onReward, phase, run])

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setTimeout(() => choose(-1), Math.max(0, deadline.current - performance.now()))
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const value = event.key.toLowerCase()
      if (['arrowleft', 'a', 'arrowright', 'd'].includes(value)) {
        event.preventDefault(); choose(value === 'arrowleft' || value === 'a' ? 0 : 1)
      }
    }
    const visibility = () => { if (document.visibilityState === 'visible' && performance.now() >= deadline.current) choose(-1) }
    window.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', visibility)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility) }
  }, [choose, phase])

  return <main className={`pyon-page ${phase === 'playing' || phase === 'jumping' ? 'pyon-page--active' : ''} ${error ? 'pyon-page--error' : ''}`}>
    <header className="pyon-heading"><div><p className="eyebrow">KPをふやす</p><h1>ぴょんぴょん</h1></div><strong>{run?.score ?? 0}<small> ぴょん</small></strong></header>
    {phase === 'ready' && <section className="paper-card pyon-intro">
      <h2>ハスをわたって、どこまでも。</h2><p>次に着地する「左」「右」をえらぼう。穴・水・天敵はさけてね。</p>
      <p>ハスが沈むまえにジャンプ！ 安全なハスの1KPもひろえるよ。</p>
      <p className="muted">1プレイ最大10KP・1日最大30KP（日本時間）<br />PCは ← → / A D でもあそべます。</p>
      <button className="primary-button" disabled={busy || !!error} onClick={start}>{busy ? '準備中…' : 'あそぶ！'}</button>
    </section>}
    {(phase === 'playing' || phase === 'jumping') && run && <>
      <div className="pyon-stats"><span>ひろった {run.picked} KP</span><span>今日 {run.today} / 30 KP</span></div>
      <PyonField step={(scene ?? run).score} runKey={`${run.id}-${run.score}`} stage={(scene ?? run).stage} nextStage={run.stage} motion={motion} progress={progress} lane={lane} target={target} phase={phase} timeMs={run.timeMs} picked={picked} />
      <p className="pyon-hint" role="status">{phase === 'jumping' ? 'ぴょん！ 着地を確認中…' : 'あんしんのハスへ、左？ 右？'}</p>
      <div className="pyon-controls"><button disabled={phase !== 'playing'} onClick={() => choose(0)}>← 左</button><button disabled={phase !== 'playing'} onClick={() => choose(1)}>右 →</button></div>
    </>}
    {phase === 'gameOver' && run && <section className="paper-card pyon-result" aria-live="polite">
      <h2>{run.score}ぴょん！</h2><p>{run.reason === 'timeout' ? 'ハスが沈んじゃった！' : 'ぽちゃん！ また挑戦しよう'}</p>
      <dl><div><dt>基本報酬</dt><dd>+{run.base} KP</dd></div><div><dt>ひろったKP</dt><dd>+{run.picked} KP</dd></div><div className="pyon-earned"><dt>今回ゲット！</dt><dd>+{run.awarded} KP</dd></div><div><dt>今日</dt><dd>{run.today} / 30 KP</dd></div></dl>
      <p className="muted">1プレイ10KP・1日30KPまでの残りを反映しています。</p>
      {run.today >= 30 && <p>今日のKPはぜんぶゲットしたよ！<br />まだまだぴょんぴょんできるよ🐸</p>}
      <button className="primary-button" onClick={() => { startId.current = createPyonRunId(); lock.current = false; setRun(null); setPhase('ready') }}>もう一回！</button>
    </section>}
    {error && <div className="pyon-error" role="alert"><p>{error}</p><button className="secondary-button" disabled={busy} onClick={() => { if (retry.current) void execute(retry.current) }}>{busy ? '確認中…' : '通信を再確認'}</button></div>}
    {(phase === 'playing' || phase === 'jumping') && <button disabled={phase !== 'playing'} className="text-button" onClick={() => choose(-1)}>ここでおわる</button>}
    {(phase === 'ready' || phase === 'gameOver' || !!error) && <button className="secondary-button pyon-back" disabled={busy} onClick={onBack}>KP画面にもどる</button>}
  </main>
}
