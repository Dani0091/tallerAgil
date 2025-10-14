const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');

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
const TARIFA_HORA = 40;
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

// Webhook principal con logging
app.post('/webhook', async (req, res) => {
  if (!isBotActive) return res.sendStatus(200);
  const update = req.body;
  const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
  const text = update.message ? update.message.text : null;
  const data = update.callback_query ? update.callback_query.data : null;

  try {
    if (text && text.startsWith('/update_')) console.log(`Update command ${text} at ${new Date().toISOString()}`);
    // Lógica existente (/start, /ver_ot, etc.)
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
