// src/routes/telegram.js
const express = require('express');
const router = express.Router();
const botController = require('../controllers/BotController');
const { answerCallback } = require('../helpers/telegramHelpers');

router.post('/', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    console.log('📥 Webhook received:', JSON.stringify(req.body).substring(0, 200));
    
    // ===== MANEJO DE CALLBACKS (BOTONES) =====
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const messageId = callback_query.message.message_id;
      const action = callback_query.data;
      
      console.log(`🔘 Callback: ${action} from ${chatId}`);
      
      // Procesar callback
      await botController.handleCallback(chatId, messageId, action);
      
      // Responder callback query (quitar relojito)
      await answerCallback(callback_query.id);
      
      return res.sendStatus(200);
    }
    
    // ===== MANEJO DE MENSAJES DE TEXTO =====
    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;
      
      console.log(`💬 Message: "${text}" from ${chatId}`);
      
      // Procesar mensaje
      await botController.handleTextCommand(chatId, text);
      
      return res.sendStatus(200);
    }
    
    // Otros tipos de mensajes (fotos, documentos, etc.)
    res.sendStatus(200);
    
  } catch (error) {
    console.error('❌ Error en webhook:', error.message);
    console.error(error.stack);
    res.sendStatus(500);
  }
});

module.exports = router;