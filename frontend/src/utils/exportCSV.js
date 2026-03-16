/**
 * Export data to a CSV file and trigger browser download.
 * Uses UTF-8 BOM so Excel opens it correctly with Spanish characters.
 *
 * @param {string}   filename  - Download filename (without .csv)
 * @param {string[]} headers   - Column header labels
 * @param {Array[]}  rows      - 2D array of values (one array per row)
 */
export function exportCSV(filename, headers, rows) {
  const escape = (v) => {
    const str = v == null ? '' : String(v);
    // Wrap in quotes if it contains comma, newline or double-quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ];

  // UTF-8 BOM (\uFEFF) makes Excel auto-detect encoding
  const bom  = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
