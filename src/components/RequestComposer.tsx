import { useState, type FormEvent } from 'react'
import { createRequest, readableError } from '../lib/api'

export function RequestComposer({ remaining, partnerName, onClose, onCreated }: { remaining: number; partnerName: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await createRequest(title.trim(), note.trim(), due || null); onCreated() } catch (e) { setError(readableError(e)); setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal paper-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
    <button type="button" className="close-button" onClick={onClose} aria-label="閉じる">×</button>
    <p className="eyebrow">{partnerName}へ</p><h2>お願いをぴょん！</h2>
    <p className="remaining">今日あと <strong>{remaining}件</strong> 送れます</p>
    <label>お願いしたいこと<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="例：帰りに牛乳を買ってきて" autoFocus required /></label>
    <label>ひとこと <span>任意</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="銘柄や場所などを書けます" /></label>
    <label>期限 <span>任意</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
    {error && <p className="error-message">{error}</p>}
    <button className="primary-button" disabled={busy || remaining < 1}>{busy ? '送っています…' : 'お願いする！'}</button>
  </form></div>
}
