// src/services/DashboardService.js

const OT = require('../models/OT');
const Factura = require('../models/Factura');
const Client = require('../models/Client');
const cacheService = require('./CacheService');

class DashboardService {

  async getResumen() {
    try {
      const cached = cacheService.get('dashboard:resumen');
      if (cached) return cached;

      const otCompletadas = await OT.countDocuments({ estado: 'finalizado' });
      const otPendientes = await OT.countDocuments({ estado: { $in: ['admitido', 'en_proceso'] } });

      const ingresoResult = await Factura.aggregate([
        { $match: { estado_pago: 'pagado' } },
        { $group: { _id: null, total: { $sum: '$total_factura' } } }
      ]);

      const ingresosBrutos = ingresoResult[0]?.total || 0;
      const iva = Math.round(ingresosBrutos * 0.21 * 100) / 100;
      const ingresosNetos = ingresosBrutos - iva;

      const pendientesResult = await Factura.aggregate([
        { $match: { estado_pago: { $ne: 'pagado' } } },
        { $group: { _id: null, total: { $sum: '$monto_pendiente' } } }
      ]);

      const pagosPendientes = pendientesResult[0]?.total || 0;

      const today = new Date();
      const facturasVencidas = await Factura.countDocuments({
        fecha_vencimiento: { $lt: today },
        estado_pago: { $ne: 'pagado' }
      });

      const resumen = {
        otCompletadas,
        otPendientes,
        ingresosBrutos,
        iva,
        ingresosNetos,
        pagosPendientes,
        facturasVencidas,
        actualizadoEn: new Date()
      };

      cacheService.set('dashboard:resumen', resumen, 300000);

      return resumen;

    } catch (error) {
      console.error('Error en getResumen:', error.message);
      throw error;
    }
  }

  async getOTPendientes(limit = 10) {
    try {
      const cached = cacheService.get('dashboard:ot_pendientes');
      if (cached) return cached;

      const ots = await OT.find({
        estado: { $in: ['admitido', 'en_proceso'] }
      })
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion horas')
        .sort({ fecha_creacion: 1 })
        .limit(limit)
        .lean();

      cacheService.set('dashboard:ot_pendientes', ots, 300000);

      return ots;

    } catch (error) {
      console.error('Error en getOTPendientes:', error.message);
      throw error;
    }
  }

  async getClienteTopIngresos() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const result = await Factura.aggregate([
        {
          $match: {
            fecha_emision: { $gte: startOfMonth },
            estado_pago: 'pagado'
          }
        },
        {
          $group: {
            _id: '$cliente_id',
            total: { $sum: '$total_factura' }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 1 }
      ]);

      if (!result.length) return null;

      const cliente_id = result[0]._id;
      const cliente = await Client.findOne({ cliente_id })
        .select('nombre apellidos nif')
        .lean();

      return {
        cliente,
        total: result[0].total
      };

    } catch (error) {
      console.error('Error en getClienteTopIngresos:', error.message);
      throw error;
    }
  }

  invalidateCache(type = 'all') {
    if (type === 'all') {
      cacheService.delete('dashboard:resumen');
      cacheService.delete('dashboard:ot_pendientes');
    } else if (type === 'ot') {
      cacheService.delete('dashboard:ot_pendientes');
    } else if (type === 'factura') {
      cacheService.delete('dashboard:resumen');
    }
  }

}

module.exports = new DashboardService();