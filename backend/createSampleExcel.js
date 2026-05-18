const XLSX = require("xlsx");
const wb = XLSX.utils.book_new();
const data = [
  ["فاتورة ضريبية", "", ""],
  ["الرقم الضريبي للبائع", "477840515", ""],
  ["الرقم الضريبي للمشتري", "123456789", ""],
  ["رقم الفاتورة", "INV-9988", ""],
  ["العميل", "شركة النصر للتجارة", ""],
  ["", "", ""],
  ["Product Description", "Quantity", "Price"],
  ["كابلات كهربائية النصر", 10, 150],
  ["مفاتيح إضاءة شنايدر", 5, 45],
  ["علب توزيع بلاستيك", 20, 12.5]
];
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "Invoices");
XLSX.writeFile(wb, "../sample_invoice.xlsx");
console.log("sample_invoice.xlsx created successfully in workspace root!");
