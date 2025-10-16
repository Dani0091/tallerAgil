const mongoose = require('mongoose');

const PagoSchema = new mongoose.Schema({
  pago_id: { type: String, required: true, unique: true },
  factura_id: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  monto: { type: Number, required: true },
  metodo: { 
    type: String,
    enum: ['transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro'],
    required: true
  },
  referencia: String,
  documento_url: String,
  notas: String,
  creado_en: { type: Date, default: Date.now },
}, { collection: 'pagos' });

PagoSchema.index({ factura_id: 1 });
PagoSchema.index({ fecha: -1 });

module.exports = mongoose.model('Pago', PagoSchema);
