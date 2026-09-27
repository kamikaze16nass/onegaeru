import { useState } from 'react'
import { acceptRequest, confirmDone, markDone, readableError, returnRequest } from '../lib/api'
import type { TodoRequest } from '../lib/types'
import { FrogIcon } from './FrogIcon'

export function RequestCard({ request, userId, partnerName, balance, onChanged }: { request: TodoRequest; userId: string; partnerName: string; balance: number; onChanged: () => void }) {
  const [returning, setReturning] = useState(false)
  const minimum = request.last_bid_kp ? request.last_bid_kp + 10 : 10
  const [kp, setKp] = useState(minimum)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isHolder = request.current_holder_id === userId
  const isSender = request.sender_id === userId
  const canConfirm = request.status === 'done_pending_confirm' && request.completed_by !== userId
  const hasReturned = request.last_bid_kp > 0
  const returnedToMe = request.status === 'pending' && isHolder && hasReturned
  const returnedByMe = request.status === 'pending' && !isHolder && hasReturned
  const statusLabel = request.status === 'pending'
    ? returnedToMe ? 'カエってきた！' : returnedByMe ? 'カエしたよ！' : isHolder ? '新しいお願い' : 'お返事待ち'
    : request.status === 'accepted' ? (isHolder ? '取り組み中' : 'やってくれてる')
      : request.status === 'done_pending_confirm' ? (canConfirm ? '確認してね' : '確認待ち')
        : 'できた！'

  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); await onChanged() } catch (e) { setError(readableError(e)); setBusy(false) }
  }

  return <article className={`request-card request-card--${request.status}${returnedToMe ? ' request-card--returned' : ''}${returnedByMe ? ' request-card--returned-by-me' : ''}`}>
    <header><span className={`status-pill${returnedToMe ? ' status-pill--returned' : ''}${returnedByMe ? ' status-pill--returned-by-me' : ''}`}>{(returnedToMe || returnedByMe) && <FrogIcon size={16} />}{statusLabel}</span>{request.reward_kp > 0 && !returnedToMe && !returnedByMe && <span className="reward-pill"><FrogIcon size={16} />{request.reward_kp} KP</span>}</header>
    {returnedToMe && <p className="returned-message"><strong>{partnerName}が{request.last_bid_kp}KPでカエしたよ</strong></p>}
    {returnedByMe && <p className="returned-message returned-message--by-me"><strong>{request.last_bid_kp}KPで{partnerName}にカエしたよ！</strong></p>}
    <h3>{request.title}</h3>
    {request.note && <p className="request-note">{request.note}</p>}
    <div className="request-meta">
      <span>{isSender ? `${request.holder_name}へ` : `${request.sender_name}から`}</span>
      {request.due_date && <span>期限 {new Date(`${request.due_date}T00:00:00`).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>}
    </div>
    {(returnedToMe || returnedByMe) && <div className="reward-total"><span>現在の報酬</span><strong><FrogIcon size={24} />{request.reward_kp}<small> KP</small></strong></div>}
    {request.status === 'pending' && isHolder && !returning && <div className="card-actions two"><button disabled={busy} className="accept-button" onClick={() => act(() => acceptRequest(request.id))}>やる！</button><button disabled={busy || balance < minimum} className="return-button" onClick={() => setReturning(true)}>{hasReturned ? `${minimum}KP〜でカエす！` : 'カエす！'}</button></div>}
    {request.status === 'pending' && isHolder && returning && <div className="return-panel">
      <div><strong>何KPつけてカエす？</strong><button className="text-button" onClick={() => setReturning(false)}>やめる</button></div>
      <p>最低 {minimum} KP・所持 {balance} KP</p>
      <div className="kp-input"><button type="button" onClick={() => setKp(Math.max(minimum, kp - 10))}>−</button><input type="number" min={minimum} max={balance} step="10" value={kp} onChange={(e) => setKp(Number(e.target.value))} /><span>KP</span><button type="button" onClick={() => setKp(Math.min(balance, kp + 10))}>＋</button></div>
      <button className="return-confirm" disabled={busy || kp < minimum || kp > balance} onClick={() => act(() => returnRequest(request.id, kp))}>このKPでカエす！</button>
    </div>}
    {request.status === 'pending' && !isHolder && <p className="waiting-copy">{request.holder_name}のお返事待ち</p>}
    {request.status === 'accepted' && isHolder && <button className="done-button" disabled={busy} onClick={() => act(() => markDone(request.id))}>やったよ！</button>}
    {request.status === 'accepted' && !isHolder && <p className="waiting-copy">{request.holder_name}が取り組み中です</p>}
    {canConfirm && <button className="confirm-button" disabled={busy} onClick={() => act(() => confirmDone(request.id))}>見たよ、ありがとう！</button>}
    {request.status === 'done_pending_confirm' && !canConfirm && <p className="waiting-copy">相手の「ありがとう！」を待っています</p>}
    {request.status === 'complete' && <p className="complete-copy">お願い、かなったね！</p>}
    {error && <p className="error-message">{error}</p>}
  </article>
}
