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
const TARIFA_HORA = 50;
const IVA_POR_DEFECTO = 21;

let isBotActive = true;
let userStates = {}; // Estado de wizards por chatId

// Inicialización de dependencias
let auth, sheets, drive;
try {
  auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
  sheets = google.sheets({ version: 'v4', auth });
  drive = google.drive({ version: 'v3', auth });
  console.log(`Services initialized at ${new Date().toISOString()}`);
} catch (error) {
  console.error(`Error initializing services at ${new Date().toISOString()}: ${error.message}`);
}

async function sendText(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    console.log(`Sent text to ${chatId} at ${new Date().toISOString()}: ${text}`);
  } catch (error) {
    console.error(`Error sending text at ${new Date().toISOString()}: ${error.message}`);
  }
}

async function sendKb(chatId, text, kb) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: kb } }),
    });
    console.log(`Sent keyboard to ${chatId} at ${new Date().toISOString()}: ${text}`);
  } catch (error) {
    console.error(`Error sending keyboard at ${new Date().toISOString()}: ${error.message}`);
  }
}

function btn(label, callback) {
  return { text: label, callback_data: callback };
}

// Helpers
async function getSheetData(range) {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    console.log(`getSheetData success for ${range} at ${new Date().toISOString()}`);
    return response.data.values || [];
  } catch (error) {
    console.error(`getSheetData error at ${new Date().toISOString()}: ${error.message}`);
    return [];
  }
}

async function appendSheetData(range, values) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource: { values },
    });
    console.log(`appendSheetData success for ${range} with ${JSON.stringify(values)} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`appendSheetData error at ${new Date().toISOString()}: ${error.message} - Values: ${JSON.stringify(values)}`);
  }
}

async function updateSheetData(range, values) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource: { values },
    });
    console.log(`updateSheetData success for ${range} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`updateSheetData error at ${new Date().toISOString()}: ${error.message}`);
  }
}

async function createFolder(parentId, name) {
  try {
    const response = await drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    console.log(`createFolder success: ${name} at ${new Date().toISOString()}`);
    return response.data.id;
  } catch (error) {
    console.error(`createFolder error at ${new Date().toISOString()}: ${error.message}`);
    return null;
  }
}

async function copyFile(fileId, parentId, name) {
  try {
    const response = await drive.files.copy({
      fileId,
      resource: { name, parents: [parentId] },
    });
    console.log(`copyFile success: ${name} at ${new Date().toISOString()}`);
    return response.data.id;
  } catch (error) {
    console.error(`copyFile error at ${new Date().toISOString()}: ${error.message}`);
    return null;
  }
}

// Clientes
async function crearCliente(chatId, data) {
  const id = uuid();
  const fecha_alta = new Date().toISOString().split('T')[0];
  const carpeta_id = await ensureCarpetaClienteEnDrive(data.nombre, data.apellidos, data.nif, id);
  await appendSheetData('CLIENTES!A:L', [[id, data.nombre, data.telefono, data.email, data.nif, data.direccion, '', carpeta_id, fecha_alta, data.notas, data.apellidos, data.razon_social]]);
  sendText(chatId, `Cliente creado: ${id}`);
  sendMainMenu(chatId);
}

async function getClienteById(id_cliente) {
  const data = await getSheetData('CLIENTES!A:L');
  return data.find(row => row[0] === id_cliente) || null;
}

async function ensureCarpetaClienteEnDrive(nombre, apellidos, nif, id_cliente) {
  const parent = (await drive.files.list({ q: `'${DRIVE_ROOT_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name='Clientes'`, fields: 'files(id)' })).data.files[0] || await createFolder(DRIVE_ROOT_ID, 'Clientes');
  const folderName = `${nombre} ${apellidos} - ${nif || id_cliente}`;
  const folders = (await drive.files.list({ q: `'${parent.id}' in parents and name='${folderName}'`, fields: 'files(id)' })).data.files;
  if (!folders.length) return (await createFolder(parent.id, folderName)).id;
  return folders[0].id;
}

async function searchClientes(query) {
  const data = (await getSheetData('CLIENTES!A:L')).slice(1);
  return data.filter(row => 
    row[1].toLowerCase().includes(query.toLowerCase()) ||
    row[10].toLowerCase().includes(query.toLowerCase()) ||
    row[4].includes(query) ||
    row[2].includes(query) ||
    row[3].includes(query)
  );
}

// OT
async function crearOT(chatId, data) {
  const OT_ID = uuid();
  const fecha_creacion = new Date().toISOString();
  const estado = "pendiente";
  await appendSheetData('OTS!A:M', [[OT_ID, data.cliente_id, data.matricula, data.marca, data.modelo, data.descripcion, data.horas, data.piezas_notas, data.consumibles_notas, data.coste_estimado || 0, estado, fecha_creacion, "", ""]]);
  sendText(chatId, `OT creada: ${OT_ID}`);
  sendMainMenu(chatId);
}

async function getOTById(OT_ID) {
  const data = await getSheetData('OTS!A:M');
  return data.find(row => row[0] === OT_ID) || null;
}

async function actualizarEstadoOT(OT_ID, nuevo_estado) {
  const data = await getSheetData('OTS!A:M');
  const rowIndex = data.findIndex(row => row[0] === OT_ID);
  if (rowIndex > -1) {
    data[rowIndex][10] = nuevo_estado;
    if (nuevo_estado === "finalizado") data[rowIndex][11] = new Date().toISOString();
    await updateSheetData('OTS!A:M', data);
  }
}

// Facturas
async function generarNumeroFactura() {
  const data = await getSheetData('FACTURAS!A:M');
  const nums = data.slice(1).map(row => parseInt(row[3]) || 0);
  return (Math.max(...nums, 0) + 1).toString().padStart(4, '0');
}

async function generarFacturaDesdeOT(chatId, OT_ID, tasa_iva = IVA_POR_DEFECTO, observaciones = '') {
  const ot = await getOTById(OT_ID);
  if (!ot) throw new Error('OT no encontrada');
  const cliente = await getClienteById(ot[1]);
  if (!cliente) throw new Error('Cliente no encontrado');

  const numero = await generarNumeroFactura();
  const fecha = new Date().toISOString().split('T')[0];
  const subtotal = parseFloat(ot[6]) * TARIFA_HORA; // Horas * tarifa
  const iva_total = Math.round(subtotal * tasa_iva / 100 * 100) / 100;
  const total = Math.round((subtotal + iva_total) * 100) / 100;

  const docId = await copyFile(TEMPLATE_ID, cliente[7], `Factura_${numero}`);
  // Simulación de reemplazo (ajusta según tu template)
  console.log(`Factura generada para OT ${OT_ID} con docId ${docId}`);

  const factura_id = uuid();
  await appendSheetData('FACTURAS!A:M', [[factura_id, OT_ID, ot[1], numero, fecha, subtotal, iva_total, total, 'no', '', '[]', tasa_iva, observaciones]]);
  await actualizarEstadoOT(OT_ID, "finalizado");
  sendText(chatId, `Factura ${numero} generada. Total: ${total}€`);
  sendMainMenu(chatId);
}

// Menú y Handlers
function sendMainMenu(chatId, msg = 'Selecciona opción:') {
  const kb = [
    [btn('👤 Clientes', 'm:clientes'), btn('🧰 OT', 'm:ot')],
    [btn('🧾 Facturas', 'm:facturas'), btn('💳 Pagos', 'm:pagos')],
    [btn('📊 Dashboard', 'm:dashboard'), btn('🔍 Buscar Cliente/NIF', 'search:cli'), btn('🔍 Buscar Matrícula/OT', 'search:ot')],
    [btn('📋 Consultar', 'm:consult')]
  ];
  sendKb(chatId, msg, kb);
}

async function handleMainMenu(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'clientes') handleClientes(chatId, 'cli:menu');
  else if (option === 'ot') handleOT(chatId, 'ot:menu');
  else if (option === 'facturas') handleFacturas(chatId, 'fac:menu');
  else if (option === 'pagos') handlePagos(chatId, 'pay:menu');
  else if (option === 'dashboard') handleDashboard(chatId, 'dash:view');
  else if (option === 'consult') handleConsult(chatId, 'consult:menu');
  else if (option === 'home') sendMainMenu(chatId);
}

async function handleClientes(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'menu') {
    const kb = [
      [btn('➕ Crear', 'cli:new'), btn('✏️ Editar', 'edit:cli:select')],
      [btn('🔎 Buscar', 'search:cli'), btn('⬅️ Menú', 'm:home')]
    ];
    sendKb(chatId, 'Clientes', kb);
  } else if (option === 'new') {
    userStates[chatId] = { type: 'cli:new', fields: ['nombre', 'apellidos', 'telefono', 'email', 'nif', 'direccion', 'razon_social', 'notas'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: cli:new`);
    await sendText(chatId, 'Introduce nombre:');
  }
}

async function handleOT(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'menu') {
    const kb = [
      [btn('➕ Crear OT', 'ot:new'), btn('✏️ Editar OT', 'edit:ot:select')],
      [btn('🔎 Buscar OT', 'search:ot'), btn('📋 Listar OT', 'ot:list')],
      [btn('⬅️ Menú', 'm:home')]
    ];
    sendKb(chatId, 'OT', kb);
  } else if (option === 'new') {
    userStates[chatId] = { type: 'ot:new', fields: ['cliente_id', 'matricula', 'marca', 'modelo', 'descripcion', 'horas', 'piezas_notas', 'consumibles_notas', 'coste_estimado'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: ot:new`);
    await sendText(chatId, 'Introduce cliente_id:');
  } else if (option === 'list') {
    const ots = (await getSheetData('OTS!A:M')).slice(-10);
    const msg = 'Últimas 10 OT:\n' + ots.map(row => `${row[0]} - Matrícula: ${row[2]} - Estado: ${row[10]}`).join('\n');
    await sendText(chatId, msg);
  }
}

async function handleFacturas(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'menu') {
    const kb = [
      [btn('🧾 Generar desde OT', 'fac:fromOT'), btn('✏️ Editar Factura', 'edit:fac:select')],
      [btn('📚 Listar últimas', 'fac:list'), btn('⬅️ Menú', 'm:home')]
    ];
    sendKb(chatId, 'Facturas', kb);
  } else if (option === 'fromOT') {
    await sendText(chatId, 'Indica OT_ID:');
    userStates[chatId] = { type: 'fac:fromOT', fields: ['OT_ID'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: fac:fromOT`);
  } else if (option === 'list') {
    const facturas = (await getSheetData('FACTURAS!A:M')).slice(-5);
    const msg = 'Últimas 5 Facturas:\n' + facturas.map(row => `${row[3]} - Total: ${row[7]} - Pagado: ${row[8]}`).join('\n');
    await sendText(chatId, msg);
  }
}

async function handlePagos(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'menu') {
    const kb = [
      [btn('💳 Registrar pago', 'pay:reg'), btn('✏️ Editar Pago', 'edit:pay:select')],
      [btn('⬅️ Menú', 'm:home')]
    ];
    sendKb(chatId, 'Pagos', kb);
  } else if (option === 'reg') {
    userStates[chatId] = { type: 'pay:reg', fields: ['factura_id', 'importe', 'metodo', 'justificante_link'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: pay:reg`);
    await sendText(chatId, 'Introduce factura_id:');
  }
}

async function handleDashboard(chatId, data) {
  const facturas = (await getSheetData('FACTURAS!A:M')).slice(1);
  const ots = (await getSheetData('OTS!A:M')).slice(1);
  const totalFacturado = facturas.reduce((sum, row) => sum + (parseFloat(row[7]) || 0), 0);
  let totalCobrado = 0;
  facturas.forEach(row => totalCobrado += JSON.parse(row[10] || '[]').reduce((sum, p) => sum + p.importe, 0));
  const pendienteCobro = totalFacturado - totalCobrado;
  const numOT = ots.length;
  const numOTPendientes = ots.filter(row => row[10] !== 'finalizado').length;
  const numFacturas = facturas.length;
  const numFacturasPagadas = facturas.filter(row => row[8] === 'sí').length;
  const avgTicket = numFacturas > 0 ? totalFacturado / numFacturas : 0;

  const msg = `Dashboard:\nTotal Facturado: ${totalFacturado.toFixed(2)}€\nTotal Cobrado: ${totalCobrado.toFixed(2)}€\nPendiente: ${pendienteCobro.toFixed(2)}€\nOT: ${numOT} (Pendientes: ${numOTPendientes})\nFacturas: ${numFacturas} (Pagadas: ${numFacturasPagadas})\nAvg Ticket: ${avgTicket.toFixed(2)}€`;
  await sendText(chatId, msg);
}

async function handleConsult(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'menu') {
    const kb = [
      [btn('Ver OT', 'consult:ot'), btn('Ver Facturas', 'consult:fac')],
      [btn('Ver Pagos', 'consult:pay'), btn('Ver Dashboard', 'consult:dash')],
      [btn('⬅️ Menú', 'm:home')]
    ];
    sendKb(chatId, 'Consultas', kb);
  } else if (option === 'ot') {
    await sendText(chatId, 'Introduce OT_ID:');
    userStates[chatId] = { type: 'consult:ot', fields: ['OT_ID'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: consult:ot`);
  } else if (option === 'fac') {
    await sendText(chatId, 'Introduce número de factura:');
    userStates[chatId] = { type: 'consult:fac', fields: ['num'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: consult:fac`);
  }
}

async function handleSearch(chatId, data) {
  const option = data.split(':')[1];
  if (option === 'cli') {
    await sendText(chatId, 'Introduce consulta (nombre, NIF, teléfono, email):');
    userStates[chatId] = { type: 'search:cli', fields: ['query'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: search:cli`);
  } else if (option === 'ot') {
    await sendText(chatId, 'Introduce consulta (OT_ID, matrícula, estado):');
    userStates[chatId] = { type: 'search:ot', fields: ['query'], current: 0, data: {} };
    console.log(`Wizard started for ${chatId} at ${new Date().toISOString()}: search:ot`);
  }
}

async function wizardStep(chatId, text) {
  if (!userStates[chatId]) return;
  const state = userStates[chatId];
  console.log(`Wizard step for ${chatId} at ${new Date().toISOString()}: Current field ${state.fields[state.current]}, Text: ${text}`);
  const field = state.fields[state.current];

  if (text) state.data[field] = text;

  state.current++;
  if (state.current < state.fields.length) {
    userStates[chatId] = state;
    await sendText(chatId, `Introduce ${state.fields[state.current]}:`);
  } else {
    let resumen = 'Resumen:\n';
    state.fields.forEach(f => resumen += `${f}: ${state.data[f] || 'vacío'}\n`);
    const kb = [
      [btn('✅ Guardar', `wiz:${state.type}:confirm`)],
      state.fields.map(f => btn(`✏️ Editar ${f}`, `wiz:${state.type}:edit:${f}`)),
      [btn('❌ Cancelar', `wiz:${state.type}:cancel`)]
    ];
    await sendKb(chatId, resumen + '\n¿Confirmar?', kb);
  }
}

async function handleWizardActions(chatId, data) {
  const [wiz, type, action, field] = data.split(':');
  const state = userStates[chatId];
  console.log(`Wizard action for ${chatId} at ${new Date().toISOString()}: ${action}, Type: ${type}, Field: ${field}`);

  if (action === 'confirm') {
    if (type === 'cli:new') await crearCliente(chatId, state.data);
    else if (type === 'ot:new') await crearOT(chatId, state.data);
    else if (type === 'fac:fromOT') await generarFacturaDesdeOT(chatId, state.data.OT_ID);
    delete userStates[chatId];
  } else if (action === 'cancel') {
    delete userStates[chatId];
    await sendText(chatId, 'Operación cancelada.');
    sendMainMenu(chatId);
  } else if (action === 'edit') {
    state.current = state.fields.indexOf(field);
    userStates[chatId] = state;
    await sendText(chatId, `Edita ${field}: (actual: ${state.data[field] || 'vacío'})`);
  }
}

// Webhook
app.post('/webhook', async (req, res) => {
  if (!isBotActive) return res.sendStatus(200);
  const update = req.body;
  const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
  const text = update.message ? update.message.text : null;
  const data = update.callback_query ? update.callback_query.data : null;

  try {
    console.log(`Received: ${text || data} from ${chatId} at ${new Date().toISOString()}`);
    if (text === '/start') {
      sendMainMenu(chatId);
    } else if (text && userStates[chatId]) {
      await wizardStep(chatId, text);
    } else if (text && text.startsWith('/ver_ot')) {
      const OT_ID = text.split(' ')[1];
      if (OT_ID) await showOTDetails(chatId, OT_ID);
      else await sendText(chatId, 'Usa /ver_ot [ID]');
    } else if (data && data.startsWith('m:')) await handleMainMenu(chatId, data);
    else if (data && data.startsWith('wiz:')) await handleWizardActions(chatId, data);
    else if (data && data.startsWith('search:')) await handleSearch(chatId, data);
  } catch (error) {
    console.error(`Error at ${new Date().toISOString()}: ${error.message}`);
    if (ADMIN_CHAT_ID) await sendText(ADMIN_CHAT_ID, `Error: ${error.message}`);
  }
  res.sendStatus(200);
});

// Otros endpoints
app.get('/pause', async (req, res) => {
  isBotActive = false;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  console.log(`Pausado at ${new Date().toISOString()}`);
  res.send('Pausado');
});

app.get('/resume', async (req, res) => {
  isBotActive = true;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://talleragil.onrender.com/webhook`);
  console.log(`Reanudado at ${new Date().toISOString()}`);
  res.send('Reanudado');
});

app.get('/wake', async (req, res) => {
  console.log(`Wake request at ${new Date().toISOString()} (outside hours)`);
  res.send('Bot despertado - ahora activo temporalmente');
});

// Funciones adicionales
async function showOTDetails(chatId, OT_ID) {
  const ot = await getOTById(OT_ID);
  if (!ot) return await sendText(chatId, 'OT no encontrada');
  const msg = `OT ${OT_ID}:\nMatrícula: ${ot[2]}\nDescripción: ${ot[5]}\nHoras: ${ot[6]}\nPiezas: ${ot[7]}\nConsumibles: ${ot[8]}\nEstado: ${ot[10]}`;
  const kb = [[btn('⬅️ Menú', 'm:home')]];
  await sendKb(chatId, msg, kb);
}
