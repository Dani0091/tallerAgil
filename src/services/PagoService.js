// src/services/PagoService.js

const Pago = require('../models/Pago');
const Factura = require('../models/Factura');
const { v4: uuid } = require('uuid');

class PagoService {

  async createPago(factura_id, monto, metodo, referencia = '', documento_url = null) {
    try {
      const factura = await Factura.findOne({ factura_id });
      if (!factura) {
        throw new Error(`Factura no encontrada`);
      }

      const pago_id = uuid();

      const newPago = new Pago({
        pago_id,
        factura_id,
        monto,
        metodo,
        referencia,
        documento_url,
        creado_en: new Date()
      });

      await newPago.save();

      await Factura.findOneAndUpdate(
        { factura_id },
        { 
          $push: { pagos: { pago_id, monto, metodo, referencia, fecha: new Date() } },
          monto_pagado: factura.monto_pagado + monto
        }
      );

      console.log(`Pago ${pago_id} creado para factura ${factura_id}`);
      return newPago;

    } catch (error) {
      console.error('Error en createPago:', error.message);
      throw error;
    }
  }

  async getPagosByFactura(factura_id) {
    try {
      const pagos = await Pago.find({ factura_id })
        .sort({ fecha: -1 })
        .lean();

      return pagos;

    } catch (error) {
      console.error('Error en getPagosByFactura:', error.message);
      throw error;
    }
  }

}

module.exports = new PagoService();