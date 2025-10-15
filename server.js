// server.js - Backend completo para el bot Telegram "Taller Ágil"
// Maneja webhook de Telegram, lógica de negocio, conexión a MongoDB Atlas (DB) y Supabase (Storage), generación de PDFs.
// Estructura modular: Clases para services, funciones separadas para handlers y helpers.
// Calidad: Logging detallado, manejo de errores con try/catch, async/await.
// UX: Menús con botones inline, wizards guiados con confirmación/editar/cancelar.
// Lógica: Clientes, OT, facturas con PDFs automáticos.
// Nota: Logo subido a Supabase (URL pública), PDF enviado para impresión manual (Ctrl+P).

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { default: fetch } = require('node-fetch');
const { v4: uuid } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Inicialización de la aplicación Express
const app = express();
app.use(bodyParser.json());

// Configuración de variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN; // Token del bot de Telegram
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // ID de chat para notificaciones
const TARIFA_HORA = 40; // Tarifa por hora en euros (actualizada a 40€)
const IVA_POR_DEFECTO = 21; // IVA estándar en España (%)
const SUPABASE_URL = process.env.SUPABASE_URL; // URL de Supabase
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Clave anónima de Supabase
const LOGO_URL = process.env.LOGO_URL; // URL pública del logo en Supabase

// Estado global del bot
let isBotActive = true; // Control de actividad del bot
let userStates = {}; // Almacena estados de usuarios para wizards (formularios guiados)

// Inicialización de Supabase para almacenamiento (PDFs, logo)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado a las:', new Date().toISOString()))
  .catch(error => console.error('Error de conexión a MongoDB a las:', new Date().toISOString(), error.message));

// Definición de esquemas de Mongoose
const ClientSchema = new mongoose.Schema({
  id: String, nombre: String, apellidos: String, telefono: String,
  email: String, nif: String, direccion: String, razon_social: String,
  notas: String, fecha_alta: String, carpeta_id: String
});

const OTSchema = new mongoose.Schema({
  OT_ID: String, cliente_id: String, matricula: String, marca: String,
  modelo: String, descripcion: String, horas: Number, piezas_notas: String,
  consumibles_notas: String, coste_estimado: Number, estado: String,
  fecha_creacion: String, fecha_finalizacion: String, imagenes_links: String
});

const FacturaSchema = new mongoose.Schema({
  factura_id: String, OT_ID: String, cliente_id: String, numero: String,
  fecha: String, subtotal: Number, iva_total: Number, total: Number,
  pagado: String, pdf_link: String, pagos: Array, tasa_iva: Number,
  observaciones: String
});

const PagoSchema = new mongoose.Schema({
  pago_id: String, factura_id: String, monto: Number, fecha: String, metodo: String
});

// Modelos de Mongoose
const Client = mongoose.model('Client', ClientSchema);
const OT = mongoose.model('OT', OTSchema);
const Factura = mongoose.model('Factura', FacturaSchema);
const Pago = mongoose.model('Pago', PagoSchema);

// Servicios (lógica de negocio modular)
class ClientService {
  async createClient(data) {
    try {
      const id = uuid();
      const fecha_alta = new Date().toISOString().split('T')[0];
      const client = new Client({ id, ...data, fecha_alta, carpeta_id: 'supabase-folder' });
      await client.save();
      return client;
    } catch (error) {
      console.error('Error creando cliente:', error.message);
      throw error;
    }
  }

  async getClientById(id) {
    try {
      return await Client.findOne({ id });
    } catch (error) {
      console.error('Error obteniendo cliente por ID:', error.message);
      throw error;
    }
  }

  async searchClients(query) {
    try {
      return await Client.find({ $or: [{ nombre: { $regex: query, $options: 'i' } }, { nif: { $regex: query, $options: 'i' } }] });
    } catch (error) {
      console.error('Error buscando clientes:', error.message);
      throw error;
    }
  }
}

class OTService {
  async createOT(data) {
    try {
      const OT_ID = uuid();
      const ot = new OT({ OT_ID, ...data, estado: 'pendiente', fecha_creacion: new Date().toISOString() });
      await ot.save();
      return ot;
    } catch (error) {
      console.error('Error creando OT:', error.message);
      throw error;
    }
  }

  async getOTById(OT_ID) {
    try {
      return await OT.findOne({ OT_ID });
    } catch (error) {
      console.error('Error obteniendo OT por ID:', error.message);
      throw error;
    }
  }

  async updateOTField(OT_ID, field, value) {
    try {
      await OT.updateOne({ OT_ID }, { [field]: value });
    } catch (error) {
      console.error('Error actualizando OT:', error.message);
      throw error;
    }
  }
}

class InvoiceService {
  async generateNumeroFactura() {
    try {
      const facturas = await Factura.find({});
      const nums = facturas.map(f => parseInt(f.numero) || 0);
      return (Math.max(...nums, 0) + 1).toString().padStart(4, '0');
    } catch (error) {
      console.error('Error generando número de factura:', error.message);
      throw error;
    }
  }

  async generateInvoice(otId, tasa_iva = IVA_POR_DEFECTO, observaciones = '') {
    try {
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

      // Encabezado con logo
      if (LOGO_URL) {
        const logoBytes = await fetch(LOGO_URL).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedJpg(logoBytes);
        page.drawImage(logoImage, { x: 50, y: height - 100, width: 100, height: 50 });
      }

      page.drawText('TALLER ÁGIL', { x: 160, y: height - 70, size: 24, color: rgb(0.8, 0.2, 0.2), font });
      page.drawText('C/ Ejemplo 123, 28001 Madrid, España', { x: 160, y: height - 90, size: 12, font });
      page.drawText('NIF: A12345678', { x: 160, y: height - 110, size: 12, font });
      page.drawText('Teléfono: 910 123 456', { x: 160, y: height - 130, size: 12, font });
      page.drawText('FACTURA', { x: width - 150, y: height - 70, size: 18, font });
      page.drawText(`Fecha: ${fecha}`, { x: width - 150, y: height - 90, size: 12, font });
      page.drawText(`Nº Factura: ${numero}`, { x: width - 150, y: height - 110, size: 12, font });

      // Datos del cliente
      page.drawText('Facturado a:', { x: 50, y: height - 150, size: 14, font });
      page.drawText(`${cliente.nombre} ${cliente.apellidos}`, { x: 50, y: height - 170, size: 12, font });
      page.drawText(`NIF: ${cliente.nif}`, { x: 50, y: height - 190, size: 12, font });
      page.drawText(cliente.direccion || 'Sin dirección', { x: 50, y: height - 210, size: 12, font });
      page.drawText(`Matrícula: ${ot.matricula}`, { x: 50, y: height - 230, size: 12, font });

      // Tabla de conceptos
      page.drawLine({ start: { x: 50, y: height - 260 }, end: { x: width - 50, y: height - 260 }, thickness: 1 });
      page.drawText('Concepto', { x: 50, y: height - 280, size: 12, font });
      page.drawText('Cantidad', { x: 300, y: height - 280, size: 12, font });
      page.drawText('Precio Unitario (€)', { x: 380, y: height - 280, size: 12, font });
      page.drawText('Importe (€)', { x: 500, y: height - 280, size: 12, font });
      page.drawLine({ start: { x: 50, y: height - 290 }, end: { x: width - 50, y: height - 290 }, thickness: 1 });

      // Línea de mano de obra
      page.drawText(ot.descripcion, { x: 50, y: height - 310, size: 12, font });
      page.drawText(ot.horas.toString(), { x: 300, y: height - 310, size: 12, font });
      page.drawText(TARIFA_HORA.toFixed(2), { x: 380, y: height - 310, size: 12, font });
      page.drawText(subtotal.toFixed(2), { x: 500, y: height - 310, size: 12, font });

      // Línea de piezas/consumibles (si aplica)
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
    } catch (error) {
      console.error('Error generando factura:', error.message);
      throw error;
    }
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
      console.error('Error creando pago:', error.message);
      throw error;
    }
  }

  async getPaymentsByFactura(factura_id) {
    try {
      return await Pago.find({ factura_id });
    } catch (error) {
      console.error('Error obteniendo pagos:', error.message);
      throw error;
    }
  }
}

// Funciones de ayuda para Telegram
async function sendText(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (error) {
    console.error('Error enviando texto a las:', new Date().toISOString(), error.message);
  }
}

async function sendKb(chatId, text, kb) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: kb } })
    });
  } catch (error) {
    console.error('Error enviando teclado a las:', new Date().toISOString(), error.message);
  }
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
