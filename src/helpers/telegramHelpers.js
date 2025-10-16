// src/helpers/telegramHelpers.js
const { API_URL } = require('../config/telegram');

async function sendTyping(chatId) {
  try {
    await fetch(`${API_URL}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    });
  } catch (error) {
    console.error('Error sendTyping:', error.message);
  }
}

async function sendMessage(chatId, text) {
  try {
    await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Error sendMessage:', error.message);
  }
}

async function sendKeyboard(chatId, text, keyboard) {
  try {
    await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      })
    });
  } catch (error) {
    console.error('Error sendKeyboard:', error.message);
  }
}

async function editMessage(chatId, messageId, text, keyboard = null) {
  try {
    const body = { 
      chat_id: chatId, 
      message_id: messageId, 
      text,
      parse_mode: 'HTML'
    };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    
    await fetch(`${API_URL}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Error editMessage:', error.message);
  }
}

async function answerCallback(callbackQueryId) {
  try {
    await fetch(`${API_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
  } catch (error) {
    console.error('Error answerCallback:', error.message);
  }
}

function btn(text, callbackData) {
  return { text, callback_data: callbackData };
}

module.exports = {
  sendTyping,
  sendMessage,
  sendKeyboard,
  editMessage,
  answerCallback,
  btn
};
