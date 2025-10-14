const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');

// Definición de clases
class SheetsDB {
  constructor(auth, spreadsheetId) {
    this.auth = auth;
    this.spreadsheetId = spreadsheetId;
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getData(range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`SheetsDB.getData error at ${new Date().toISOString()}: ${error.message}`);
      return [];
    }
  }

  async appendData(range, values) {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
      console.log(`SheetsDB.appendData success at ${new Date().toISOString()} for range ${range}`);
    } catch (error) {
      console.error(`SheetsDB.appendData error at ${new Date().toISOString()}: ${error.message}`);
    }
  }

  async updateData(range, values) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    } catch (error) {
      console.error(`SheetsDB.updateData error at ${new Date().toISOString()}: ${error.message}`);
    }
  }
}

class DriveStorage {
  constructor(auth, rootId) {
    this.auth = auth;
    this.rootId = rootId;
    this.drive = google.drive({ version: 'v3', auth });
  }

  async createFolder(name) {
    try {
      const fileMetadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: [this.rootId] };
      const response = await this.drive.files.create({ resource: fileMetadata, fields: 'id' });
      return response.data.id;
    } catch (error) {
      console.error(`DriveStorage.createFolder error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }

  async copyFile(fileId, name) {
    try {
      const copiedFileMetadata = { name, parents: [this.rootId] };
      const response = await this.drive.files.copy({ fileId, resource: copiedFileMetadata });
      return response.data.id;
    } catch (error) {
      console.error(`DriveStorage.copyFile error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }
}

class ClientService {
  constructor(db) {
    this.db = db;
  }

  async createClient(name, phone) {
    try {
      const id = uuid();
      await this.db.appendData('CLIENTES!A:D', [[id, name, phone, new Date().toISOString()]]);
      console.log(`ClientService.createClient success: ${id}, ${name}, ${phone}`);
      return { id, name, phone };
    } catch (error) {
      console.error(`ClientService.createClient error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }
}

class OTService {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
  }

  async createOT(clientId, description) {
    try {
      const id = uuid();
      const folderId = await this.storage.createFolder(`OT_${id}`);
      await this.db.appendData('OTS!A:E', [[id, clientId, description, folderId, new Date().toISOString()]]);
      console.log(`OTService.createOT success: ${id}, ${clientId}, ${description}`);
      return { id, clientId, description, folderId };
    } catch (error) {
      console.error(`OTService.createOT error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }

  async updateField(id, field, value) {
    try {
      const data = await this.db.getData('OTS!A:E');
      const row = data.find(r => r[0] === id);
      if (row) {
        row[field] = value;
        await this.db.updateData(`OTS!A:E`, data);
        console.log(`Update OT ${id}: ${field} = ${value} at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error(`OTService.updateField error at ${new Date().toISOString()}: ${error.message}`);
    }
  }

  async getOT(id) {
    try {
      const data = await this.db.getData('OTS!A:E');
      return data.find(r => r[0] === id) || null;
    } catch (error) {
      console.error(`OTService.getOT error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }
}

class InvoiceService {
  constructor(storage, templateId, nombreEmisor, nifEmisor, domicilioEmisor, tarifaHora, ivaPorDefecto) {
    this.storage = storage;
    this.templateId = templateId;
    this.nombreEmisor = nombreEmisor;
    this.nifEmisor = nifEmisor;
    this.domicilioEmisor = domicilioEmisor;
    this.tarifaHora = tarifaHora;
    this.ivaPorDefecto = ivaPorDefecto;
  }

  async generateInvoice(otId, hours) {
    try {
      const fileId = await this.storage.copyFile(this.templateId, `Factura_OT_${otId}`);
      console.log(`Generated invoice for OT ${otId} at ${new Date().toISOString()}`);
      return fileId;
    } catch (error) {
      console.error(`InvoiceService.generateInvoice error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }
}

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DRIVE_ROOT_ID = process.env.DRIVE_ROOT_ID;
const TEMPLATE_ID = process.env.TEMPLATE_ID;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const NOMBRE_EMISOR = process.env.NOMBRE_EMISOR;
const NIF_EMISOR = process.env.NIF_EMISOR;
const DOMICILIO_EMISOR = process.env.DOMICILIO_EMISOR;
const TARIFA_HORA = 50;
const IVA_POR_DEFECTO = 21;

let isBotActive = true;

// Inicialización de dependencias
let db, storage, clientService, otService, invoiceService;
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
  db = new SheetsDB(auth, SPREADSHEET_ID);
  storage = new DriveStorage(auth, DRIVE_ROOT_ID);
  clientService = new ClientService(db);
  otService = new OTService(db, storage);
  invoiceService = new InvoiceService(storage, TEMPLATE_ID, NOMBRE_EMISOR, NIF_EMISOR, DOMICILIO_EMISOR, TARIFA_HORA, IVA_POR_DEFECTO);
} catch (error) {
  console.error(`Error initializing services at ${new Date().toISOString()}: ${error.message}`);
  // Modo de emergencia: inicia el servidor aunque fallen las dependencias
}

// Funciones de envío a Telegram
async function sendText(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (error) {
    console.error(`Error sending text at ${new Date().toISOString()}: ${error.message}`);
  }
}

async function sendKb(chatId, text, replyMarkup) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
  } catch (error) {
    console.error(`Error sending keyboard at ${new Date().toISOString()}: ${error.message}`);
  }
}

// Webhook principal con logging y botones
app.post('/webhook', async (req, res) => {
  if (!isBotActive) return res.sendStatus(200);
  const update = req.body;
  const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
  const text = update.message ? update.message.text : null;
  const data = update.callback_query ? update.callback_query.data : null;

  try {
    console.log(`Received message: ${text || data} at ${new Date().toISOString()}`);
    if (text) {
      if (text === '/start') {
        await sendKb(chatId, 'Bienvenido al Bot Taller Ágil. Selecciona una opción:', {
          inline_keyboard: [
            [{ text: 'Nuevo Cliente', callback_data: 'new_client' }],
            [{ text: 'Nueva OT', callback_data: 'new_ot' }],
            [{ text: 'Ver OT', callback_data: 'view_ot' }],
          ],
        });
      } else if (text === '/menu') {
        await sendKb(chatId, 'Menú de opciones:', {
          inline_keyboard: [
            [{ text: 'Nuevo Cliente', callback_data: 'new_client' }],
            [{ text: 'Nueva OT', callback_data: 'new_ot' }],
            [{ text: 'Ver OT', callback_data: 'view_ot' }],
          ],
        });
      } else if (text.startsWith('/nuevo_cliente')) {
        const [_, name, phone] = text.split(' ');
        if (name && phone) {
          const client = await clientService.createClient(name, phone);
          if (client) await sendText(chatId, `Cliente creado: ${client.name} (ID: ${client.id})`);
          else await sendText(chatId, 'Error al crear cliente.');
        } else {
          await sendText(chatId, 'Uso: /nuevo_cliente Nombre Teléfono');
        }
      } else if (text.startsWith('/nueva_ot')) {
        const [_, clientId, description] = text.split(' ', 3);
        if (clientId && description) {
          const ot = await otService.createOT(clientId, description);
          if (ot) await sendText(chatId, `OT creada: ${ot.id} para cliente ${clientId}`);
          else await sendText(chatId, 'Error al crear OT.');
        } else {
          await sendText(chatId, 'Uso: /nueva_ot ClientId Descripción');
        }
      } else if (text.startsWith('/ver_ot')) {
        const [_, otId] = text.split(' ');
        if (otId) {
          const ot = await otService.getOT(otId);
          await sendText(chatId, ot ? `OT ${otId}: ${JSON.stringify(ot)}` : 'OT no encontrada');
        }
      } else if (text.startsWith('/generar_factura')) {
        const [_, otId] = text.split(' ');
        if (otId) {
          const fileId = await invoiceService.generateInvoice(otId, 1);
          await sendText(chatId, fileId ? `Factura generada para OT ${otId}: ${fileId}` : 'Error al generar factura.');
        }
      }
    }
    if (data) {
      if (data === 'new_client') {
        await sendText(chatId, 'Envía /nuevo_cliente Nombre Teléfono para crear un cliente.');
      } else if (data === 'new_ot') {
        await sendText(chatId, 'Envía /nueva_ot ClientId Descripción para crear una OT.');
      } else if (data === 'view_ot') {
        await sendText(chatId, 'Envía /ver_ot OTId para ver una OT.');
      }
    }
  } catch (error) {
    console.error(`Error at ${new Date().toISOString()}: ${error.message}`);
    if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, `Error: ${error.message}`);
  }
  res.sendStatus(200);
});

// Pause/Resume con logging
app.get('/pause', async (req, res) => {
  isBotActive = false;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  console.log(`Pausado at ${new Date().toISOString()}`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot pausado');
  res.send('Pausado');
});

app.get('/resume', async (req, res) => {
  isBotActive = true;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://talleragil.onrender.com/webhook`);
  console.log(`Reanudado at ${new Date().toISOString()}`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot reanudado');
  res.send('Reanudado');
});

// Wake para activación manual
app.get('/wake', async (req, res) => {
  console.log(`Wake request at ${new Date().toISOString()} (outside hours)`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot despertado manualmente');
  res.send('Bot despertado - ahora activo temporalmente');
});

// API para OT
app.get('/api/ot/:id', async (req, res) => {
  const id = req.params.id;
  const ot = await otService.getOT(id);
  res.json(ot || { error: 'OT no encontrada' });
});

// Inicia el servidor con manejo de errores
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT} at ${new Date().toISOString()}`);
}).on('error', (error) => {
  console.error(`Server error at ${new Date().toISOString()}: ${error.message}`);
});
