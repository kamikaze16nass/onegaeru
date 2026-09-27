import { useState, type FormEvent } from 'react'
import { FrogMascot } from './FrogMascot'
import { supabase } from '../lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setNotice('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() || 'ななしのカエル' } } })
    setBusy(false)
    if (result.error) setNotice(result.error.message)
    else if (mode === 'signup' && !result.data.session) setNotice('確認メールを送りました。メール内のリンクから登録を完了してください。')
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <FrogMascot size={108} />
        <p className="eyebrow">ふたりのお願いTODO</p>
        <h1>おねがえる</h1>
        <p>お願いすることも、断ることも、<br />ちょっと楽しく。</p>
      </section>
      <form className="paper-card auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>ログイン</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>新しくはじめる</button>
        </div>
        {mode === 'signup' && <label>呼ばれたい名前<input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required /></label>}
        <label>メールアドレス<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        {notice && <p className="form-notice">{notice}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'ぴょんぴょん中…' : mode === 'login' ? 'ログインする' : 'はじめる'}</button>
      </form>
    </main>
  )
}
