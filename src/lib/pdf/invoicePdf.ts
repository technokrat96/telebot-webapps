import 'server-only';
import PDFDocument from 'pdfkit';
import {InvoicePdfData} from "@/types";

function formatIDR(n: number): string {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ===== Header =====
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.fontSize(10).font('Helvetica').text(data.INVOICE_NUMBER || data.INVOICE_ID, { align: 'right' });
    doc.moveDown(1.5);

    // ===== Info kiri (dari) & kanan (ditagihkan ke) =====
    const infoTop = doc.y;
    doc.fontSize(9).fillColor('#666').text('DITAGIHKAN KE', 50, infoTop);
    doc.fontSize(11).fillColor('#000').font('Helvetica-Bold').text(data.BILLED_TO || '-', 50, infoTop + 14);
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    if (data.BILLED_ADDRESS) doc.text(data.BILLED_ADDRESS, 50, doc.y + 2, { width: 240 });
    if (data.BILLED_PHONE) doc.text(data.BILLED_PHONE, 50, doc.y + 2);

    doc.fontSize(9).fillColor('#666').text('ORDER ID', 350, infoTop, { width: 200, align: 'right' });
    doc.fontSize(10).fillColor('#000').text(data.orderId || '-', 350, doc.y, { width: 200, align: 'right' });
    doc.fontSize(9).fillColor('#666').text('TANGGAL INVOICE', 350, doc.y + 6, { width: 200, align: 'right' });
    doc.fontSize(10).fillColor('#000').text(data.INVOICE_DATE?.slice(0, 10) || '-', 350, doc.y, { width: 200, align: 'right' });
    doc.fontSize(9).fillColor('#666').text('JATUH TEMPO', 350, doc.y + 6, { width: 200, align: 'right' });
    doc.fontSize(10).fillColor('#000').text(data.DUE_DATE?.slice(0, 10) || '-', 350, doc.y, { width: 200, align: 'right' });

    doc.moveDown(3);
    doc.fillColor('#000');

    // ===== Tabel item =====
    const tableTop = doc.y + 10;
    const col = { item: 50, qty: 300, price: 370, subtotal: 460 };

    doc.rect(50, tableTop, 495, 20).fill('#f0f0f0');
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold');
    doc.text('ITEM', col.item + 6, tableTop + 6);
    doc.text('QTY', col.qty, tableTop + 6, { width: 60, align: 'right' });
    doc.text('HARGA', col.price, tableTop + 6, { width: 80, align: 'right' });
    doc.text('SUBTOTAL', col.subtotal, tableTop + 6, { width: 80, align: 'right' });

    let y = tableTop + 26;
    doc.font('Helvetica').fontSize(9);
    for (const item of data.items) {
      const unitPrice = item.QUANTITY_BILLED ? item.PRICE_BILLED / item.QUANTITY_BILLED : 0;
      doc.text(item.ITEM_NAME, col.item + 6, y, { width: 240 });
      doc.text(String(item.QUANTITY_BILLED), col.qty, y, { width: 60, align: 'right' });
      doc.text(formatIDR(unitPrice), col.price, y, { width: 80, align: 'right' });
      doc.text(formatIDR(item.PRICE_BILLED), col.subtotal, y, { width: 80, align: 'right' });
      y += 20;
    }

    doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#ddd').stroke();
    y += 14;

    // ===== Ringkasan total =====
    function summaryRow(label: string, value: string, bold = false) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10);
      doc.text(label, 350, y, { width: 100, align: 'right' });
      doc.text(value, 460, y, { width: 85, align: 'right' });
      y += 18;
    }

    summaryRow('Total Tagihan', formatIDR(data.TOTAL_AMOUNT));
    summaryRow('Sudah Dibayar', formatIDR(data.AMOUNT_PAID));
    summaryRow('Sisa', formatIDR(Math.max(0, data.TOTAL_AMOUNT - data.AMOUNT_PAID)), true);

    y += 10;
    doc.font('Helvetica-Bold').fontSize(10);
    const statusLabel =
      data.INVOICE_STATUS === 'PAID' ? 'LUNAS' : data.INVOICE_STATUS === 'PARTIAL' ? 'DIBAYAR SEBAGIAN' : 'BELUM DIBAYAR';
    doc.text(`Status: ${statusLabel}`, 350, y, { width: 195, align: 'right' });

    doc.fontSize(8).fillColor('#999').text(
      'Terima kasih atas kepercayaan Anda.',
      50,
      750,
      { align: 'center', width: 495 }
    );

    doc.end();
  });
}