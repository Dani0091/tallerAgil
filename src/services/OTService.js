// src/services/OTService.js

const OT = require('../models/OT');
const Client = require('../models/Client');
const { v4: uuid } = require('uuid');
const { validateOTData } = require('../utils/validators');

class OTService {

  /**
   * Crea una nueva Orden de Trabajo
   * @param {Object} data - Datos de la OT
   * @param {string} data.cliente_id - ID del cliente
   * @param {string} data.matricula - Matrícula del vehículo
   * @param {string} data.marca - Marca del vehículo
   * @param {string} data.modelo - Modelo del vehículo
   * @param {string} data.descripcion - Descripción del trabajo
   * @param {string} [data.version] - Versión del vehículo (opcional)
   * @param {Array} [data.lineas] - Líneas de trabajo (opcional)
   * @param {string} creado_por - ID del usuario que crea la OT
   * @returns {Promise<Object>} OT creada
   * @throws {Error} Si los datos son inválidos o el cliente no existe
   */
  async createOT(data, creado_por) {
    try {
      // Validar datos
      const validation = validateOTData(data);
      if (!validation.valid) {
        throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
      }

      // Verificar que el cliente existe
      const clientExists = await Client.findOne({ cliente_id: data.cliente_id });
      if (!clientExists) {
        throw new Error(`Cliente ${data.cliente_id} no existe`);
      }

      const ot_id = uuid();
      const lineas = data.lineas || [];

      const newOT = new OT({
        ot_id,
        cliente_id: data.cliente_id,
        matricula: data.matricula.toUpperCase().replace(/\s|-/g, ''),
        marca: data.marca.trim(),
        modelo: data.modelo.trim(),
        version: data.version ? data.version.trim() : '',
        descripcion: data.descripcion.trim(),
        lineas,
        estado: 'presupuesto',
        notas_internas: data.notas_internas || '',
        creado_por,
        creado_en: new Date()
      });

      await newOT.save();

      console.log(`✅ OT ${ot_id} creada (presupuesto) - Matrícula: ${newOT.matricula}`);
      return newOT;

    } catch (error) {
      console.error('❌ Error en createOT:', error.message);
      throw error;
    }
  }

  /**
   * Agrega una línea de trabajo/repuesto a una OT
   * @param {string} ot_id - ID de la OT
   * @param {Object} linea - Línea a agregar
   * @param {string} linea.tipo - Tipo: 'mano_obra', 'repuesto', 'otro'
   * @param {string} linea.descripcion - Descripción de la línea
   * @param {number} linea.cantidad - Cantidad
   * @param {number} linea.precio_unitario - Precio unitario
   * @param {number} [linea.descuento_porcentaje] - Descuento en % (opcional)
   * @returns {Promise<Object>} OT actualizada
   * @throws {Error} Si la OT no existe o está finalizada
   */
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

      // Validar tipo
      const tiposValidos = ['mano_obra', 'repuesto', 'otro'];
      if (!tiposValidos.includes(linea.tipo)) {
        throw new Error(`Tipo inválido. Válidos: ${tiposValidos.join(', ')}`);
      }

      // Calcular subtotal
      const descuento = linea.descuento_porcentaje || 0;
      const subtotal = (linea.cantidad * linea.precio_unitario) * (1 - descuento / 100);

      ot.lineas.push({
        ...linea,
        subtotal
      });

      await ot.save();

      console.log(`✅ Línea agregada a OT ${ot_id}: ${linea.descripcion}`);
      return ot;

    } catch (error) {
      console.error('❌ Error en addLinea:', error.message);
      throw error;
    }
  }

  /**
   * Elimina una línea de una OT
   * @param {string} ot_id - ID de la OT
   * @param {number} lineaIndex - Índice de la línea a eliminar
   * @returns {Promise<Object>} OT actualizada
   * @throws {Error} Si la OT no existe, está finalizada o el índice es inválido
   */
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

      console.log(`✅ Línea ${lineaIndex} eliminada de OT ${ot_id}`);
      return ot;

    } catch (error) {
      console.error('❌ Error en removeLinea:', error.message);
      throw error;
    }
  }

  /**
   * Cambia el estado de una OT
   * @param {string} ot_id - ID de la OT
   * @param {string} newState - Nuevo estado: 'presupuesto', 'aprobado', 'en_proceso', 'finalizado', 'cancelado'
   * @returns {Promise<Object>} OT actualizada
   * @throws {Error} Si la OT no existe o el estado es inválido
   */
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

      // Registrar fechas según el estado
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

      console.log(`✅ OT ${ot_id} cambió a estado: ${newState}`);
      return updatedOT;

    } catch (error) {
      console.error('❌ Error en changeState:', error.message);
      throw error;
    }
  }

  /**
   * Busca OTs por matrícula
   * @param {string} matricula - Matrícula a buscar
   * @param {number} limit - Límite de resultados (default: 10)
   * @returns {Promise<Array>} Array de OTs encontradas
   */
  async searchByMatricula(matricula, limit = 10) {
    try {
      if (!matricula || matricula.trim().length === 0) {
        return [];
      }

      const ots = await OT.find({
        matricula: { $regex: matricula.toUpperCase().replace(/\s|-/g, ''), $options: 'i' }
      })
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .sort({ fecha_creacion: -1 })
        .limit(limit)
        .lean();

      console.log(`🔍 Búsqueda matrícula "${matricula}": ${ots.length} OTs`);
      return ots;

    } catch (error) {
      console.error('❌ Error en searchByMatricula:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene el histórico de OTs de un vehículo
   * @param {string} matricula - Matrícula del vehículo
   * @returns {Promise<Object>} { matricula, total_ots, ots }
   */
  async getHistoricoVehiculo(matricula) {
    try {
      if (!matricula || matricula.trim().length === 0) {
        throw new Error('Matrícula requerida');
      }

      const ots = await OT.find({
        matricula: matricula.toUpperCase().replace(/\s|-/g, '')
      })
        .select('ot_id descripcion estado fecha_creacion fecha_finalizacion totales')
        .sort({ fecha_creacion: -1 })
        .lean();

      console.log(`📋 Histórico de ${matricula}: ${ots.length} OTs`);

      return {
        matricula: matricula.toUpperCase(),
        total_ots: ots.length,
        ots
      };

    } catch (error) {
      console.error('❌ Error en getHistoricoVehiculo:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene una OT por su ID
   * @param {string} ot_id - ID de la OT
   * @returns {Promise<Object>} OT encontrada
   * @throws {Error} Si la OT no existe
   */
  async getOTById(ot_id) {
    try {
      if (!ot_id) {
        throw new Error('ID de OT requerido');
      }

      const ot = await OT.findOne({ ot_id }).lean();
      if (!ot) throw new Error(`OT ${ot_id} no encontrada`);

      return ot;

    } catch (error) {
      console.error('❌ Error en getOTById:', error.message);
      throw error;
    }
  }

  /**
   * Lista OTs por estado
   * @param {string} estado - Estado de las OTs
   * @param {number} limit - Límite de resultados (default: 50)
   * @returns {Promise<Array>} Array de OTs
   */
  async listByState(estado, limit = 50) {
    try {
      const validStates = ['presupuesto', 'aprobado', 'en_proceso', 'finalizado', 'cancelado'];
      if (!validStates.includes(estado)) {
        throw new Error(`Estado inválido. Válidos: ${validStates.join(', ')}`);
      }

      const ots = await OT.find({ estado })
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .sort({ fecha_creacion: -1 })
        .limit(limit)
        .lean();

      console.log(`📋 OTs con estado "${estado}": ${ots.length}`);
      return ots;

    } catch (error) {
      console.error('❌ Error en listByState:', error.message);
      throw error;
    }
  }

  /**
   * Lista todas las OTs con paginación
   * @param {number} skip - Número de registros a saltar (default: 0)
   * @param {number} limit - Número de registros a retornar (default: 20)
   * @returns {Promise<Object>} { total, ots, page, totalPages }
   */
  async listOTs(skip = 0, limit = 20) {
    try {
      const total = await OT.countDocuments();

      const ots = await OT.find()
        .select('ot_id cliente_id matricula marca modelo estado fecha_creacion totales')
        .skip(skip)
        .limit(limit)
        .sort({ fecha_creacion: -1 })
        .lean();

      console.log(`📋 Listando OTs: ${ots.length} de ${total}`);

      return ots; // Mantener compatibilidad con el código existente

    } catch (error) {
      console.error('❌ Error en listOTs:', error.message);
      throw error;
    }
  }

}

module.exports = new OTService();
