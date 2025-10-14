const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');

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
      console.log(`SheetsDB.getData success for ${range} at ${new Date().toISOString()}`);
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
      console.log(`SheetsDB.appendData success for ${range} with values ${JSON.stringify(values)} at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`SheetsDB.appendData error at ${new Date().toISOString()}: ${error.message} - Values: ${JSON.stringify(values)}`);
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
}

class ClientService {
  constructor(db) {
    this.db = db;
  }

  async createClient(name, phone) {
    try {
      const id = uuid();
      await this.db.appendData('CLIENTES!A:D', [[id, name, phone, new Date().toISOString()]]);
      console.log(`Client created: ${id}, ${name}, ${phone} at ${new Date().toISOString()}`);
      return { id, name, phone };
    } catch (error) {
      console.error(`ClientService.createClient error at ${new Date().toISOString()}: ${error.message}`);
      return null;
    }
  }
}

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DRIVE_ROOT_ID = process.env.DRIVE_ROOT_ID;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

let isBotActive = true;
let userStates = {}; // Para rastrear el estado del formulario por chatId

// Inicialización de dependencias
let db, storage, clientService;
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
  db = new SheetsDB(auth, SPREADSHEET_ID);
  storage = new DriveStorage(auth, DRIVE_ROOT_ID);
  clientService = new ClientService(db);
} catch (error) {
  console.error(`Error initializing services at ${new Date().toISOString()}: ${error.message}`);
}

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

app.post('/webhook', async (req, res) => {
  if (!isBotActive) return res.sendStatus(200);
  const update = req.body;
  const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
  const text = update.message ? update.message.text : null;
  const data = update.callback_query ? update.callback_query.data : null;
  const messageId = update.message ? update.message.message_id : (update.callback_query ? update.callback_query.message.message_id : null);

  try {
    console.log(`Received: ${text || data} from ${chatId} at ${new Date().toISOString()}`);
    if (!userStates[chatId]) userStates[chatId] = { step: 'start' };

    if (text) {
      if (text === '/start') {
        userStates[chatId] = { step: 'start' };
        await sendKb(chatId, 'Bienvenido a Taller Ágil. Crea un nuevo cliente:', {
          inline_keyboard: [[{ text: 'Nuevo Cliente', callback_data: 'start_new_client' }]],
        });
      } else if (userStates[chatId].step === 'enter_name') {
        userStates[chatId].name = text;
        userStates[chatId].step = 'enter_phone';
        await sendKb(chatId, 'Introduce el teléfono:', {
          inline_keyboard: [[{ text: 'Siguiente', callback_data: 'next_phone' }]],
        });
      } else if (userStates[chatId].step === 'enter_phone') {
        userStates[chatId].phone = text;
        userStates[chatId].step = 'confirm_client';
        await sendKb(chatId, `Confirmar: Nombre: ${userStates[chatId].name}, Teléfono: ${text}`, {
          inline_keyboard: [
            [{ text: 'Guardar', callback_data: 'save_client' }],
            [{ text: 'Editar Nombre', callback_data: 'edit_name' }],
            [{ text: 'Editar Teléfono', callback_data: 'edit_phone' }],
            [{ text: 'Cancelar', callback_data: 'start' }],
          ],
        });
      }
    }

    if (data) {
      if (data === 'start_new_client') {
        userStates[chatId] = { step: 'enter_name' };
        await sendKb(chatId, 'Introduce el nombre:', {
          inline_keyboard: [[{ text: 'Siguiente', callback_data: 'next_name' }]],
        });
      } else if (data === 'next_name' && userStates[chatId].step === 'enter_name') {
        await sendText(chatId, 'Por favor, escribe el nombre primero.');
      } else if (data === 'next_phone' && userStates[chatId].step === 'enter_phone') {
        await sendText(chatId, 'Por favor, escribe el teléfono primero.');
      } else if (data === 'save_client' && userStates[chatId].step === 'confirm_client') {
        const client = await clientService.createClient(userStates[chatId].name, userStates[chatId].phone);
        if (client) {
          await sendKb(chatId, `Cliente guardado: ${client.name} (ID: ${client.id})`, {
            inline_keyboard: [[{ text: 'Nuevo Cliente', callback_data: 'start_new_client' }]],
          });
          delete userStates[chatId];
        } else {
          await sendText(chatId, 'Error al guardar el cliente. Revisa los logs.');
        }
      } else if (data === 'edit_name' && userStates[chatId].step === 'confirm_client') {
        userStates[chatId].step = 'enter_name';
        await sendKb(chatId, 'Edita el nombre:', {
          inline_keyboard: [[{ text: 'Siguiente', callback_data: 'next_name' }]],
        });
      } else if (data === 'edit_phone' && userStates[chatId].step === 'confirm_client') {
        userStates[chatId].step = 'enter_phone';
        await sendKb(chatId, 'Edita el teléfono:', {
          inline_keyboard: [[{ text: 'Siguiente', callback_data: 'next_phone' }]],
        });
      } else if (data === 'start') {
        userStates[chatId] = { step: 'start' };
        await sendKb(chatId, 'Bienvenido a Taller Ágil. Crea un nuevo cliente:', {
          inline_keyboard: [[{ text: 'Nuevo Cliente', callback_data: 'start_new_client' }]],
        });
      }
    }
  } catch (error) {
    console.error(`Error at ${new Date().toISOString()}: ${error.message}`);
    if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, `Error: ${error.message}`);
  }
  res.sendStatus(200);
});

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

app.get('/wake', async (req, res) => {
  console.log(`Wake request at ${new Date().toISOString()} (outside hours)`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot despertado manualmente');
  res.send('Bot despertado - ahora activo temporalmente');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT} at ${new Date().toISOString()}`);
}).on('error', (error) => {
  console.error(`Server error at ${new Date().toISOString()}: ${error.message}`);
});
