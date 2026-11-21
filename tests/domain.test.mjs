import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeProgress, indiaDate, safeUrl, statusPrompts, verifiedStreak } from '../src/command/domain.js'
import { channelSelector, allowedPushEndpoint } from '../supabase/functions/_shared/youtube.mjs'
test('grade boundaries and exact next-grade remainder',()=>{
  assert.equal(gradeProgress(249).remaining,1);assert.equal(gradeProgress(250).current,'Sankalp')
  assert.equal(gradeProgress(4999).remaining,1);assert.equal(gradeProgress(5000).next,undefined)
})
test('IST date boundaries and unsafe URLs',()=>{
  assert.equal(indiaDate(new Date('2026-01-31T18:30:00Z')),'2026-02-01')
  assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('http://example.com'),null)
  assert.equal(safeUrl('https://example.com'),'https://example.com/')
})
test('status prompts derive only from recorded activity',()=>{
  const result=statusPrompts({proofs:[{status:'pending'},{status:'rejected'}],shifts:[{checked_out:null}],points:249})
  assert.ok(result.some(x=>x.includes('1 proof awaiting')));assert.ok(result.some(x=>x.includes('1 verified points')))
  assert.ok(result.some(x=>x.includes('shift is active')))
})
test('YouTube selectors distinguish handles from channel IDs and reject arbitrary hosts',()=>{
  assert.deepEqual(channelSelector('https://youtube.com/@example'),{forHandle:'@example'})
  assert.deepEqual(channelSelector('https://www.youtube.com/channel/UC1234567890123456789012'),{id:'UC1234567890123456789012'})
  assert.throws(()=>channelSelector('https://evil.com/@test'))
  assert.throws(()=>channelSelector('https://youtube.com/watch?v=test'))
})
test('push endpoints cannot target private infrastructure or attacker hosts',()=>{
  assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/test'),true)
  for(const u of ['https://127.0.0.1/','https://169.254.169.254/','https://evil.com','https://fcm.googleapis.com.evil.com','http://fcm.googleapis.com','https://user:pass@fcm.googleapis.com'])assert.equal(allowedPushEndpoint(u),false)
})
test('streak counts consecutive verified IST workdays, not pending submissions',()=>{
  const proofs=[{status:'verified',submitted_at:'2026-11-20T08:00:00Z'},{status:'verified',submitted_at:'2026-11-19T08:00:00Z'},{status:'pending',submitted_at:'2026-11-18T08:00:00Z'}]
  assert.equal(verifiedStreak(proofs,new Date('2026-11-21T09:00:00Z')),2)
  assert.equal(verifiedStreak(proofs,new Date('2026-11-22T09:00:00Z')),0)
})
