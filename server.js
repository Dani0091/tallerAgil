// server.js - Backend for the "Taller Ágil" Telegram bot
// Handles Telegram webhook, business logic, MongoDB Atlas connection, Supabase storage, and PDF generation.
// Features: Modular structure with classes for services, error handling, async/await, caching, inline keyboards, wizards.
// Business Logic: Clients, OT, invoices with PDFs, dashboard, search, queries.
// UX: Guided wizards, load notifications (>2s), confirmation/cancel options.

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { default: fetch } = require('node-fetch');
const { v4: uuid } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
app.use(bodyParser.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN; // Telegram bot token
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Admin chat ID for notifications
const TARIFA_HORA = 40; // Hourly labor rate in euros
const IVA_POR_DEFECTO = 21; // Default IVA percentage
const SUPABASE_URL = process.env.SUPABASE_URL; // Supabase URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Supabase anonymous key

let isBotActive = true; // Bot active/paused state
let userStates = {}; // Temporary user states for wizards and caching
const CACHE_TTL = 300000; // Cache TTL: 5 minutes in ms

// Initialize Supabase for storage (PDFs, photos)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected at ' + new Date().toISOString()))
  .catch(error => console.error('MongoDB connection error at ' + new Date().toISOString() + ': ' + error.message));

// Mongoose Schemas
const ClientSchema = new mongoose.Schema({
  id: String,
  nombre: String,
  apellidos: String,
  telefono: String,
  email: String,
  nif: String,
  direccion: String,
  razon_social: String,
  notas: String,
  fecha_alta: String,
  carpeta_id: String,
});

const OTSchema = new mongoose.Schema({
  OT_ID: String,
  cliente_id: String,
  matricula: String,
  marca: String,
  modelo: String,
  descripcion: String,
  horas: Number,
  piezas_notas: String,
  consumibles_notas: String,
  coste_estimado: Number,
  estado: String,
  fecha_creacion: String,
  fecha_finalizacion: String,
  imagenes_links: String,
});

const FacturaSchema = new mongoose.Schema({
  factura_id: String,
  OT_ID: String,
  cliente_id: String,
  numero: String,
  fecha: String,
  subtotal: Number,
  iva_total: Number,
  total: Number,
  pagado: String,
  pdf_link: String,
  pagos: Array,
  tasa_iva: Number,
  observaciones: String,
});

// Mongoose Models
const Client = mongoose.model('Client', ClientSchema);
const OT = mongoose.model('OT', OTSchema);
const Factura = mongoose.model('Factura', FacturaSchema);

// Service Classes
class ClientService {
  async createClient(data) {
    const id = uuid();
    const fecha_alta = new Date().toISOString().split('T')[0];
    const client = new Client({ id, ...data, fecha_alta, carpeta_id: 'supabase-folder' });
    await client.save();
    return client;
  }

  async getClientById(id) {
    return await Client.findOne({ id });
  }

  async searchClients(query) {
    const cacheKey = `search:${query}`;
    if (userStates[cacheKey] && (Date.now() - userStates[cacheKey].timestamp < CACHE_TTL)) {
      return userStates[cacheKey].data;
    }
    const result = await Client.find({ $or: [{ nombre: { $regex: query, $options: 'i' } }, { nif: { $regex: query, $options: 'i' } }] });
    userStates[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  }
}

class OTService {
  async createOT(data) {
    const OT_ID = uuid();
    const ot = new OT({ OT_ID, ...data, estado: 'pendiente', fecha_creacion: new Date().toISOString() });
    await ot.save();
    return ot;
  }

  async getOTById(OT_ID) {
    return await OT.findOne({ OT_ID });
  }

  async updateOTField(OT_ID, field, value) {
    await OT.updateOne({ OT_ID }, { [field]: value });
  }

  async listOTs(limit = 10) {
    const cacheKey = `list:ots`;
    if (userStates[cacheKey] && (Date.now() - userStates[cacheKey].timestamp < CACHE_TTL)) {
      return userStates[cacheKey].data;
    }
    const result = await OT.find().sort({ fecha_creacion: -1 }).limit(limit);
    userStates[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  }
}

class InvoiceService {
  async generateNumeroFactura() {
    const facturas = await Factura.find({});
    const nums = facturas.map(f => parseInt(f.numero) || 0);
    return (Math.max(...nums, 0) + 1).toString().padStart(4, '0');
  }

  async generateInvoice(otId, tasa_iva = IVA_POR_DEFECTO, observaciones = '') {
    const startTime = Date.now();
    await sendText(otId, 'Procesando...');

    const ot = await OT.findOne({ OT_ID: otId });
    if (!ot) throw new Error('OT no encontrada');
    const cliente = await Client.findOne({ id: ot.cliente_id });
    if (!cliente) throw new Error('Cliente no encontrado');

    const numero = await this.generateNumeroFactura();
    const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const subtotal = parseFloat(ot.horas) * TARIFA_HORA;
    const iva_total = Math.round(subtotal * tasa_iva / 100 * 100) / 100;
    const total = subtotal + iva_total;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    // Header
    page.drawText('TALLER ÁGIL', { x: 50, y: height - 70, size: 24, color: rgb(0.8, 0.2, 0.2), font });
    page.drawText('C/ Ejemplo 123, 28001 Madrid', { x: 50, y: height - 90, size: 12, font });
    page.drawText('NIF: A12345678', { x: 50, y: height - 110, size: 12, font });
    page.drawText('FACTURA', { x: width - 150, y: height - 70, size: 18, font });
    page.drawText(`Fecha: ${fecha}`, { x: width - 150, y: height - 90, size: 12, font });
    page.drawText(`Nº Factura: ${numero}`, { x: width - 150, y: height - 110, size: 12, font });

    // Client details
    page.drawText('Cobrar a:', { x: 50, y: height - 150, size: 14, font });
    page.drawText(`${cliente.nombre} ${cliente.apellidos}`, { x: 50, y: height - 170, size: 12, font });
    page.drawText(`Marca: ${ot.marca}`, { x: 50, y: height - 190, size: 12, font });
    page.drawText(`Matrícula: ${ot.matricula}`, { x: 50, y: height - 210, size: 12, font });
    page.drawText(`Teléfono: ${cliente.telefono}`, { x: 50, y: height - 230, size: 12, font });
    page.drawText(`Email: ${cliente.email}`, { x: 50, y: height - 250, size: 12, font });

    // Table
    const tableY = height - 280;
    page.drawLine({ start: { x: 50, y: tableY }, end: { x: width - 50, y: tableY }, thickness: 1 });
    page.drawText('Descripción/Ref', { x: 50, y: tableY - 20, size: 12, font });
    page.drawText('Cantidad', { x: 250, y: tableY - 20, size: 12, font });
    page.drawText('Precio Unitario (€)', { x: 330, y: tableY - 20, size: 12, font });
    page.drawText('Total (€)', { x: 430, y: tableY - 20, size: 12, font });
    page.drawLine({ start: { x: 50, y: tableY - 30 }, end: { x: width - 50, y: tableY - 30 }, thickness: 1 });

    let rowY = tableY - 50;
    // Labor
    page.drawText(ot.descripcion, { x: 50, y: rowY, size: 12, font });
    page.drawText(ot.horas.toString(), { x: 250, y: rowY, size: 12, font });
    page.drawText(TARIFA_HORA.toFixed(2), { x: 330, y: rowY, size: 12, font });
    page.drawText(subtotal.toFixed(2), { x: 430, y: rowY, size: 12, font });
    rowY -= 20;

    // Parts/Consumables
    if (ot.coste_estimado > 0) {
      page.drawText(ot.piezas_notas || 'Piezas/Consumibles', { x: 50, y: rowY, size: 12, font });
      page.drawText('1', { x: 250, y: rowY, size: 12, font });
      page.drawText(ot.coste_estimado.toFixed(2), { x: 330, y: rowY, size: 12, font });
      page.drawText(ot.coste_estimado.toFixed(2), { x: 430, y: rowY, size: 12, font });
      rowY -= 20;
    }

    // Totals
    page.drawLine({ start: { x: 50, y: rowY - 10 }, end: { x: width - 50, y: rowY - 10 }, thickness: 1 });
    rowY -= 20;
    page.drawText('Total Parcial', { x: 350, y: rowY, size: 12, font });
    page.drawText(subtotal.toFixed(2), { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText('Descuento', { x: 350, y: rowY, size: 12, font });
    page.drawText('0.00', { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText('Subtotal', { x: 350, y: rowY, size: 12, font });
    page.drawText(subtotal.toFixed(2), { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText(`Tasa de Impuesto (${tasa_iva}%)`, { x: 350, y: rowY, size: 12, font });
    page.drawText(iva_total.toFixed(2), { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText('Total Impuestos', { x: 350, y: rowY, size: 12, font });
    page.drawText(iva_total.toFixed(2), { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText('Envío/Manipulación', { x: 350, y: rowY, size: 12, font });
    page.drawText('0.00', { x: 430, y: rowY, size: 12, font });
    rowY -= 20;
    page.drawText('Cotización Total', { x: 350, y: rowY, size: 12, font, color: rgb(1, 0, 0) });
    page.drawText(total.toFixed(2), { x: 430, y: rowY, size: 12, font, color: rgb(1, 0, 0) });

    // Final red line
    page.drawLine({ start: { x: 50, y: rowY - 30 }, end: { x: width - 50, y: rowY - 30 }, thickness: 2, color: rgb(1, 0, 0) });

    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase
    const { data, error } = await supabase.storage.from('facturas').upload(`Factura_${numero}.pdf`, pdfBytes, { contentType: 'application/pdf' });
    if (error) throw new Error('Error uploading PDF: ' + error.message);
    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/facturas/Factura_${numero}.pdf`;

    const factura_id = uuid();
    const factura = new Factura({ factura_id, OT_ID: otId, cliente_id: ot.cliente_id, numero, fecha, subtotal, iva_total, total, pagado: 'no', pdf_link: pdfUrl, pagos: [], tasa_iva, observaciones });
    await factura.save();
    await OT.updateOne({ OT_ID: otId }, { estado: 'finalizado' });

    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 2) await sendText(otId, `Factura generada en ${elapsed}s. Descarga: ${pdfUrl}`);
    else await sendText(otId, `Factura generada. Descarga: ${pdfUrl}`);
    return { factura, pdfUrl };
  }
}

class PaymentService {
  async createPayment(factura_id, monto, metodo) {
    try {
      const pago_id = uuid();
      const fecha = new Date().toISOString().split('T')[0];
      const pago = new Pago({ pago_id, factura_id, monto, fecha, metodo });
      await pago.save();
      await Factura.updateOne({ factura_id }, { $push: { pagos: pago }, $set: { pagado: monto >= (await Factura.findOne({ factura_id })).total ? 'sí' : 'no' } });
      return pago;
    } catch (error) {
      console.error('Error creating payment:', error.message);
      throw error;
    }
  }
}

// Helper Functions
async function sendText(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (error) {
    console.error('Error sending text:', error.message);
  }
}

async function sendKb(chatId, text, kb) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: kb } })
    });
  } catch (error) {
    console.error('Error sending keyboard:', error.message);
  }
}

function btn(label, callback) {
  return { text: label, callback_data: callback };
}

// Handlers
async function handleClientes(chatId, action) {
  switch (action) {
    case 'clientes:nuevo':
      userStates[chatId] = { step: 'nombre', data: {} };
      await sendKb(chatId, 'Nuevo Cliente - Paso 1: Ingresa nombre', [[btn('Siguiente', 'clientes:nuevo:next')]]);
      break;
    case 'clientes:nuevo:next':
      if (!userStates[chatId]) return await sendText(chatId, 'Sesión expirada. Reinicia con /start.');
      if (userStates[chatId].step === 'nombre') {
        await sendKb(chatId, 'Paso 2: Ingresa apellidos', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'apellidos';
      } else if (userStates[chatId].step === 'apellidos') {
        await sendKb(chatId, 'Paso 3: Ingresa teléfono', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'telefono';
      } else if (userStates[chatId].step === 'telefono') {
        await sendKb(chatId, 'Paso 4: Ingresa email', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'email';
      } else if (userStates[chatId].step === 'email') {
        await sendKb(chatId, 'Paso 5: Ingresa NIF', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'nif';
      } else if (userStates[chatId].step === 'nif') {
        await sendKb(chatId, 'Paso 6: Ingresa dirección', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'direccion';
      } else if (userStates[chatId].step === 'direccion') {
        await sendKb(chatId, 'Paso 7: Ingresa razón social (opcional)', [[btn('Guardar', 'clientes:nuevo:save'), btn('Editar', 'clientes:nuevo:edit'), btn('Cancelar', 'clientes:cancel')]]);
        userStates[chatId].step = 'razon_social';
      }
      break;
    case 'clientes:nuevo:save':
      if (!userStates[chatId]?.data) return await sendText(chatId, 'Datos incompletos. Reinicia con /start.');
      await sendText(chatId, 'Procesando...');
      const clientData = userStates[chatId].data;
      await new ClientService().createClient(clientData);
      delete userStates[chatId];
      await sendText(chatId, 'Cliente guardado exitosamente.');
      break;
    case 'clientes:nuevo:edit':
      if (!userStates[chatId]) return await sendText(chatId, 'Sesión expirada. Reinicia con /start.');
      userStates[chatId].step = 'nombre'; // Restart wizard
      await sendKb(chatId, 'Edición - Paso 1: Ingresa nombre', [[btn('Siguiente', 'clientes:nuevo:next'), btn('Cancelar', 'clientes:cancel')]]);
      break;
    case 'clientes:cancel':
      delete userStates[chatId];
      await sendKb(chatId, 'Menú Principal', [
        [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
        [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
        [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
      ]);
      break;
    case 'clientes:lista':
      await sendText(chatId, 'Procesando...');
      const clients = await new ClientService().searchClients('');
      await sendText(chatId, clients.map(c => `${c.nombre} ${c.apellidos} (NIF: ${c.nif})`).join('\n') || 'No hay clientes.');
      break;
  }
}

async function handleOT(chatId, action) {
  switch (action) {
    case 'ots:nueva':
      userStates[chatId] = { step: 'cliente_id', data: {} };
      await sendKb(chatId, 'Nueva OT - Paso 1: Selecciona cliente (ingresa ID)', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
      break;
    case 'ots:nueva:next':
      if (!userStates[chatId]) return await sendText(chatId, 'Sesión expirada. Reinicia con /start.');
      if (userStates[chatId].step === 'cliente_id') {
        await sendKb(chatId, 'Paso 2: Ingresa matrícula', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
        userStates[chatId].step = 'matricula';
      } else if (userStates[chatId].step === 'matricula') {
        await sendKb(chatId, 'Paso 3: Ingresa marca', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
        userStates[chatId].step = 'marca';
      } else if (userStates[chatId].step === 'marca') {
        await sendKb(chatId, 'Paso 4: Ingresa modelo', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
        userStates[chatId].step = 'modelo';
      } else if (userStates[chatId].step === 'modelo') {
        await sendKb(chatId, 'Paso 5: Ingresa descripción', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
        userStates[chatId].step = 'descripcion';
      } else if (userStates[chatId].step === 'descripcion') {
        await sendKb(chatId, 'Paso 6: Ingresa horas', [[btn('Guardar', 'ots:nueva:save'), btn('Editar', 'ots:nueva:edit'), btn('Cancelar', 'ots:cancel')]]);
        userStates[chatId].step = 'horas';
      }
      break;
    case 'ots:nueva:save':
      if (!userStates[chatId]?.data) return await sendText(chatId, 'Datos incompletos. Reinicia con /start.');
      await sendText(chatId, 'Procesando...');
      const otData = userStates[chatId].data;
      await new OTService().createOT(otData);
      delete userStates[chatId];
      await sendText(chatId, 'OT creada exitosamente.');
      break;
    case 'ots:nueva:edit':
      if (!userStates[chatId]) return await sendText(chatId, 'Sesión expirada. Reinicia con /start.');
      userStates[chatId].step = 'cliente_id';
      await sendKb(chatId, 'Edición - Paso 1: Selecciona cliente (ingresa ID)', [[btn('Siguiente', 'ots:nueva:next'), btn('Cancelar', 'ots:cancel')]]);
      break;
    case 'ots:cancel':
      delete userStates[chatId];
      await sendKb(chatId, 'Menú Principal', [
        [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
        [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
        [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
      ]);
      break;
    case 'ots:lista':
      await sendText(chatId, 'Procesando...');
      const ots = await new OTService().listOTs(10);
      await sendText(chatId, ots.map(o => `OT ${o.OT_ID} - ${o.matricula} (${o.estado})`).join('\n') || 'No hay OT.');
      break;
  }
}

async function handleFacturas(chatId, action) {
  switch (action) {
    case 'facturas:nueva':
      const ots = await new OTService().listOTs();
      await sendKb(chatId, 'Selecciona OT para factura', ots.map(o => [btn(`OT ${o.OT_ID}`, `facturas:nueva:${o.OT_ID}`)]).concat([[btn('Cancelar', 'facturas:cancel')]]));
      break;
    case 'facturas:nueva:save':
      if (!userStates[chatId]?.data?.otId) return await sendText(chatId, 'OT no seleccionada. Reinicia con /start.');
      await sendText(chatId, 'Procesando...');
      const { factura, pdfUrl } = await new InvoiceService().generateInvoice(userStates[chatId].data.otId);
      delete userStates[chatId];
      await sendText(chatId, `Factura ${factura.numero} generada. Descarga: ${pdfUrl}`);
      break;
    case 'facturas:lista':
      await sendText(chatId, 'Procesando...');
      const facturas = await Factura.find().limit(10);
      await sendText(chatId, facturas.map(f => `Factura ${f.numero} - Total: ${f.total}€ (${f.pagado})`).join('\n') || 'No hay facturas.');
      break;
    case 'facturas:cancel':
      delete userStates[chatId];
      await sendKb(chatId, 'Menú Principal', [
        [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
        [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
        [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
      ]);
      break;
  }
}

async function handleDashboard(chatId, action) {
  switch (action) {
    case 'dashboard:resumen':
      await sendText(chatId, 'Procesando...');
      const [otsCount, facturasPendientes] = await Promise.all([
        OT.countDocuments(),
        Factura.countDocuments({ pagado: 'no' })
      ]);
      await sendText(chatId, `Resumen: ${otsCount} OT totales, ${facturasPendientes} facturas pendientes.`);
      break;
    case 'dashboard:stats':
      await sendText(chatId, 'Procesando...');
      const totalFacturado = (await Factura.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]))[0]?.total || 0;
      await sendText(chatId, `Estadísticas: Total facturado: ${totalFacturado}€.`);
      break;
  }
}

async function handleBuscar(chatId, action) {
  switch (action) {
    case 'buscar:cliente':
      userStates[chatId] = { step: 'query' };
      await sendKb(chatId, 'Ingresa nombre o NIF del cliente', [[btn('Buscar', 'buscar:cliente:search'), btn('Cancelar', 'buscar:cancel')]]);
      break;
    case 'buscar:cliente:search':
      if (!userStates[chatId]?.data?.query) return await sendText(chatId, 'Ingresa un criterio de búsqueda.');
      await sendText(chatId, 'Procesando...');
      const clients = await new ClientService().searchClients(userStates[chatId].data.query);
      await sendText(chatId, clients.map(c => `${c.nombre} ${c.apellidos} (NIF: ${c.nif})`).join('\n') || 'No se encontraron clientes.');
      delete userStates[chatId];
      break;
    case 'buscar:matricula':
      userStates[chatId] = { step: 'query' };
      await sendKb(chatId, 'Ingresa matrícula', [[btn('Buscar', 'buscar:matricula:search'), btn('Cancelar', 'buscar:cancel')]]);
      break;
    case 'buscar:matricula:search':
      if (!userStates[chatId]?.data?.query) return await sendText(chatId, 'Ingresa una matrícula.');
      await sendText(chatId, 'Procesando...');
      const ots = await OT.find({ matricula: { $regex: userStates[chatId].data.query, $options: 'i' } }).limit(10);
      await sendText(chatId, ots.map(o => `OT ${o.OT_ID} - ${o.matricula} (${o.estado})`).join('\n') || 'No se encontraron OT.');
      delete userStates[chatId];
      break;
    case 'buscar:cancel':
      delete userStates[chatId];
      await sendKb(chatId, 'Menú Principal', [
        [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
        [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
        [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
      ]);
      break;
  }
}

async function handleConsultas(chatId, action) {
  switch (action) {
    case 'consultas:pendientes':
      await sendText(chatId, 'Procesando...');
      const pendientes = await OT.find({ estado: 'pendiente' }).limit(10);
      await sendText(chatId, pendientes.map(o => `OT ${o.OT_ID} - ${o.matricula}`).join('\n') || 'No hay OT pendientes.');
      break;
    case 'consultas:finalizadas':
      await sendText(chatId, 'Procesando...');
      const finalizadas = await OT.find({ estado: 'finalizado' }).limit(10);
      await sendText(chatId, finalizadas.map(o => `OT ${o.OT_ID} - ${o.matricula}`).join('\n') || 'No hay OT finalizadas.');
      break;
  }
}

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
    const text = message?.text || callback_query?.data;

    console.log('Webhook received at:', new Date().toISOString(), 'Data:', JSON.stringify(req.body));

    if (text === '/start' && isBotActive) {
      await sendKb(chatId, 'Menú Principal', [
        [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
        [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
        [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
      ]);
      return;
    }

    if (callback_query) {
      const action = callback_query.data;
      console.log('Action detected:', action);

      if (message?.text && userStates[chatId]?.step) {
        userStates[chatId].data[userStates[chatId].step] = message.text;
        await handleClientes(chatId, 'clientes:nuevo:next');
        return;
      }

      if (action.startsWith('menu:')) {
        switch (action) {
          case 'menu:clientes': await handleClientes(chatId, 'clientes:nuevo'); break;
          case 'menu:ots': await handleOT(chatId, 'ots:nueva'); break;
          case 'menu:facturas': await handleFacturas(chatId, 'facturas:nueva'); break;
          case 'menu:dashboard': await handleDashboard(chatId, 'dashboard:resumen'); break;
          case 'menu:buscar': await handleBuscar(chatId, 'buscar:cliente'); break;
          case 'menu:consultas': await handleConsultas(chatId, 'consultas:pendientes'); break;
          case 'menu:principal':
            await sendKb(chatId, 'Menú Principal', [
              [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
              [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
              [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
            ]);
            break;
          default: await sendText(chatId, 'Opción no reconocida. Usa el menú.');
        }
      } else if (action.startsWith('clientes:')) {
        await handleClientes(chatId, action);
      } else if (action.startsWith('ots:')) {
        await handleOT(chatId, action);
      } else if (action.startsWith('facturas:')) {
        await handleFacturas(chatId, action);
      } else if (action.startsWith('dashboard:')) {
        await handleDashboard(chatId, action);
      } else if (action.startsWith('buscar:')) {
        await handleBuscar(chatId, action);
      } else if (action.startsWith('consultas:')) {
        await handleConsultas(chatId, action);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error in webhook at:', new Date().toISOString(), error.message);
    res.sendStatus(500);
  }
});

// Control Endpoints
app.get('/wake', (req, res) => {
  console.log('Service activated at:', new Date().toISOString());
  isBotActive = true;
  res.send('Servicio activo');
});

app.get('/resume', async (req, res) => {
  console.log('Resuming webhook at:', new Date().toISOString());
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://${req.hostname}/webhook`);
    const data = await response.json();
    if (data.ok) {
      console.log('Webhook configured successfully');
      res.send('Webhook reanudado');
    } else {
      console.error('Failed to configure webhook:', data);
      res.status(500).send('Failed to resume webhook');
    }
  } catch (error) {
    console.error('Error in /resume at:', new Date().toISOString(), error.message);
    res.status(500).send('Internal error');
  }
});

app.get('/test', (req, res) => {
  res.send('Server running');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT} at:`, new Date().toISOString()));
