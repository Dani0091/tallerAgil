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
