// src/routes/api.js

const express = require('express');
const router = express.Router();
const clientService = require('../services/ClientService');
const otService = require('../services/OTService');
const facturaService = require('../services/FacturaService');
const dashboardService = require('../services/DashboardService');

// ===== CLIENTES =====

router.post('/clientes', async (req, res, next) => {
  try {
    const { nombre, apellidos, nif, email, telefono, direccion, razon_social, notas } = req.body;

    if (!nombre || !apellidos || !nif || !email || !direccion) {
      return res.status(422).json({ error: 'Campos requeridos: nombre, apellidos, nif, email, direccion' });
    }

    const newClient = await clientService.createClient({
      nombre,
      apellidos,
      nif,
      email,
      telefono,
      direccion,
      razon_social,
      notas
    });

    res.status(201).json(newClient);
  } catch (error) {
    next(error);
  }
});

router.get('/clientes/:cliente_id', async (req, res, next) => {
  try {
    const { cliente_id } = req.params;
    const client = await clientService.getClientById(cliente_id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
});

router.get('/clientes', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await clientService.listClients(skip, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/clientes/buscar/:query', async (req, res, next) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const results = await clientService.searchClients(query, limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get('/clientes/buscar-avanzado/:query', async (req, res, next) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const results = await clientService.searchAdvanced(query, limit);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.put('/clientes/:cliente_id', async (req, res, next) => {
  try {
    const { cliente_id } = req.params;
    const { nombre, apellidos, email, telefono, direccion, razon_social, notas } = req.body;

    const updated = await clientService.updateClient(cliente_id, {
      nombre,
      apellidos,
      email,
      telefono,
      direccion,
      razon_social,
      notas
    });

    if (!updated) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/clientes/:cliente_id', async (req, res, next) => {
  try {
    const { cliente_id } = req.params;
    const deleted = await clientService.deleteClient(cliente_id);

    if (!deleted) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ message: 'Cliente marcado como inactivo', data: deleted });
  } catch (error) {
    next(error);
  }
});

// ===== ÓRDENES DE TRABAJO =====

router.post('/ots', async (req, res, next) => {
  try {
    const { cliente_id, matricula, marca, modelo, version, descripcion, lineas } = req.body;
    const creado_por = 'SYSTEM';

    const newOT = await otService.createOT({
      cliente_id,
      matricula,
      marca,
      modelo,
      version,
      descripcion,
      lineas
    }, creado_por);

    res.status(201).json(newOT);
  } catch (error) {
    next(error);
  }
});

router.get('/ots/:ot_id', async (req, res, next) => {
  try {
    const { ot_id } = req.params;
    const ot = await otService.getOTById(ot_id);

    if (!ot) {
      return res.status(404).json({ error: 'OT no encontrada' });
    }

    res.json(ot);
  } catch (error) {
    next(error);
  }
});

router.get('/ots', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await otService.listOTs(skip, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/ots/estado/:estado', async (req, res, next) => {
  try {
    const { estado } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const ots = await otService.listByState(estado, limit);
    res.json(ots);
  } catch (error) {
    next(error);
  }
});

router.get('/ots/matricula/:matricula', async (req, res, next) => {
  try {
    const { matricula } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const ots = await otService.searchByMatricula(matricula, limit);
    res.json(ots);
  } catch (error) {
    next(error);
  }
});

router.put('/ots/:ot_id/estado', async (req, res, next) => {
  try {
    const { ot_id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(422).json({ error: 'Estado requerido' });
    }

    const updated = await otService.changeState(ot_id, estado);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/ots/:ot_id/lineas', async (req, res, next) => {
  try {
    const { ot_id } = req.params;
    const { tipo, descripcion, cantidad, precio_unitario, descuento_porcentaje, iva_porcentaje } = req.body;

    const updated = await otService.addLinea(ot_id, {
      tipo,
      descripcion,
      cantidad: parseFloat(cantidad),
      precio_unitario: parseFloat(precio_unitario),
      descuento_porcentaje: parseFloat(descuento_porcentaje) || 0,
      iva_porcentaje: parseFloat(iva_porcentaje) || 21
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/ots/:ot_id/lineas/:index', async (req, res, next) => {
  try {
    const { ot_id, index } = req.params;
    const updated = await otService.removeLinea(ot_id, parseInt(index));
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/vehiculos/:matricula/historico', async (req, res, next) => {
  try {
    const { matricula } = req.params;
    const historico = await otService.getHistoricoVehiculo(matricula);
    res.json(historico);
  } catch (error) {
    next(error);
  }
});

// ===== FACTURAS =====

router.post('/facturas', async (req, res, next) => {
  try {
    const { ot_id, tasa_iva, observaciones } = req.body;

    if (!ot_id) {
      return res.status(422).json({ error: 'ot_id requerido' });
    }

    const factura = await facturaService.createFromOT(ot_id, tasa_iva, observaciones);
    res.status(201).json(factura);
  } catch (error) {
    next(error);
  }
});

router.get('/facturas/:factura_id', async (req, res, next) => {
  try {
    const { factura_id } = req.params;
    const factura = await facturaService.getFacturaById(factura_id);
    res.json(factura);
  } catch (error) {
    next(error);
  }
});

router.get('/facturas', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await facturaService.listFacturas(skip, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/facturas/estado/:estado', async (req, res, next) => {
  try {
    const { estado } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const facturas = await facturaService.listByState(estado, limit);
    res.json(facturas);
  } catch (error) {
    next(error);
  }
});

router.post('/facturas/:factura_id/pagos', async (req, res, next) => {
  try {
    const { factura_id } = req.params;
    const { monto, metodo, referencia, notas } = req.body;

    if (!monto || !metodo) {
      return res.status(422).json({ error: 'monto y metodo requeridos' });
    }

    const updated = await facturaService.addPayment(factura_id, monto, metodo, referencia, notas);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ===== DASHBOARD =====

router.get('/dashboard/resumen', async (req, res, next) => {
  try {
    const resumen = await dashboardService.getResumen();
    res.json(resumen);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard/ots-pendientes', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const ots = await dashboardService.getOTPendientes(limit);
    res.json(ots);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard/top-cliente', async (req, res, next) => {
  try {
    const result = await dashboardService.getClienteTopIngresos();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;