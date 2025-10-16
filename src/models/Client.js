const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  cliente_id: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  apellidos: { type: String, required: true },
  nif: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  telefono: { type: String },
  direccion: { type: String, required: true },
  razon_social: { type: String },
  notas: { type: String },
  fecha_alta: { type: Date, default: Date.now },
  estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  carpeta_supabase: { type: String },
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now },
}, { collection: 'clientes' });

ClientSchema.index({ nif: 1 }, { unique: true });
ClientSchema.index({ email: 1 });
ClientSchema.index({ cliente_id: 1 }, { unique: true });

module.exports = mongoose.model('Cliente', ClientSchema);
