export type RequestStatus = 'pending' | 'accepted' | 'done_pending_confirm' | 'complete'

export type Profile = {
  id: string
  display_name: string
  kp_balance: number
}

export type PairInfo = {
  id: string
  invite_code: string
  partner: Profile | null
}

export type TodoRequest = {
  id: string
  title: string
  note: string | null
  due_date: string | null
  status: RequestStatus
  sender_id: string
  current_holder_id: string
  completed_by: string | null
  reward_kp: number
  last_bid_kp: number
  created_at: string
  sender_name: string
  holder_name: string
}

export type KpTransaction = {
  id: string
  amount: number
  kind: 'initial' | 'return_payment' | 'completion_reward' | 'pyon_reward'
  created_at: string
  request_title: string | null
}

export type DashboardData = {
  profile: Profile
  pair: PairInfo | null
  requests: TodoRequest[]
  transactions: KpTransaction[]
  sentToday: number
}
