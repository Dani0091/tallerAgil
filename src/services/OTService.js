// src/services/OTService.js

const OT = require('../models/OT');
const Client = require('../models/Client');
const { v4: uuid } = require('uuid');

class OTService {

  async createOT(data, creado_por) {
    try {
      const clientExists = await Client.findOne({ cliente_id: data.cliente_id });
      if (!clientExists) {
        throw new Error(`Cliente ${data.cliente_id} no existe`);
      }

      if (!data.matricula || !data.marca || !data.modelo || !data.descripcion) {
        throw new Error('Faltan campos: matricula, marca, modelo, descripcion');
      }

      const ot_id = uuid();
      const lineas = data.lineas || [];

      const newOT = new OT({
        ot_id,
        cliente_id: data.cliente_id,
        matricula: data.matricula.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        version: data.version || '',
        descripcion: data.descripcion,
        lineas,
        estado: 'presupuesto',
        notas_internas: data.notas_internas || '',
        creado_por,
        creado_en: new Date()
      });

      await newOT.save();

      console.log(`OT ${ot_id} creada (presupuesto) para cliente ${data.cliente_id}`);
      return newOT;

    } catch (error) {
      console.error('Error en createOT:', error.message);
      throw error;
    }
  }

  async addLinea(ot_id, linea) {
    try {
      const ot = await OT.findOne({ ot_id });
      if (!ot) throw new Error('OT no encontrada');

      if (ot.estado === 'finalizado') {
        throw new Error('No se puede modificar OT finalizada');
      }

      if (!linea.tipo || !linea.descripcion || !linea.cantidad || !linea.precio_unitario) {
        throw new Error('Línea incompleta: tipo, descripcion, cantidad, precio_unitario requeridos');
      }

      ot.lineas.push(linea);
      await ot.save();

      console.log(`Línea agregada a OT ${ot_id}`);
      return ot;

    } catch (error) {
      console.error('Error en addLinea:', error.message);
      throw error;
    }
  }

  async removeLinea(ot_id, lineaIndex) {
    try {
      const ot = await OT.findOne({ ot_id });
      if (!ot) throw new Error('OT no encontrada');

      if (ot.estado === 'finalizado') {
        throw new Error('No se puede modificar OT finalizada');
      }

      if (lineaIndex < 0 || lineaIndex >= ot.lineas.length) {
        throw new Error('Índice de línea inválido');
      }

      ot.lineas.splice(lineaIndex, 1);
      await ot.save();

      console.log(`Línea ${lineaIndex} eliminada de OT ${ot_id}`);
      return ot;

    } catch (error) {
      console.error('Error en removeLinea:', error.message);
      throw error;
    }
  }

  async changeState(ot_id, newState) {
    try {
      const validStates = ['presupuesto', 'aprobado', 'en_proceso', 'finalizado', 'cancelado'];
      if (!validStates.includes(newState)) {
        throw new Error(`Estado inválido. Válidos: ${validStates.join(', ')}`);
      }

      const ot = await OT.findOne({ ot_id });
      if (!ot) throw new Error('OT no encontrada');

      const updateData = {
        estado: newState,
        actualizado_en: new Date()
      };

      if (newState === 'aprobado' && !ot.fecha_aprobacion) {
        updateData.fecha_aprobacion = new Date();
      }

      if (newState === 'en_proceso' && !ot.fecha_inicio) {
        updateData.fecha_inicio = new Date();
      }

      if (newState === 'finalizado' && !ot.fecha_finalizacion) {
        updateData.fecha_finalizacion = new Date();
      }

      const updatedOT = await OT.findOneAndUpdate(
        { ot_id },
        updateData,
        { new: true }
      );

      console.log(`OT ${ot_id} cambió a estado: ${newState}`);
      return updatedOT;

    } catch (error) {
      console.error('Error en changeState:', error.message);
      throw error;
    }
  }

  async searchByMatricula(matricula, limit = 10) {
    try {
      const ots = await OT.find({ 
        matricula: { $regex: matricula.toUpperCase(), $options: 'i' } 
      })
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .sort({ fecha_creacion: -1 })
        .limit(limit)
        .lean();

      return ots;

    } catch (error) {
      console.error('Error en searchByMatricula:', error.message);
      throw error;
    }
  }

  async getHistoricoVehiculo(matricula) {
    try {
      const ots = await OT.find({ 
        matricula: matricula.toUpperCase() 
      })
        .select('ot_id descripcion estado fecha_creacion fecha_finalizacion totales')
        .sort({ fecha_creacion: -1 })
        .lean();

      return {
        matricula: matricula.toUpperCase(),
        total_ots: ots.length,
        ots
      };

    } catch (error) {
      console.error('Error en getHistoricoVehiculo:', error.message);
      throw error;
    }
  }

  async getOTById(ot_id) {
    try {
      const ot = await OT.findOne({ ot_id }).lean();
      if (!ot) throw new Error(`OT ${ot_id} no encontrada`);
      return ot;
    } catch (error) {
      console.error('Error en getOTById:', error.message);
      throw error;
    }
  }

  async listByState(estado, limit = 50) {
    try {
      const ots = await OT.find({ estado })
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .sort({ fecha_creacion: -1 })
        .limit(limit)
        .lean();

      return ots;
    } catch (error) {
      console.error('Error en listByState:', error.message);
      throw error;
    }
  }

  async listOTs(skip = 0, limit = 20) {
    try {
      const total = await OT.countDocuments();

      const ots = await OT.find()
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .skip(skip)
        .limit(limit)
        .sort({ fecha_creacion: -1 })
        .lean();

      return {
        total,
        ots,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error en listOTs:', error.message);
      throw error;
    }
  }

}

module.exports = new OTService();