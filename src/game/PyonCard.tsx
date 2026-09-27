import { useEffect, useState } from 'react'
import { FrogMascot } from '../components/FrogMascot'
import { todayKp } from './pyon'
import './pyon.css'

export function PyonCard({ onPlay }: { onPlay: () => void }) {
  const [today, setToday] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const load = () => todayKp().then(value => { if (active) { setToday(value); setFailed(false) } }).catch(() => { if (active) setFailed(true) })
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  return <section className="pyon-card paper-card"><h2>KPをふやす</h2><div className="pyon-card-title"><FrogMascot size={64} /><div><h3>ぴょんぴょん</h3><p>ハスをわたって、KPをゲット！</p></div></div>
    {failed ? <p role="status">ゲームに接続できません。DBの追加migration・通信状態を確認してください。</p> : <p>今日 {today ?? '…'} / 30 KP · あと {today === null ? '…' : Math.max(0, 30-today)} KP</p>}
    {today !== null && today >= 30 && <p>今日のKPはぜんぶゲットしたよ！<br />まだまだぴょんぴょんできるよ🐸</p>}
    <button className="primary-button" onClick={onPlay} disabled={failed || today === null}>あそぶ！</button>
  </section>
}
