#!/bin/bash

# ================================================================
# SCRIPT PARTE 1: CREAR MODELS Y SERVICES
# Ejecutar desde la raíz del proyecto (tallerAgil/)
# ================================================================

echo "🚀 Creando Models y Services..."

# ================================================================
# MODEL: Client.js
# ================================================================
cat > src/models/Client.js << 'EOF'
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
EOF

echo "✅ Client.js creado"

# ================================================================
# MODEL: OT.js
# ================================================================
cat > src/models/OT.js << 'EOF'
const mongoose = require('mongoose');

const LineaOTSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    enum: ['labor', 'pieza', 'consumible'],
    required: true 
  },
  descripcion: { type: String, required: true },
  cantidad: { type: Number, required: true, default: 1 },
  precio_unitario: { type: Number, required: true },
  descuento_porcentaje: { type: Number, default: 0 },
  iva_porcentaje: { type: Number, default: 21 },
  subtotal: { type: Number, required: true },
  _id: false
});

const OTSchema = new mongoose.Schema({
  ot_id: { type: String, required: true, unique: true },
  cliente_id: { type: String, required: true },
  
  matricula: { type: String, required: true },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  version: { type: String },
  
  descripcion: { type: String, required: true },
  
  lineas: [LineaOTSchema],
  
  totales: {
    subtotal: { type: Number, default: 0 },
    descuento_total: { type: Number, default: 0 },
    base_imponible: { type: Number, default: 0 },
    iva_total: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  estado: { 
    type: String, 
    enum: ['presupuesto', 'aprobado', 'en_proceso', 'finalizado', 'cancelado'],
    default: 'presupuesto'
  },
  
  fecha_creacion: { type: Date, default: Date.now },
  fecha_aprobacion: { type: Date },
  fecha_inicio: { type: Date },
  fecha_finalizacion: { type: Date },
  
  imagenes_links: [String],
  notas_internas: String,
  
  creado_por: String,
  creado_en: { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now },
}, { collection: 'ots' });

OTSchema.index({ ot_id: 1 }, { unique: true });
OTSchema.index({ cliente_id: 1 });
OTSchema.index({ matricula: 1 });
OTSchema.index({ estado: 1 });
OTSchema.index({ fecha_creacion: -1 });

OTSchema.pre('save', function() {
  if (this.lineas && this.lineas.length > 0) {
    let subtotal = 0;
    let descuento_total = 0;
    
    this.lineas.forEach(linea => {
      const subtotalLinea = linea.cantidad * linea.precio_unitario;
      const descuento = (subtotalLinea * linea.descuento_porcentaje) / 100;
      linea.subtotal = subtotalLinea - descuento;
      
      subtotal += subtotalLinea;
      descuento_total += descuento;
    });
    
    const base_imponible = subtotal - descuento_total;
    
    let iva_total = 0;
    this.lineas.forEach(linea => {
      const baseLinea = linea.subtotal;
      const ivaLinea = (baseLinea * linea.iva_porcentaje) / 100;
      iva_total += ivaLinea;
    });
    
    const total = base_imponible + iva_total;
    
    this.totales = {
      subtotal,
      descuento_total,
      base_imponible,
      iva_total,
      total
    };
  }
  
  this.actualizado_en = Date.now();
});

module.exports = mongoose.model('OT', OTSchema);
EOF

echo "✅ OT.js creado"

# ================================================================
# MODEL: Factura.js
# ================================================================
cat > src/models/Factura.js << 'EOF'
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
EOF

echo "✅ Factura.js creado"

# ================================================================
# MODEL: Pago.js
# ================================================================
cat > src/models/Pago.js << 'EOF'
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
EOF

echo "✅ Pago.js creado"

echo ""
echo "✅ PARTE 1 COMPLETA: Models creados"
echo ""
echo "Ahora ejecuta el Script Parte 2 para crear Services, Routes, Middleware, Utils"
