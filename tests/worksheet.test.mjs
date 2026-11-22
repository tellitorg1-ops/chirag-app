import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sheetCsv, pastedWorkRows } from '../src/command/worksheetData.js'

test('Excel export preserves text and quotes while neutralizing formulas',()=>{
  const csv=sheetCsv([['Name','Note'],['=HYPERLINK("https://example.com")','Line one\nLine "two"'],['  +SUM(A1:A2)','@command']])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'))
  assert.ok(csv.includes('"Line one\nLine ""two"""'))
  assert.ok(csv.includes('"\'  +SUM(A1:A2)"'));assert.ok(csv.includes('"\'@command"'))
})
test('pasting spreadsheet data preserves every row for batch validation',()=>{
  const rows=pastedWorkRows('Visit one\tMet ten residents\thttps://example.com\tRoad concern\r\nVisit two\tSurvey completed\t\t\r\n')
  assert.equal(rows.length,2);assert.equal(rows[0].pulse,'Road concern');assert.equal(rows[1].link,'')
  assert.equal(pastedWorkRows(Array.from({length:51},(_,i)=>`Work ${i}\tEvidence`).join('\n')).length,51)
})
