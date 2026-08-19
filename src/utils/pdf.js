import { label, INVOICE_STATUS } from '../data/enums';

function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function makePdf(lines) {
  const contentLines = ['BT', '/F1 20 Tf', '72 750 Td', '(Retrofit Portal) Tj', '/F1 12 Tf'];
  for (const line of lines) {
    contentLines.push('0 -24 Td', `(${escapeText(line)}) Tj`);
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n') + '\n';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

export function downloadInvoicePdf(invoice, index) {
  const number = `#INV-${String(902 - index)}`;
  const lines = [
    '',
    `Invoice ${number}`,
    '------------------------------',
    `Date: ${invoice.date}`,
    `Amount: ${invoice.amount}`,
    `Status: ${label(INVOICE_STATUS, invoice.status)}`,
    '------------------------------',
    'Retrofit Portal',
    'Thank you for your business.',
  ];
  const blob = new Blob([makePdf(lines)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${number.replace('#', '').toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
