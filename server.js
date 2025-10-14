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
const TARIFA_HORA = 50;
const IVA_POR_DEFECTO = 21;

let isBotActive = true;

// Interfaces y clases (igual que antes, omito por longitud, pero incluye todo de tu código original: SheetsDB, DriveStorage, Services)

// ... (pega aquí todo el código de clases IDatabase, IStorage, SheetsDB, DriveStorage, ClientService, OTService, InvoiceService, inicialización db/storage/services, funciones sendText/sendKb/btn)

// Webhook principal con logging
app.post('/webhook', async (req, res) => {
  if (!isBotActive) return res.sendStatus(200);
  const update = req.body;
  const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
  const text = update.message ? update.message.text : null;
  const data = update.callback_query ? update.callback_query.data : null;

  try {
    // ... (lógica igual: /start, /ver_ot, etc.)
    // Añade logging para cambios (e.g., en updateField)
    // En OTService.updateField: console.log(`Update OT ${id}: ${field} = ${value} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error at ${new Date().toISOString()}: ${error.message}`);
    await sendText(ADMIN_CHAT_ID, `Error: ${error.message}`);
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
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://tu-app.onrender.com/webhook`); // Reemplaza con tu URL
  console.log(`Reanudado at ${new Date().toISOString()}`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot reanudado');
  res.send('Reanudado');
});

// Nuevo: Wake for on-demand (despierta servidor fuera horario; envía request manual a esta URL)
app.get('/wake', async (req, res) => {
  console.log(`Wake request at ${new Date().toISOString()} (outside hours)`);
  if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, 'Bot despertado manualmente');
  res.send('Bot despertado - ahora activo temporalmente');
});

// ... (resto: API /api/ot/:id, app.listen)

app.listen(process.env.PORT || 3000, () => console.log('Bot running on Render'));