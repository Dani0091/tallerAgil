// src/services/ClientService.js

const Client = require('../models/Client');
const { v4: uuid } = require('uuid');

class ClientService {

  async createClient(data) {
    try {
      if (!data.nombre || !data.apellidos || !data.nif || !data.email || !data.direccion) {
        throw new Error('Faltan campos requeridos: nombre, apellidos, nif, email, direccion');
      }

      const cliente_id = uuid();

      const newClient = new Client({
        cliente_id,
        ...data,
        fecha_alta: new Date(),
        estado: 'activo'
      });

      await newClient.save();

      console.log(`Cliente ${cliente_id} creado exitosamente`);
      return newClient;

    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Este NIF ya está registrado');
      }
      throw error;
    }
  }

  async getClientById(cliente_id) {
    try {
      const client = await Client.findOne({ cliente_id })
        .select('cliente_id nombre apellidos nif email telefono direccion razon_social notas fecha_alta estado')
        .lean();

      if (!client) {
        console.warn(`Cliente ${cliente_id} no encontrado`);
        return null;
      }

      return client;

    } catch (error) {
      console.error('Error en getClientById:', error.message);
      throw error;
    }
  }

  async getClientByNIF(nif) {
    try {
      const client = await Client.findOne({ nif })
        .select('cliente_id nombre apellidos nif email telefono')
        .lean();

      return client || null;

    } catch (error) {
      console.error('Error en getClientByNIF:', error.message);
      throw error;
    }
  }

  async searchClients(query, limit = 10) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const clients = await Client.find({
        $or: [
          { nombre: { $regex: query, $options: 'i' } },
          { apellidos: { $regex: query, $options: 'i' } },
          { nif: { $regex: query, $options: 'i' } }
        ]
      })
        .select('cliente_id nombre apellidos nif email telefono')
        .limit(limit)
        .lean();

      return clients;

    } catch (error) {
      console.error('Error en searchClients:', error.message);
      throw error;
    }
  }

  async searchAdvanced(query, limit = 10) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const clients = await Client.find({
        $or: [
          { nombre: { $regex: query, $options: 'i' } },
          { apellidos: { $regex: query, $options: 'i' } },
          { nif: { $regex: query, $options: 'i' } },
          { telefono: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ],
        estado: 'activo'
      })
        .select('cliente_id nombre apellidos nif email telefono')
        .limit(limit)
        .lean();

      return clients;

    } catch (error) {
      console.error('Error en searchAdvanced:', error.message);
      throw error;
    }
  }

  async listClients(skip = 0, limit = 20) {
    try {
      const total = await Client.countDocuments({ estado: 'activo' });

      const clientes = await Client.find({ estado: 'activo' })
        .select('cliente_id nombre apellidos nif email telefono estado')
        .skip(skip)
        .limit(limit)
        .sort({ fecha_alta: -1 })
        .lean();

      return {
        total,
        clientes,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Error en listClients:', error.message);
      throw error;
    }
  }

  async updateClient(cliente_id, data) {
    try {
      delete data.cliente_id;

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

      console.log(`Cliente ${cliente_id} actualizado`);
      return updatedClient;

    } catch (error) {
      console.error('Error en updateClient:', error.message);
      throw error;
    }
  }

  async deleteClient(cliente_id) {
    try {
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

      console.log(`Cliente ${cliente_id} marcado como inactivo`);
      return deletedClient;

    } catch (error) {
      console.error('Error en deleteClient:', error.message);
      throw error;
    }
  }

}

module.exports = new ClientService();