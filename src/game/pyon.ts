import { supabase } from '../lib/supabase'

export type Lane = 0 | 1
export type Tile = { kind: 'safe' | 'hole' | 'water' | 'enemy'; kp: boolean }
export type Phase = 'ready' | 'playing' | 'jumping' | 'gameOver'
export type Run = {
  id: string; score: number; picked: number; stage: [Tile, Tile]
  state: 'playing' | 'gameOver'; reason: string | null
  base: number; awarded: number; today: number; timeMs: number
  rules: { jumpMs: number; playCap: number; dailyCap: number }
}
async function rpc<T>(name: string, args = {}) {
  if (!supabase) throw new Error('Supabaseが設定されていません')
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}
export const todayKp = () => rpc<number>('pyon_today')
export const startRun = (id: string) => rpc<Run>('pyon_start', { run_id: id })
export const moveRun = (run: Run, lane: Lane | -1) => rpc<Run>('pyon_move', { run_id: run.id, expected_score: run.score, lane })
