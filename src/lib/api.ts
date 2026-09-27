import { supabase } from './supabase'
import type { DashboardData, KpTransaction, PairInfo, Profile, TodoRequest } from './types'

function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません')
  return supabase
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return '操作に失敗しました'
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}) {
  const ballot = await client().rpc(name, params)
  if (ballot.error) throw new Error(ballot.error.message)
  return ballot.data as T
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const db = client()
  const [profileResult, membershipResult, requestsResult, txResult, countResult] = await Promise.all([
    db.from('profiles').select('id, display_name, kp_balance').eq('id', userId).single(),
    db.from('pair_members').select('pair_id, pairs(id, invite_code)').eq('user_id', userId).maybeSingle(),
    db.from('request_feed').select('*').order('created_at', { ascending: false }),
    db.from('kp_transaction_feed').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('requests').select('id', { count: 'exact', head: true }).eq('sender_id', userId).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])
  for (const result of [profileResult, membershipResult, requestsResult, txResult, countResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  let pair: PairInfo | null = null
  const membership = membershipResult.data as unknown as { pair_id: string; pairs: { id: string; invite_code: string } } | null
  if (membership) {
    const partnerResult = await db.from('pair_members').select('profiles(id, display_name, kp_balance)').eq('pair_id', membership.pair_id).neq('user_id', userId).maybeSingle()
    if (partnerResult.error) throw new Error(partnerResult.error.message)
    const partnerRow = partnerResult.data as unknown as { profiles: Profile } | null
    pair = { ...membership.pairs, partner: partnerRow?.profiles ?? null }
  }

  return {
    profile: profileResult.data as Profile,
    pair,
    requests: (requestsResult.data ?? []) as TodoRequest[],
    transactions: (txResult.data ?? []) as KpTransaction[],
    sentToday: countResult.count ?? 0,
  }
}

export const createPair = () => rpc<string>('create_pair')
export const joinPair = (inviteCode: string) => rpc<string>('join_pair', { invite_code_input: inviteCode.trim().toUpperCase() })
export const createRequest = (title: string, note: string, dueDate: string | null) => rpc<string>('create_request', { title_input: title, note_input: note || null, due_date_input: dueDate })
export const acceptRequest = (requestId: string) => rpc<void>('accept_request', { request_id_input: requestId })
export const returnRequest = (requestId: string, kp: number) => rpc<void>('return_request', { request_id_input: requestId, kp_input: kp })
export const markDone = (requestId: string) => rpc<void>('mark_request_done', { request_id_input: requestId })
export const confirmDone = (requestId: string) => rpc<void>('confirm_request_done', { request_id_input: requestId })

export function readableError(error: unknown) {
  const raw = message(error)
  const known: Record<string, string> = {
    DAILY_LIMIT_REACHED: '今日送れるお願いは3件までです。',
    INSUFFICIENT_KP: 'KPが足りません。',
    BID_TOO_LOW: '前回より10KP以上多くしてください。',
    INVALID_INVITE: '招待コードが見つかりません。',
    PAIR_FULL: 'このペアにはすでに2人参加しています。',
  }
  const key = Object.keys(known).find((item) => raw.includes(item))
  return key ? known[key] : raw
}
