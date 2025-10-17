// ============================================
// ARCHIVO 1: src/helpers/supabaseStorage.js (NUEVO)
// ============================================
const supabase = require('../config/supabase');

/**
 * Sube un PDF a Supabase Storage
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<string>} URL pública del PDF
 */
async function uploadPDF(pdfBuffer, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from('facturas')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    // Obtener URL pública
    const { data: publicData } = supabase.storage
      .from('facturas')
      .getPublicUrl(fileName);

    console.log(`✅ PDF subido: ${fileName}`);
    return publicData.publicUrl;
  } catch (error) {
    console.error('❌ Error subiendo PDF:', error.message);
    throw error;
  }
}

/**
 * Elimina un PDF de Supabase Storage
 * @param {string} fileName - Nombre del archivo
 */
async function deletePDF(fileName) {
  try {
    const { error } = await supabase.storage
      .from('facturas')
      .remove([fileName]);

    if (error) throw error;
    console.log(`✅ PDF eliminado: ${fileName}`);
  } catch (error) {
    console.error('❌ Error eliminando PDF:', error.message);
    throw error;
  }
}

module.exports = {
  uploadPDF,
  deletePDF
};


