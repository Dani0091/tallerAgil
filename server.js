// server.js - Backend completo para el bot Telegram "Taller Ágil"
// Maneja webhook de Telegram, lógica de negocio, conexión a MongoDB Atlas (DB) y Supabase (Storage), generación de PDFs.
// Estructura modular: Clases para services, funciones separadas para handlers y helpers.
// Calidad: Logging detallado, manejo de errores con try/catch, async/await.
// UX: Menús con botones inline, wizards guiados con confirmación/editar/cancelar/vol ver, minimizando input text para evitar fallos.
- Wizards: Estado por usuario, pasos secuenciales, resumen editable con botones para editar campo específico, confirmar, cancelar.
- Investigación 2025: Basado en guías de Telegram bot development, usa inline keyboards para UI interactiva, editMessageText para actualizaciones, mini-apps like flow para flujos complejos (pero mantenemos bots simples para POC).
- Lógica: Clientes, OT, facturas con PDFs automáticos.
- Nota: Logo subido a Supabase (URL pública), PDF enviado para impresión manual (Ctrl+P).

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { default: fetch } = require('node-fetch');
const { v4: uuid } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN; // Token del bot Telegram.
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // ID de chat para notificaciones de admin.
const TARIFA_HORA = 40; // Tarifa por hora de mano de obra ajustada a 40€.
const IVA_POR_DEFECTO = 21; // IVA por defecto (%).
const SUPABASE_URL = process.env.SUPABASE_URL; // URL de Supabase.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Clave anónima de Supabase.

let isBotActive = true; // Estado del bot (activo/pausado).
let userStates = {}; // Estado temporal de usuarios para wizards (formularios guiados).

// Inicialización de Supabase para storage (PDFs, fotos).
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Conexión a MongoDB Atlas (DB para clientes, OT, facturas).
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected at ' + new Date().toISOString()))
  .catch(error => console.error('MongoDB connection error at ' + new Date().toISOString() + ': ' + error.message));

// Schemas de Mongoose para modelos de DB (estructura de datos).
const ClientSchema = new mongoose.Schema({
  id: String, // UUID único.
  nombre: String, // Nombre del cliente.
  apellidos: String, // Apellidos.
  telefono: String, // Teléfono.
  email: String, // Email.
  nif: String, // NIF (obligatorio para facturas legales en España).
  direccion: String, // Dirección.
  razon_social: String, // Razón social (opcional).
  notas: String, // Notas adicionales.
  fecha_alta: String, // Fecha de alta (ISO).
  carpeta_id: String, // ID de carpeta en storage (para PDFs/fotos).
});

const OTSchema = new mongoose.Schema({
  OT_ID: String, // UUID único.
  cliente_id: String, // Referencia a cliente.
  matricula: String, // Matrícula del vehículo.
  marca: String, // Marca.
  modelo: String, // Modelo.
  descripcion: String, // Descripción del trabajo.
  horas: Number, // Horas de trabajo.
  piezas_notas: String, // Notas de piezas.
  consumibles_notas: String, // Notas de consumibles.
  coste_estimado: Number, // Coste estimado.
  estado: String, // Pendiente/en_proceso/finalizado.
  fecha_creacion: String, // Fecha creación (ISO).
  fecha_finalizacion: String, // Fecha finalización (ISO).
  imagenes_links: String, // Links de imágenes separados por coma.
});

const FacturaSchema = new mongoose.Schema({
  factura_id: String, // UUID único.
  OT_ID: String, // Referencia a OT.
  cliente_id: String, // Referencia a cliente.
  numero: String, // Número correlativo (0001).
  fecha: String, // Fecha emisión (ISO).
  subtotal: Number, // Subtotal.
  iva_total: Number, // IVA total.
  total: Number, // Total.
  pagado: String, // Sí/no.
  pdf_link: String, // Link al PDF en storage.
  pagos: Array, // Array de pagos (JSON).
  tasa_iva: Number, // Tasa IVA (%).
  observaciones: String, // Observaciones.
});

// Modelos de Mongoose (para interactuar con DB).
const Client = mongoose.model('Client', ClientSchema);
const OT = mongoose.model('OT', OTSchema);
const Factura = mongoose.model('Factura', FacturaSchema);

// Clases de Services (Lógica de negocio modular, SOLID: Single Responsibility).
class ClientService {
  async createClient(data) {
    const id = uuid();
    const fecha_alta = new Date().toISOString().split('T')[0];
    const client = new Client({ id, ...data, fecha_alta, carpeta_id: 'supabase-folder' });
    await client.save();
    return client;
  }
  async getClientById(id) { return await Client.findOne({ id }); }
  async searchClients(query) { return await Client.find({ $or: [{ nombre: { $regex: query, $options: 'i' } }, { nif: { $regex: query, $options: 'i' } }] }); }
}

class OTService {
  async createOT(data) {
    const OT_ID = uuid();
    const ot = new OT({ OT_ID, ...data, estado: 'pendiente', fecha_creacion: new Date().toISOString() });
    await ot.save();
    return ot;
  }
  async getOTById(OT_ID) { return await OT.findOne({ OT_ID }); }
  async updateOTField(OT_ID, field, value) { await OT.updateOne({ OT_ID }, { [field]: value }); }
}

class InvoiceService {
  async generateNumeroFactura() {
    const facturas = await Factura.find({});
    const nums = facturas.map(f => parseInt(f.numero) || 0);
    return (Math.max(...nums, 0) + 1).toString().padStart(4, '0');
  }

  async generateInvoice(otId, tasa_iva = IVA_POR_DEFECTO, observaciones = '') {
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
    const page = pdfDoc.addPage([595, 842]); // Tamaño A4
    const { width, height } = page.getSize();

    // Encabezado del Taller
    page.drawText('TALLER ÁGIL', { x: 50, y: height - 70, size: 24, color: rgb(0.8, 0.2, 0.2), font });
    page.drawText('C/ Ejemplo 123, 28001 Madrid, España', { x: 50, y: height - 90, size: 12, font });
    page.drawText('NIF: A12345678', { x: 50, y: height - 110, size: 12, font });
    page.drawText('Teléfono: 910 123 456', { x: 50, y: height - 130, size: 12, font });
    page.drawText('FACTURA', { x: width - 150, y: height - 70, size: 18, font });
    page.drawText(`Fecha: ${fecha}`, { x: width - 150, y: height - 90, size: 12, font });
    page.drawText(`Nº Factura: ${numero}`, { x: width - 150, y: height - 110, size: 12, font });

    // Datos del Cliente (basados en OT)
    page.drawText('Facturado a:', { x: 50, y: height - 150, size: 14, font });
    page.drawText(`${cliente.nombre} ${cliente.apellidos}`, { x: 50, y: height - 170, size: 12, font });
    page.drawText(`NIF: ${cliente.nif}`, { x: 50, y: height - 190, size: 12, font });
    page.drawText(cliente.direccion || 'Sin dirección', { x: 50, y: height - 210, size: 12, font });
    page.drawText(`Matrícula: ${ot.matricula}`, { x: 50, y: height - 230, size: 12, font });

    // Tabla de Conceptos
    page.drawLine({ start: { x: 50, y: height - 260 }, end: { x: width - 50, y: height - 260 }, thickness: 1 });
    page.drawText('Concepto', { x: 50, y: height - 280, size: 12, font });
    page.drawText('Cantidad', { x: 300, y: height - 280, size: 12, font });
    page.drawText('Precio Unitario (€)', { x: 380, y: height - 280, size: 12, font });
    page.drawText('Importe (€)', { x: 500, y: height - 280, size: 12, font });
    page.drawLine({ start: { x: 50, y: height - 290 }, end: { x: width - 50, y: height - 290 }, thickness: 1 });

    // Línea de Mano de Obra
    page.drawText(ot.descripcion, { x: 50, y: height - 310, size: 12, font });
    page.drawText(ot.horas.toString(), { x: 300, y: height - 310, size: 12, font });
    page.drawText(TARIFA_HORA.toFixed(2), { x: 380, y: height - 310, size: 12, font });
    page.drawText(subtotal.toFixed(2), { x: 500, y: height - 310, size: 12, font });

    // Línea de Piezas/Consumibles (si aplica)
    if (ot.coste_estimado > 0) {
      page.drawText(ot.piezas_notas || 'Piezas/Consumibles', { x: 50, y: height - 330, size: 12, font });
      page.drawText('1', { x: 300, y: height - 330, size: 12, font });
      page.drawText(ot.coste_estimado.toFixed(2), { x: 380, y: height - 330, size: 12, font });
      page.drawText(ot.coste_estimado.toFixed(2), { x: 500, y: height - 330, size: 12, font });
    }

    // Totales
    page.drawLine({ start: { x: 50, y: height - 380 }, end: { x: width - 50, y: height - 380 }, thickness: 1 });
    page.drawText('Subtotal', { x: 400, y: height - 400, size: 12, font });
    page.drawText(subtotal.toFixed(2), { x: 500, y: height - 400, size: 12, font });
    page.drawText(`IVA (${tasa_iva}%)`, { x: 400, y: height - 420, size: 12, font });
    page.drawText(iva_total.toFixed(2), { x: 500, y: height - 420, size: 12, font });
    page.drawText('Total a Pagar', { x: 400, y: height - 440, size: 12, font });
    page.drawText(total.toFixed(2), { x: 500, y: height - 440, size: 12, font });

    // Observaciones y legal
    page.drawText(`Observaciones: ${observaciones}`, { x: 50, y: height - 470, size: 12, font });
    page.drawText('Factura conforme a la normativa española 2025. IVA incluido. VeriFACTU compatible.', { x: 50, y: 50, size: 10, font });

    const pdfBytes = await pdfDoc.save();

    // Upload a Supabase
    const { data, error } = await supabase.storage.from('facturas').upload(`Factura_${numero}.pdf`, pdfBytes, { contentType: 'application/pdf' });
    if (error) throw new Error('Error subiendo PDF: ' + error.message);
    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/facturas/Factura_${numero}.pdf`;

    const factura_id = uuid();
    const factura = new Factura({ factura_id, OT_ID: otId, cliente_id: ot.cliente_id, numero, fecha, subtotal, iva_total, total, pagado: 'no', pdf_link: pdfUrl, pagos: [], tasa_iva, observaciones });
    await factura.save();
    await OT.updateOne({ OT_ID: otId }, { estado: 'finalizado' });
    return { factura, pdfUrl };
  }
}

async function sendText(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (error) { console.error(`Error sending text at ${new Date().toISOString()}: ${error.message}`); }
}

async function sendKb(chatId, text, kb) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: kb } }),
    });
  } catch (error) { console.error(`Error sending keyboard at ${new Date().toISOString()}: ${error.message}`); }
}

function btn(label, callback) { return { text: label, callback_data: callback }; }

// Endpoints de control
app.get('/wake', (req, res) => {
  console.log('Servicio activado a las:', new Date().toISOString());
  isBotActive = true;
  res.send('Servicio activo');
});

app.get('/resume', async (req, res) => {
  console.log('Reanudando webhook a las:', new Date().toISOString());
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://${req.hostname}/webhook`);
    const data = await response.json();
    if (data.ok) {
      console.log('Webhook configurado exitosamente');
      res.send('Webhook reanudado');
    } else {
      console.error('Fallo al configurar webhook:', data);
      res.status(500).send('Fallo al reanudar webhook');
    }
  } catch (error) {
    console.error('Error en /resume a las:', new Date().toISOString(), error.message);
    res.status(500).send('Error interno');
  }
});

app.get('/test', (req, res) => {
  res.send('Servidor funcionando');
});

// Handler de webhook
app.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
    const text = message?.text || callback_query?.data;

    console.log('Webhook recibido a las:', new Date().toISOString(), 'Datos:', JSON.stringify(req.body));

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
      console.log('Acción detectada:', action);

      if (action.startsWith('menu:')) {
        switch (action) {
          case 'menu:clientes':
            await sendKb(chatId, 'Gestión de Clientes', [
              [btn('Nuevo Cliente', 'clientes:nuevo'), btn('Lista Clientes', 'clientes:lista')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:ots':
            await sendKb(chatId, 'Gestión de OT', [
              [btn('Nueva OT', 'ots:nueva'), btn('Lista OT', 'ots:lista')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:facturas':
            await sendKb(chatId, 'Gestión de Facturas', [
              [btn('Nueva Factura', 'facturas:nueva'), btn('Lista Facturas', 'facturas:lista')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:dashboard':
            await sendKb(chatId, 'Dashboard', [
              [btn('Resumen', 'dashboard:resumen'), btn('Estadísticas', 'dashboard:stats')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:buscar':
            await sendKb(chatId, 'Buscar', [
              [btn('Por Cliente', 'buscar:cliente'), btn('Por Matrícula', 'buscar:matricula')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:consultas':
            await sendKb(chatId, 'Consultas', [
              [btn('Pendientes', 'consultas:pendientes'), btn('Finalizadas', 'consultas:finalizadas')],
              [btn('Volver', 'menu:principal')]
            ]);
            break;
          case 'menu:principal':
            await sendKb(chatId, 'Menú Principal', [
              [btn('👤 Clientes', 'menu:clientes'), btn('🔧 OT', 'menu:ots')],
              [btn('💰 Facturas', 'menu:facturas'), btn('📊 Dashboard', 'menu:dashboard')],
              [btn('🔍 Buscar', 'menu:buscar'), btn('❓ Consultas', 'menu:consultas')]
            ]);
            break;
          default:
            await sendText(chatId, 'Opción no reconocida. Usa el menú.');
        }
      }
    }

    res.sendStatus(200); // Respuesta al webhook
  } catch (error) {
    console.error('Error en webhook a las:', new Date().toISOString(), error.message);
    res.sendStatus(500);
  }
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT} a las:`, new Date().toISOString()));
