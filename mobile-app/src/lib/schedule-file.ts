export type ImportedSchedule = {
  title: string;
  type: 'STUDY' | 'BUSY' | 'FREE';
  start_time: string;
  end_time: string;
};

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value.trim()); value = '';
      if (row.some(cell => cell)) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) throw new Error('File CSV có dấu nháy chưa đóng.');
  row.push(value.trim());
  if (row.some(cell => cell)) rows.push(row);
  return rows;
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() + 1 === month && value.getUTCDate() === day;
}

export function parseScheduleCsv(text: string): ImportedSchedule[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('File CSV cần dòng tiêu đề và ít nhất một mục lịch.');
  const columns = rows[0].map(value => value.toLowerCase());
  for (const name of ['title', 'date', 'start', 'end']) {
    if (!columns.includes(name)) throw new Error('Thiếu cột ' + name + ' trong file CSV.');
  }
  if (rows.length > 501) throw new Error('Mỗi lần chỉ nhập tối đa 500 mục lịch.');
  const at = (row: string[], key: string) => row[columns.indexOf(key)] || '';
  const result: ImportedSchedule[] = [];
  const known = new Set<string>();
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const date = at(row, 'date');
    const start = at(row, 'start');
    const end = at(row, 'end');
    const type = (at(row, 'type') || 'STUDY').toUpperCase();
    const title = at(row, 'title') || (type === 'FREE' ? 'Rảnh' : '');
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start || !['STUDY', 'BUSY', 'FREE'].includes(type) || !title) {
      throw new Error(`Dòng ${index + 1} không hợp lệ. Kiểm tra ngày, giờ, loại và tên lịch.`);
    }
    const item: ImportedSchedule = {
      title,
      type: type as ImportedSchedule['type'],
      start_time: new Date(`${date}T${start}:00+07:00`).toISOString(),
      end_time: new Date(`${date}T${end}:00+07:00`).toISOString(),
    };
    const key = JSON.stringify(item);
    if (!known.has(key)) { known.add(key); result.push(item); }
  }
  return result;
}
