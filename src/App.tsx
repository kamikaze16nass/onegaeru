import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { FrogMascot, type FrogVariant } from './components/FrogMascot'
import { FrogIcon } from './components/FrogIcon'
import { PairSetup } from './components/PairSetup'
import { RequestCard } from './components/RequestCard'
import { RequestComposer } from './components/RequestComposer'
import { loadDashboard, readableError } from './lib/api'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { DashboardData, RequestStatus } from './lib/types'

import { PyonGame } from './game/PyonGame'
import { PyonCard } from './game/PyonCard'

type Tab = 'home' | 'kp' | 'settings'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('home')
  const [composing, setComposing] = useState(false)
  const [playingPyon, setPlayingPyon] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) return
    try { setError(''); setData(await loadDashboard(session.user.id)) } catch (e) { setError(readableError(e)) }
  }, [session])

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setChecking(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) void refresh(); else setData(null) }, [session, refresh])
  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => void refresh(), 10_000)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshWhenVisible) }
  }, [session, refresh])

  if (!isSupabaseConfigured) return <ConfigScreen />
  if (checking) return <Loading />
  if (!session) return <AuthScreen />
  if (error && !data) return <main className="center-page"><FrogMascot /><h1>うまく跳べませんでした</h1><p className="error-message">{error}</p><button className="secondary-button" onClick={refresh}>もう一度</button></main>
  if (!data) return <Loading />
  if (!data.pair) return <PairSetup onChanged={refresh} />
  if (!data.pair.partner) return <PairSetup inviteCode={data.pair.invite_code} onChanged={refresh} />

  if (playingPyon) return <PyonGame key={session.user.id} onBack={() => { setPlayingPyon(false); void refresh() }} onReward={refresh} />

  const openRequests = data.requests.filter((item) => item.status !== 'complete')
  const homeMessage = getHomeMessage(openRequests, session.user.id, data.pair.partner.display_name)
  return <div className="app-shell">
    <header className="topbar"><div><span className="mini-logo">おねがえる</span><p>{data.pair.partner.display_name}とお願い中</p></div><div className="balance"><small>もっている</small><strong><FrogIcon size={20} />{data.profile.kp_balance} KP</strong></div></header>
    <main className="app-main">
      {tab === 'home' && <>
        <section className="welcome"><FrogMascot variant={homeMessage.variant} /><div><p>{data.profile.display_name}</p><h1>{homeMessage.text}</h1>{homeMessage.subtext && <span className="welcome-subtext">{homeMessage.subtext}</span>}</div></section>
        <section className="section-heading"><div><p className="eyebrow">ふたりのTODO</p><h2>お願いリスト</h2></div><span>{openRequests.length}件</span></section>
        <div className="request-list">{openRequests.length ? openRequests.map((request) => <RequestCard key={request.id} request={request} userId={session.user.id} partnerName={data.pair!.partner!.display_name} balance={data.profile.kp_balance} onChanged={refresh} />) : <div className="empty-card"><FrogIcon size={34} /><p>お願いはまだありません</p></div>}</div>
      </>}
      {tab === 'kp' && <KpView data={data} onPlay={() => setPlayingPyon(true)} />}
      {tab === 'settings' && <SettingsView data={data} onRefresh={refresh} />}
    </main>
    <nav className="bottom-nav"><button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><span>⌂</span>ホーム</button><button className="ask-button" disabled={data.sentToday >= 3} onClick={() => setComposing(true)}><span>＋</span>お願いする<small>あと{Math.max(0, 3 - data.sentToday)}件</small></button><button className={tab === 'kp' ? 'active' : ''} onClick={() => setTab('kp')}><span><FrogIcon size={27} /></span>KP</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><span>⚙</span>設定</button></nav>
    {composing && <RequestComposer remaining={3 - data.sentToday} partnerName={data.pair.partner.display_name} onClose={() => setComposing(false)} onCreated={() => { setComposing(false); void refresh() }} />}
  </div>
}

function Loading() { return <main className="center-page"><FrogMascot /><p>ぴょんぴょん準備中…</p></main> }
function ConfigScreen() { return <main className="center-page config-page"><FrogMascot size={112} /><p className="eyebrow">セットアップが必要です</p><h1>おねがえる</h1><section className="paper-card"><h2>Supabaseをつなごう</h2><p><code>.env.local</code> に次の2つを設定し、<code>supabase/migrations/001_initial.sql</code>を実行してください。</p><pre>VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=...</pre></section></main> }

function KpView({ data, onPlay }: { data: DashboardData; onPlay: () => void }) { return <><section className="kp-hero"><FrogMascot variant="kp-earned" /><p>あなたのカエルポイント</p><strong>{data.profile.kp_balance}<small> KP</small></strong></section><PyonCard onPlay={onPlay} /><section className="section-heading"><div><p className="eyebrow">KPのきろく</p><h2>増えたり、カエしたり</h2></div></section><div className="transaction-list">{data.transactions.length ? data.transactions.map((tx) => <div className="transaction" key={tx.id}><span className={tx.amount >= 0 ? 'plus' : 'minus'}>{tx.amount > 0 ? '+' : ''}{tx.amount} KP</span><div><strong>{tx.kind === 'pyon_reward' ? 'ぴょんぴょんでゲット！' : tx.kind === 'initial' ? 'はじめましてボーナス' : tx.kind === 'return_payment' ? 'お願いをカエした' : 'お願いをかなえた'}</strong>{tx.request_title && <small>{tx.request_title}</small>}</div><time>{new Date(tx.created_at).toLocaleDateString('ja-JP')}</time></div>) : <p className="muted">履歴はまだありません</p>}</div></> }

function SettingsView({ data, onRefresh }: { data: DashboardData; onRefresh: () => void }) { return <><section className="section-heading"><div><p className="eyebrow">ふたりの設定</p><h2>ペアとアカウント</h2></div></section><section className="paper-card settings-card"><p>あなた</p><strong>{data.profile.display_name}</strong><p>お願い相手</p><strong>{data.pair?.partner?.display_name}</strong><p>招待コード</p><strong>{data.pair?.invite_code}</strong><button className="secondary-button" onClick={onRefresh}>データを更新</button><button className="text-button danger" onClick={() => supabase?.auth.signOut()}>ログアウト</button></section></> }

export const requestStatuses: RequestStatus[] = ['pending', 'accepted', 'done_pending_confirm', 'complete']

function getHomeMessage(requests: DashboardData['requests'], userId: string, partnerName: string): { text: string; subtext?: string; variant: FrogVariant } {
  const returnedToMe = requests.find((item) => item.status === 'pending' && item.current_holder_id === userId && item.last_bid_kp > 0)
  const returnedByMe = requests.find((item) => item.status === 'pending' && item.current_holder_id !== userId && item.last_bid_kp > 0)
  if (requests.some((item) => item.status === 'done_pending_confirm' && item.completed_by !== userId)) return { text: 'できたみたい！確認してみよう', variant: 'done' }
  if (returnedToMe) return { text: `${partnerName}からお願いがカエってきた！`, variant: 'returned-back' }
  if (returnedByMe) return { text: `${partnerName}に${returnedByMe.last_bid_kp}KPでカエしたよ！`, subtext: 'お返事を待ってよう', variant: 'returned' }
  if (requests.some((item) => item.status === 'pending' && item.current_holder_id === userId && item.last_bid_kp === 0)) return { text: `${partnerName}からお願いが届いてるよ！`, variant: 'request-received' }
  if (requests.some((item) => item.status === 'accepted' && item.current_holder_id !== userId)) return { text: `${partnerName}がやってくれてるよ`, variant: 'working' }
  if (requests.some((item) => item.status === 'pending' && item.current_holder_id !== userId)) return { text: `${partnerName}のお返事を待ってるよ`, variant: 'normal' }
  if (requests.some((item) => item.status === 'accepted' && item.current_holder_id === userId)) return { text: '引き受けたお願いがあるよ', variant: 'working' }
  return { text: '今日はのんびりだね', variant: 'relaxing' }
}
