// src/services/FacturaService.js

const Factura = require('../models/Factura');
const OT = require('../models/OT');
const Client = require('../models/Client');
const { v4: uuid } = require('uuid');
const { EMPRESA } = require('../config/constants');

class FacturaService {

  async generateNumeroFactura() {
    try {
      const year = new Date().getFullYear();
      
      const facturas = await Factura.find({
        numero: { $regex: `^${year}-` }
      }).sort({ creado_en: -1 }).limit(1);

      let nextNumber = 1;
      if (facturas.length > 0) {
        const lastNum = parseInt(facturas[0].numero.split('-')[1]);
        nextNumber = lastNum + 1;
      }

      return `${year}-${nextNumber.toString().padStart(3, '0')}`;

    } catch (error) {
      console.error('Error en generateNumeroFactura:', error.message);
      throw error;
    }
  }

  async createFromOT(ot_id, tasa_iva = 21, observaciones = '') {
    try {
      const ot = await OT.findOne({ ot_id });
      if (!ot) throw new Error(`OT ${ot_id} no encontrada`);

      if (ot.estado !== 'finalizado') {
        throw new Error(`OT debe estar FINALIZADO. Estado actual: ${ot.estado}`);
      }

      const cliente = await Client.findOne({ cliente_id: ot.cliente_id });
      if (!cliente) throw new Error('Cliente no encontrado');

      const numero = await this.generateNumeroFactura();
      const factura_id = uuid();
      const fecha_emision = new Date();
      const fecha_vencimiento = new Date();
      fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 30);

      const items = ot.lineas.map((linea, idx) => ({
        descripcion: linea.descripcion,
        referencia: `${linea.tipo.toUpperCase()}-${idx + 1}`,
        cantidad: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        descuento_porcentaje: linea.descuento_porcentaje || 0,
        subtotal: linea.subtotal
      }));

      const factura = new Factura({
        factura_id,
        ot_id,
        cliente_id: ot.cliente_id,
        numero,
        serie: 'R&S',
        fecha_emision,
        fecha_vencimiento,
        
        empresa: {
          nombre: EMPRESA.nombre,
          nif: EMPRESA.nif,
          direccion: EMPRESA.direccion,
          ciudad: EMPRESA.ciudad,
          telefono: EMPRESA.telefono,
          email: EMPRESA.email
        },
        
        cliente: {
          nombre: cliente.nombre,
          apellidos: cliente.apellidos,
          nif: cliente.nif,
          direccion: cliente.direccion,
          email: cliente.email
        },
        
        items,
        tasa_iva,
        observaciones,
        condiciones_pago: 'Neto a 30 días',
        pagos: [],
        monto_pagado: 0,
        estado_pago: 'pendiente'
      });

      await factura.save();

      console.log(`Factura ${numero} creada desde OT ${ot_id}`);
      return factura;

    } catch (error) {
      console.error('Error en createFromOT:', error.message);
      throw error;
    }
  }

  async getFacturaById(factura_id) {
    try {
      const factura = await Factura.findOne({ factura_id }).lean();

      if (!factura) {
        throw new Error(`Factura ${factura_id} no encontrada`);
      }

      return factura;

    } catch (error) {
      console.error('Error en getFacturaById:', error.message);
      throw error;
    }
  }

  async listByState(estado, limit = 50) {
    try {
      const facturas = await Factura.find({ estado_pago: estado })
        .select('factura_id numero fecha_emision total_factura monto_pendiente estado_pago')
        .sort({ fecha_emision: -1 })
        .limit(limit)
        .lean();

      return facturas;

    } catch (error) {
      console.error('Error en listByState:', error.message);
      throw error;
    }
  }

  async listFacturas(skip = 0, limit = 20) {
    try {
      const total = await Factura.countDocuments();

      const facturas = await Factura.find()
        .select('factura_id numero fecha_emision total_factura monto_pendiente estado_pago cliente')
        .skip(skip)
        .limit(limit)
        .sort({ fecha_emision: -1 })
        .lean();

      return {
        total,
        facturas,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Error en listFacturas:', error.message);
      throw error;
    }
  }

  async addPayment(factura_id, monto, metodo, referencia = '', notas = '') {
    try {
      const factura = await Factura.findOne({ factura_id });
      if (!factura) {
        throw new Error(`Factura ${factura_id} no encontrada`);
      }

      if (monto <= 0) {
        throw new Error('Monto debe ser mayor a 0');
      }

      if (monto > factura.monto_pendiente) {
        throw new Error(`Monto excede pendiente. Pendiente: ${factura.monto_pendiente}`);
      }

      const pago = {
        pago_id: uuid(),
        fecha: new Date(),
        monto,
        metodo,
        referencia,
        notas
      };

      factura.pagos.push(pago);
      factura.monto_pagado += monto;

      await factura.save();

      console.log(`Pago de ${monto}€ registrado en factura ${factura.numero}`);
      return factura;

    } catch (error) {
      console.error('Error en addPayment:', error.message);
      throw error;
    }
  }

}

module.exports = new FacturaService();