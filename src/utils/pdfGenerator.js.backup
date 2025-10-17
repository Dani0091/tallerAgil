// src/utils/pdfGenerator.js

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function generateFacturaPDF(factura) {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    let y = height - 50;
    const margin = 50;

    // Header
    page.drawText('R&S AUTOMOCIÓN', {
      x: margin,
      y: y,
      size: 24,
      font: fontBold,
      color: rgb(0.9, 0.2, 0.2)
    });

    y -= 25;
    page.drawText(factura.empresa.direccion, {
      x: margin,
      y: y,
      size: 11,
      font
    });

    y -= 15;
    page.drawText(`NIF: ${factura.empresa.nif}`, {
      x: margin,
      y: y,
      size: 11,
      font
    });

    page.drawText('FACTURA', {
      x: width - 150,
      y: height - 50,
      size: 20,
      font: fontBold
    });

    page.drawText(`Nº: ${factura.numero}`, {
      x: width - 150,
      y: height - 75,
      size: 11,
      font: fontBold
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;

  } catch (error) {
    console.error('Error generando PDF:', error.message);
    throw error;
  }
}

module.exports = {
  generateFacturaPDF
};