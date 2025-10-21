// src/helpers/telegramHelpers.js
const { API_URL } = require('../config/telegram');

/**
 * Realiza una petición a la API de Telegram con reintentos en caso de error
 * @param {string} endpoint - Endpoint de la API de Telegram
 * @param {Object} body - Cuerpo de la petición
 * @param {number} maxRetries - Número máximo de reintentos (default: 3)
 * @returns {Promise<Object>} Respuesta de la API
 * @private
 */
async function telegramRequest(endpoint, body, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!data.ok) {
        // Error de Telegram API
        if (data.error_code === 400 && data.description.includes('message is not modified')) {
          // Mensaje idéntico, no es error crítico
          return data;
        }
        throw new Error(`Telegram API Error: ${data.description}`);
      }

      return data;

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Intento ${attempt}/${maxRetries} falló en ${endpoint}:`, error.message);

      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Si llegamos aquí, fallaron todos los intentos
  console.error(`❌ Error definitivo en ${endpoint} después de ${maxRetries} intentos:`, lastError.message);
  throw lastError;
}

/**
 * Envía acción "typing" al chat
 * @param {number} chatId - ID del chat de Telegram
 * @returns {Promise<void>}
 */
async function sendTyping(chatId) {
  try {
    await telegramRequest('sendChatAction', {
      chat_id: chatId,
      action: 'typing'
    }, 1); // Solo 1 intento para typing (no crítico)
  } catch (error) {
    // No propagar error de typing, no es crítico
    console.error('Error sendTyping:', error.message);
  }
}

/**
 * Envía un mensaje de texto simple
 * @param {number} chatId - ID del chat de Telegram
 * @param {string} text - Texto del mensaje (soporta HTML)
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function sendMessage(chatId, text, options = {}) {
  if (!text || text.trim().length === 0) {
    throw new Error('El texto del mensaje no puede estar vacío');
  }

  return await telegramRequest('sendMessage', {
    chat_id: chatId,
    text: text.substring(0, 4096), // Límite de Telegram
    parse_mode: 'HTML',
    ...options
  });
}

/**
 * Envía un mensaje con teclado inline
 * @param {number} chatId - ID del chat de Telegram
 * @param {string} text - Texto del mensaje (soporta HTML)
 * @param {Array} keyboard - Array de botones inline
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function sendKeyboard(chatId, text, keyboard, options = {}) {
  if (!text || text.trim().length === 0) {
    throw new Error('El texto del mensaje no puede estar vacío');
  }

  if (!Array.isArray(keyboard) || keyboard.length === 0) {
    throw new Error('El teclado debe ser un array no vacío');
  }

  return await telegramRequest('sendMessage', {
    chat_id: chatId,
    text: text.substring(0, 4096),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
    ...options
  });
}

/**
 * Edita un mensaje existente
 * @param {number} chatId - ID del chat de Telegram
 * @param {number} messageId - ID del mensaje a editar
 * @param {string} text - Nuevo texto del mensaje (soporta HTML)
 * @param {Array|null} keyboard - Array de botones inline (opcional)
 * @param {Object} options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function editMessage(chatId, messageId, text, keyboard = null, options = {}) {
  if (!text || text.trim().length === 0) {
    throw new Error('El texto del mensaje no puede estar vacío');
  }

  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text.substring(0, 4096),
    parse_mode: 'HTML',
    ...options
  };

  if (keyboard && Array.isArray(keyboard)) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  try {
    return await telegramRequest('editMessageText', body);
  } catch (error) {
    // Si el error es "message is not modified", no es crítico
    if (error.message.includes('message is not modified')) {
      console.log('ℹ️ Mensaje no modificado (contenido idéntico)');
      return { ok: true };
    }
    throw error;
  }
}

/**
 * Responde a un callback query (quita el relojito)
 * @param {string} callbackQueryId - ID del callback query
 * @param {string} text - Texto a mostrar (opcional)
 * @param {boolean} showAlert - Mostrar como alerta (opcional)
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function answerCallback(callbackQueryId, text = '', showAlert = false) {
  return await telegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || undefined,
    show_alert: showAlert
  }, 2); // Máximo 2 intentos
}

/**
 * Envía un documento/archivo
 * @param {number} chatId - ID del chat de Telegram
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} filename - Nombre del archivo
 * @param {string} caption - Descripción del archivo (opcional)
 * @returns {Promise<Object>} Respuesta de Telegram
 */
async function sendDocument(chatId, fileBuffer, filename, caption = '') {
  try {
    const { BOT_TOKEN } = require('../config/telegram');
    const FormData = require('form-data');

    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });

    if (caption) {
      formData.append('caption', caption.substring(0, 1024));
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API Error: ${data.description}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Error sendDocument:', error.message);
    throw error;
  }
}

/**
 * Crea un botón inline
 * @param {string} text - Texto del botón
 * @param {string} callbackData - Datos del callback (max 64 bytes)
 * @returns {Object} Objeto botón inline
 */
function btn(text, callbackData) {
  if (!text || !callbackData) {
    throw new Error('Texto y callbackData son requeridos');
  }

  if (callbackData.length > 64) {
    console.warn(`⚠️ CallbackData muy largo (${callbackData.length} bytes), será truncado`);
    callbackData = callbackData.substring(0, 64);
  }

  return { text, callback_data: callbackData };
}

/**
 * Divide un array en chunks (para paginación de botones)
 * @param {Array} array - Array a dividir
 * @param {number} size - Tamaño de cada chunk
 * @returns {Array} Array de chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  sendTyping,
  sendMessage,
  sendKeyboard,
  editMessage,
  answerCallback,
  sendDocument,
  btn,
  chunkArray
};
