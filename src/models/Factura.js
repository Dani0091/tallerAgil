const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  descripcion: String,
  referencia: String,
  cantidad: Number,
  precio_unitario: Number,
  descuento_porcentaje: { type: Number, default: 0 },
  subtotal: Number,
  _id: false,
});

const PagoSchema = new mongoose.Schema({
  pago_id: String,
  fecha: Date,
  monto: Number,
  metodo: String,
  referencia: String,
  notas: String,
  _id: false,
});

const FacturaSchema = new mongoose.Schema({
  factura_id: { type: String, required: true, unique: true },
  ot_id: String,
  cliente_id: { type: String, required: true },
  
  numero: { type: String, required: true, unique: true },
  serie: { type: String, default: 'R&S' },
  fecha_emision: { type: Date, required: true },
  fecha_vencimiento: { type: Date, required: true },
  
  empresa: {
    nombre: String,
    nif: String,
    direccion: String,
    ciudad: String,
    telefono: String,
    email: String,
  },
  
  cliente: {
    nombre: String,
    apellidos: String,
    nif: String,
    direccion: String,
    email: String,
  },
  
  items: [ItemSchema],
  
  base_imponible: Number,
  descuento_total: { type: Number, default: 0 },
  subtotal_neto: Number,
  tasa_iva: { type: Number, default: 21 },
  iva_total: Number,
  total_factura: Number,
  
  observaciones: String,
  condiciones_pago: { type: String, default: 'Neto a 30 días' },
  
  pagos: [PagoSchema],
  monto_pagado: { type: Number, default: 0 },
  monto_pendiente: Number,
  estado_pago: {
    type: String,
    enum: ['pendiente', 'parcial', 'pagado', 'vencido'],
    default: 'pendiente',
  },
  
  pdf_link: String,
  justificante_pago_link: String,
  
  creado_en: { type: Date, default: Date.now },
  modificado_en: { type: Date, default: Date.now },
  creado_por: String,
  
  intento_pago_stripe: String,
  estado_pago_automatico: String,
}, { collection: 'facturas' });

FacturaSchema.index({ numero: 1 }, { unique: true });
FacturaSchema.index({ factura_id: 1 }, { unique: true });
FacturaSchema.index({ cliente_id: 1 });
FacturaSchema.index({ estado_pago: 1 });
FacturaSchema.index({ fecha_emision: -1 });

FacturaSchema.pre('save', function() {
  this.base_imponible = this.items?.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0) || 0;
  this.subtotal_neto = this.base_imponible - this.descuento_total;
  this.iva_total = Math.round(this.subtotal_neto * (this.tasa_iva / 100) * 100) / 100;
  this.total_factura = this.subtotal_neto + this.iva_total;
  this.monto_pendiente = this.total_factura - this.monto_pagado;
  this.modificado_en = Date.now();
  
  if (this.monto_pagado === 0) {
    this.estado_pago = 'pendiente';
  } else if (this.monto_pagado < this.total_factura) {
    this.estado_pago = 'parcial';
  } else if (this.monto_pagado >= this.total_factura) {
    this.estado_pago = 'pagado';
  }
});

module.exports = mongoose.model('Factura', FacturaSchema);
