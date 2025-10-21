// src/services/ClientService.js

const Client = require('../models/Client');
const { v4: uuid } = require('uuid');
const { validateClientData } = require('../utils/validators');

class ClientService {

  /**
   * Crea un nuevo cliente
   * @param {Object} data - Datos del cliente
   * @param {string} data.nombre - Nombre del cliente
   * @param {string} data.apellidos - Apellidos del cliente
   * @param {string} data.nif - NIF/NIE del cliente
   * @param {string} data.email - Email del cliente
   * @param {string} data.direccion - Dirección del cliente
   * @param {string} [data.telefono] - Teléfono del cliente (opcional)
   * @param {string} [data.razon_social] - Razón social (opcional)
   * @param {string} [data.notas] - Notas sobre el cliente (opcional)
   * @returns {Promise<Object>} Cliente creado
   * @throws {Error} Si los datos son inválidos o el NIF ya existe
   */
  async createClient(data) {
    try {
      // Validar datos completos
      const validation = validateClientData(data);
      if (!validation.valid) {
        throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
      }

      // Verificar si el NIF ya existe
      const existingClient = await Client.findOne({ nif: data.nif.toUpperCase().trim() });
      if (existingClient) {
        throw new Error(`El NIF ${data.nif} ya está registrado`);
      }

      const cliente_id = uuid();

      const newClient = new Client({
        cliente_id,
        nombre: data.nombre.trim(),
        apellidos: data.apellidos.trim(),
        nif: data.nif.toUpperCase().trim(),
        email: data.email.toLowerCase().trim(),
        direccion: data.direccion.trim(),
        telefono: data.telefono ? data.telefono.trim() : undefined,
        razon_social: data.razon_social ? data.razon_social.trim() : undefined,
        notas: data.notas ? data.notas.trim() : undefined,
        fecha_alta: new Date(),
        estado: 'activo'
      });

      await newClient.save();

      console.log(`✅ Cliente ${cliente_id} creado: ${data.nombre} ${data.apellidos}`);
      return newClient;

    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Este NIF ya está registrado en el sistema');
      }
      console.error('❌ Error en createClient:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene un cliente por su ID
   * @param {string} cliente_id - ID del cliente
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  async getClientById(cliente_id) {
    try {
      if (!cliente_id) {
        throw new Error('ID de cliente requerido');
      }

      const client = await Client.findOne({ cliente_id })
        .select('cliente_id nombre apellidos nif email telefono direccion razon_social notas fecha_alta estado')
        .lean();

      if (!client) {
        console.warn(`⚠️ Cliente ${cliente_id} no encontrado`);
        return null;
      }

      return client;

    } catch (error) {
      console.error('❌ Error en getClientById:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene un cliente por su NIF
   * @param {string} nif - NIF del cliente
   * @returns {Promise<Object|null>} Cliente encontrado o null
   */
  async getClientByNIF(nif) {
    try {
      if (!nif) {
        throw new Error('NIF requerido');
      }

      const client = await Client.findOne({ nif: nif.toUpperCase().trim() })
        .select('cliente_id nombre apellidos nif email telefono')
        .lean();

      return client || null;

    } catch (error) {
      console.error('❌ Error en getClientByNIF:', error.message);
      throw error;
    }
  }

  /**
   * Busca clientes por nombre, apellidos o NIF
   * @param {string} query - Término de búsqueda
   * @param {number} limit - Límite de resultados (default: 10)
   * @returns {Promise<Array>} Array de clientes encontrados
   */
  async searchClients(query, limit = 10) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = query.trim();

      const clients = await Client.find({
        $or: [
          { nombre: { $regex: searchTerm, $options: 'i' } },
          { apellidos: { $regex: searchTerm, $options: 'i' } },
          { nif: { $regex: searchTerm, $options: 'i' } }
        ],
        estado: 'activo'
      })
        .select('cliente_id nombre apellidos nif email telefono')
        .limit(limit)
        .sort({ nombre: 1 })
        .lean();

      console.log(`🔍 Búsqueda "${query}": ${clients.length} resultados`);
      return clients;

    } catch (error) {
      console.error('❌ Error en searchClients:', error.message);
      throw error;
    }
  }

  /**
   * Búsqueda avanzada de clientes (incluye teléfono y email)
   * @param {string} query - Término de búsqueda
   * @param {number} limit - Límite de resultados (default: 10)
   * @returns {Promise<Array>} Array de clientes encontrados
   */
  async searchAdvanced(query, limit = 10) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = query.trim();

      const clients = await Client.find({
        $or: [
          { nombre: { $regex: searchTerm, $options: 'i' } },
          { apellidos: { $regex: searchTerm, $options: 'i' } },
          { nif: { $regex: searchTerm, $options: 'i' } },
          { telefono: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } }
        ],
        estado: 'activo'
      })
        .select('cliente_id nombre apellidos nif email telefono')
        .limit(limit)
        .sort({ nombre: 1 })
        .lean();

      console.log(`🔍 Búsqueda avanzada "${query}": ${clients.length} resultados`);
      return clients;

    } catch (error) {
      console.error('❌ Error en searchAdvanced:', error.message);
      throw error;
    }
  }

  /**
   * Lista clientes con paginación
   * @param {number} skip - Número de registros a saltar (default: 0)
   * @param {number} limit - Número de registros a retornar (default: 20)
   * @returns {Promise<Object>} { total, clientes, page, totalPages }
   */
  async listClients(skip = 0, limit = 20) {
    try {
      const total = await Client.countDocuments({ estado: 'activo' });

      const clientes = await Client.find({ estado: 'activo' })
        .select('cliente_id nombre apellidos nif email telefono estado')
        .skip(skip)
        .limit(limit)
        .sort({ fecha_alta: -1 })
        .lean();

      console.log(`📋 Listando clientes: ${clientes.length} de ${total}`);

      return {
        total,
        clientes,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('❌ Error en listClients:', error.message);
      throw error;
    }
  }

  /**
   * Actualiza datos de un cliente
   * @param {string} cliente_id - ID del cliente
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Cliente actualizado
   * @throws {Error} Si el cliente no existe
   */
  async updateClient(cliente_id, data) {
    try {
      if (!cliente_id) {
        throw new Error('ID de cliente requerido');
      }

      // No permitir cambiar el ID
      delete data.cliente_id;
      delete data.estado;
      delete data.fecha_alta;

      // Normalizar datos
      if (data.nif) data.nif = data.nif.toUpperCase().trim();
      if (data.email) data.email = data.email.toLowerCase().trim();
      if (data.nombre) data.nombre = data.nombre.trim();
      if (data.apellidos) data.apellidos = data.apellidos.trim();
      if (data.direccion) data.direccion = data.direccion.trim();

      const updatedClient = await Client.findOneAndUpdate(
        { cliente_id },
        {
          ...data,
          actualizado_en: new Date()
        },
        { new: true }
      ).lean();

      if (!updatedClient) {
        throw new Error(`Cliente ${cliente_id} no encontrado`);
      }

      console.log(`✅ Cliente ${cliente_id} actualizado`);
      return updatedClient;

    } catch (error) {
      console.error('❌ Error en updateClient:', error.message);
      throw error;
    }
  }

  /**
   * Marca un cliente como inactivo (borrado lógico)
   * @param {string} cliente_id - ID del cliente
   * @returns {Promise<Object>} Cliente marcado como inactivo
   * @throws {Error} Si el cliente no existe
   */
  async deleteClient(cliente_id) {
    try {
      if (!cliente_id) {
        throw new Error('ID de cliente requerido');
      }

      const deletedClient = await Client.findOneAndUpdate(
        { cliente_id },
        {
          estado: 'inactivo',
          actualizado_en: new Date()
        },
        { new: true }
      ).lean();

      if (!deletedClient) {
        throw new Error(`Cliente ${cliente_id} no encontrado`);
      }

      console.log(`✅ Cliente ${cliente_id} marcado como inactivo`);
      return deletedClient;

    } catch (error) {
      console.error('❌ Error en deleteClient:', error.message);
      throw error;
    }
  }

}

module.exports = new ClientService();
