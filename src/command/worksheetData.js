// Quote every cell and neutralize spreadsheet formulas in user-entered data.
export function sheetCsv(records) {
  return '\uFEFF' + records.map(row => row.map(value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
export function pastedWorkRows(text) {
  return text.replaceAll('\r', '').split('\n').filter(line => line.trim()).map(line => {
    const [work = '', note = '', link = '', pulse = ''] = line.split('\t')
    return { work, note, link: link.trim(), pulse }
  })
}
