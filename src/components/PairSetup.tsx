import { useState } from 'react'
import { createPair, joinPair, readableError } from '../lib/api'
import { FrogMascot } from './FrogMascot'

export function PairSetup({ inviteCode, onChanged }: { inviteCode?: string; onChanged: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); await onChanged() } catch (e) { setError(readableError(e)) } finally { setBusy(false) }
  }

  if (inviteCode) return (
    <main className="center-page">
      <FrogMascot size={110} />
      <p className="eyebrow">相手を待っています</p>
      <h1>このコードを相手に送ろう</h1>
      <button className="invite-code" onClick={() => navigator.clipboard.writeText(inviteCode)}>{inviteCode}<small>タップしてコピー</small></button>
      <p className="muted">相手が参加したら、画面を更新してください。</p>
      <button className="secondary-button" onClick={onChanged}>参加を確認する</button>
    </main>
  )

  return (
    <main className="center-page">
      <FrogMascot size={110} />
      <p className="eyebrow">まずはふたりをつなごう</p>
      <h1>誰とお願いしあう？</h1>
      <section className="paper-card pair-card">
        <button className="primary-button" disabled={busy} onClick={() => run(createPair)}>招待コードをつくる</button>
        <div className="or"><span>または</span></div>
        <label>もらった招待コード<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="例：KAERU123" /></label>
        <button className="secondary-button" disabled={busy || !code.trim()} onClick={() => run(() => joinPair(code))}>ペアに参加する</button>
        {error && <p className="error-message">{error}</p>}
      </section>
    </main>
  )
}
