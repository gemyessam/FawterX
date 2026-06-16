const fs = require('fs');
let c = fs.readFileSync('frontend/src/services/api.js', 'utf8');

const target = `export async function uploadExcel(file, mode = 'template') {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  const { data } = await api.post('/excel/upload', form)
  return data
}`;

const replacement = `export async function uploadExcel(file, mode = 'template') {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  const { data } = await api.post('/excel/upload', form)
  return data
}

/** رفع مجموعة ملفات Excel/PDF وجلب النتائج المجمعة */
export async function uploadExcelBatch(files, mode = 'template') {
  const form = new FormData()
  Array.from(files).forEach(f => form.append('files', f))
  form.append('mode', mode)
  const { data } = await api.post('/excel/upload-batch', form)
  return data
}`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target.replace(/\r\n/g, '\n'), replacement);

fs.writeFileSync('frontend/src/services/api.js', c);
console.log("Updated api.js");
