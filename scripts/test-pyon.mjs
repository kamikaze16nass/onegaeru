import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Real PostgreSQL semantics in WASM; Supabase auth is the only fixture.
const db = new PGlite()
await db.exec(`create role authenticated; create schema auth; create schema extensions;
  create function extensions.gen_random_bytes(n integer) returns bytea language sql as
  $$ select decode(substr(repeat(replace(gen_random_uuid()::text,'-',''),n),1,n*2),'hex') $$;
  create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;`)
for (const file of ['001_initial.sql', '002_fix_invite_code_generation.sql', '003_pyon_kind.sql', '004_pyon_game.sql']) {
  let sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
  sql = sql.replace('create extension if not exists pgcrypto with schema extensions;', '')
  await db.exec(sql)
}
const user = randomUUID(), other = randomUUID()
await db.query(`insert into auth.users values ($1,'{"display_name":"test"}'),($2,'{"display_name":"other"}')`, [user, other])
await db.query(`select set_config('test.uid',$1,false)`, [user])
const query = async (sql, args = []) => (await db.query(sql,args)).rows
const rpc = async (sql,args=[]) => {
  await db.exec('set role authenticated')
  try { return (await query(sql,args))[0].result } finally { await db.exec('reset role') }
}
const start = (id=randomUUID()) => rpc('select public.pyon_start($1) result',[id])
const move = (run,lane) => rpc('select public.pyon_move($1,$2,$3) result',[run.id,run.score,lane])
const age = (run,ms=300) => db.query("update pyon_runs set landed_at=clock_timestamp()-($2::text || ' milliseconds')::interval where id=$1",[run.id,ms])

const levels = await query(`select s, (pyon_level(rules,s)->>'timeMs')::int ms from pyon_config, unnest(array[0,9,10,19,20,29,30,49,50,74,75,99,100]) s`)
assert.deepEqual(levels.map(x=>x.ms), [2500,2500,2200,2200,1900,1900,1600,1600,1350,1350,1150,1150,1000])
for (const score of [0,10,25,55,101]) {
  const rows = await query('select pyon_stage(rules,$1) tiles from pyon_config,generate_series(1,1000)',[score])
  for (const {tiles} of rows) {
    assert(tiles.some(x=>x.kind==='safe'))
    assert(tiles.every(x=>!x.kp || x.kind==='safe'))
  }
}
let run = await start()
assert.equal((await start(run.id)).id,run.id)
await assert.rejects(move(run,2),/INVALID_LANE/)
await assert.rejects(move(run,0),/TOO_FAST/)
await age(run)
const safe = run.stage.findIndex(x=>x.kind==='safe')
const next = await move(run,safe)
assert.equal(next.score,1)
assert.equal((await move(run,safe)).score,1, 'duplicate step must not advance')
await age(next,10000)
assert.equal((await move(next,0)).reason,'timeout')

for (const kind of ['hole','water','enemy']) {
  run=await start()
  await db.query('update pyon_runs set stage=$2::jsonb where id=$1',[run.id,JSON.stringify([{kind,kp:false},{kind:'safe',kp:true}])])
  await age(run)
  const result=await move(run,0)
  assert.equal(result.reason,kind)
  assert.equal(result.score,0)
  assert.equal(result.awarded,0)
}
run=await start()
await db.query(`update pyon_runs set stage='[{"kind":"safe","kp":true},{"kind":"safe","kp":false}]' where id=$1`,[run.id])
await age(run)
const pickup=await move(run,0)
assert.equal(pickup.picked,1)
assert.equal(pickup.score,1)
assert.equal((await move(pickup,-1)).awarded,3)

for (const [score,base] of [[0,0],[1,2],[10,2],[11,4],[20,4],[21,6],[30,6],[31,8],[40,8],[41,10],[101,10]]) {
  run = await start()
  await db.query('update pyon_runs set score=$2 where id=$1',[run.id,score])
  run.score=score
  const result=await move(run,-1)
  assert.equal(result.base,base)
  assert(result.awarded<=10)
  const duplicate=await move(run,-1)
  assert.equal(duplicate.awarded,result.awarded)
}
assert.equal(await rpc('select pyon_today() result'),30)
run=await start()
assert.equal((await move(run,-1)).awarded,0, 'play remains possible after cap')

// A fresh user at 26 today receives only 4 for a nominal 8 reward.
await db.query(`select set_config('test.uid',$1,false)`,[other])
for (const [score,picked,expected] of [[41,4,10],[41,0,10],[21,0,6],[21,2,4],[41,0,0]]) {
  run=await start()
  await db.query('update pyon_runs set score=$2,picked=$3 where id=$1',[run.id,score,picked]); run.score=score
  const result=await move(run,-1)
  assert.equal(result.awarded,expected)
}
assert.equal(await rpc('select pyon_today() result'),30)
assert.equal((await query('select kp_balance from profiles where id=$1',[other]))[0].kp_balance,80)
assert.equal((await query("select sum(amount)::int n from kp_transactions where user_id=$1 and kind='pyon_reward'",[other]))[0].n,30)
await db.query("update pyon_runs set finished_at=(date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')-interval '1 second' where user_id=$1",[other])
assert.equal(await rpc('select pyon_today() result'),0,'previous Japan day is excluded')
await db.exec('set role authenticated')
assert.equal((await query('select * from pyon_runs where user_id=$1',[user])).length,0)
await assert.rejects(db.query('update pyon_runs set score=999'),/permission denied/)
await assert.rejects(db.query('insert into pyon_config values(false,\'{}\')'),/permission denied/)
await assert.rejects(db.query('update profiles set kp_balance=999'),/permission denied/)
await db.exec('reset role')
await db.query(`select set_config('test.uid',$1,false)`,[user])
await assert.rejects(move(run,-1),/RUN_NOT_FOUND/)
await db.close()
console.log('PASS: migrations, 5,000 generated stages, timing tiers, replay, reward boundaries, daily cap, ledger, ownership and RLS')
