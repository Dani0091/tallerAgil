
// ============================================
// ARCHIVO 2: src/utils/pdfGenerator.js (MEJORADO - REEMPLAZAR COMPLETO)
// ============================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Genera un PDF profesional de factura
 * @param {Object} factura - Objeto factura de MongoDB
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
async function generateFacturaPDF(factura) {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    let y = height - 50;
    const margin = 50;
    const rightColumn = width - 200;

    // ========== HEADER ==========
    page.drawText('R&S AUTOMOCIÓN', {
      x: margin,
      y: y,
      size: 24,
      font: fontBold,
      color: rgb(0.9, 0.2, 0.2)
    });

    // Empresa info (izquierda)
    y -= 25;
    page.drawText(factura.empresa.direccion, { x: margin, y: y, size: 10, font });
    y -= 15;
    page.drawText(factura.empresa.ciudad, { x: margin, y: y, size: 10, font });
    y -= 15;
    page.drawText(`NIF: ${factura.empresa.nif}`, { x: margin, y: y, size: 10, font });
    
    if (factura.empresa.telefono) {
      y -= 15;
      page.drawText(`Tel: ${factura.empresa.telefono}`, { x: margin, y: y, size: 10, font });
    }
    
    if (factura.empresa.email) {
      y -= 15;
      page.drawText(`Email: ${factura.empresa.email}`, { x: margin, y: y, size: 10, font });
    }

    // Factura info (derecha)
    let yRight = height - 50;
    page.drawText('FACTURA', {
      x: rightColumn,
      y: yRight,
      size: 20,
      font: fontBold
    });

    yRight -= 25;
    page.drawText(`Nº: ${factura.numero}`, {
      x: rightColumn,
      y: yRight,
      size: 11,
      font: fontBold
    });

    yRight -= 20;
    const fechaEmision = new Date(factura.fecha_emision).toLocaleDateString('es-ES');
    page.drawText(`Fecha: ${fechaEmision}`, {
      x: rightColumn,
      y: yRight,
      size: 10,
      font
    });

    yRight -= 15;
    const fechaVencimiento = new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES');
    page.drawText(`Vencimiento: ${fechaVencimiento}`, {
      x: rightColumn,
      y: yRight,
      size: 10,
      font
    });

    // ========== CLIENTE ==========
    y = Math.min(y, yRight) - 40;
    page.drawText('CLIENTE:', { x: margin, y: y, size: 12, font: fontBold });
    
    y -= 20;
    page.drawText(`${factura.cliente.nombre} ${factura.cliente.apellidos || ''}`, {
      x: margin,
      y: y,
      size: 11,
      font: fontBold
    });

    y -= 15;
    page.drawText(`NIF: ${factura.cliente.nif}`, { x: margin, y: y, size: 10, font });

    y -= 15;
    page.drawText(factura.cliente.direccion || '', { x: margin, y: y, size: 10, font });

    if (factura.cliente.email) {
      y -= 15;
      page.drawText(`Email: ${factura.cliente.email}`, { x: margin, y: y, size: 10, font });
    }

    // ========== TABLA DE ITEMS ==========
    y -= 40;
    const tableTop = y;
    const colDesc = margin;
    const colCant = margin + 250;
    const colPrecio = margin + 320;
    const colSubtotal = margin + 420;

    // Header de tabla
    page.drawRectangle({
      x: margin - 5,
      y: y - 5,
      width: width - 2 * margin + 10,
      height: 25,
      color: rgb(0.9, 0.9, 0.9)
    });

    page.drawText('DESCRIPCIÓN', { x: colDesc, y: y, size: 10, font: fontBold });
    page.drawText('CANT.', { x: colCant, y: y, size: 10, font: fontBold });
    page.drawText('PRECIO', { x: colPrecio, y: y, size: 10, font: fontBold });
    page.drawText('SUBTOTAL', { x: colSubtotal, y: y, size: 10, font: fontBold });

    // Línea separadora
    y -= 20;
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Items
    y -= 20;
    factura.items.forEach((item, index) => {
      // Descripción (puede ser larga, dividir si es necesario)
      const descLines = splitText(item.descripcion, 40);
      descLines.forEach((line, i) => {
        page.drawText(line, { x: colDesc, y: y - (i * 12), size: 9, font });
      });

      // Cantidad, precio, subtotal en la primera línea
      page.drawText(item.cantidad.toString(), { x: colCant, y: y, size: 9, font });
      page.drawText(`${item.precio_unitario.toFixed(2)}€`, { x: colPrecio, y: y, size: 9, font });
      page.drawText(`${item.subtotal.toFixed(2)}€`, { x: colSubtotal, y: y, size: 9, font });

      y -= (descLines.length * 12) + 10;

      // Salto de página si es necesario
      if (y < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        y = height - 50;
        page = newPage;
      }
    });

    // ========== TOTALES ==========
    y -= 20;
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5)
    });

    y -= 25;
    const totalesX = width - 250;

    // Subtotal
    page.drawText('Base Imponible:', { x: totalesX, y: y, size: 10, font });
    page.drawText(`${factura.base_imponible.toFixed(2)}€`, {
      x: width - margin - 80,
      y: y,
      size: 10,
      font
    });

    // IVA
    y -= 15;
    page.drawText(`IVA (${factura.tasa_iva}%):`, { x: totalesX, y: y, size: 10, font });
    page.drawText(`${factura.iva_total.toFixed(2)}€`, {
      x: width - margin - 80,
      y: y,
      size: 10,
      font
    });

    // Total
    y -= 20;
    page.drawRectangle({
      x: totalesX - 10,
      y: y - 5,
      width: 200,
      height: 25,
      color: rgb(0.9, 0.95, 1)
    });

    page.drawText('TOTAL:', { x: totalesX, y: y, size: 12, font: fontBold });
    page.drawText(`${factura.total_factura.toFixed(2)}€`, {
      x: width - margin - 80,
      y: y,
      size: 12,
      font: fontBold,
      color: rgb(0.9, 0.2, 0.2)
    });

    // ========== CONDICIONES ==========
    y -= 40;
    if (factura.observaciones) {
      page.drawText('OBSERVACIONES:', { x: margin, y: y, size: 10, font: fontBold });
      y -= 15;
      const obsLines = splitText(factura.observaciones, 80);
      obsLines.forEach((line, i) => {
        page.drawText(line, { x: margin, y: y - (i * 12), size: 9, font });
      });
      y -= (obsLines.length * 12) + 10;
    }

    y -= 20;
    page.drawText(`Condiciones de pago: ${factura.condiciones_pago}`, {
      x: margin,
      y: y,
      size: 9,
      font
    });

    // ========== FOOTER ==========
    const footerY = 50;
    page.drawText('Gracias por su confianza - R&S Automoción', {
      x: width / 2 - 100,
      y: footerY,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);

  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    throw error;
  }
}

/**
 * Divide texto largo en líneas más cortas
 */
function splitText(text, maxLength) {
  if (!text || text.length <= maxLength) return [text || ''];
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

module.exports = {
  generateFacturaPDF
};