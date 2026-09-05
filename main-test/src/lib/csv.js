export function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.value(r) ?? '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
