const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    const chatId = message?.chat?.id;

    console.log('Webhook received:', JSON.stringify(req.body).substring(0, 200));

    if (!chatId) {
      return res.sendStatus(200);
    }

    if (message?.text === '/start') {
      await sendTelegramMessage(chatId, 
        '¡Bienvenido a R&S Automoción! 🚗\n\n' +
        'Usa la Mini App para gestionar clientes, OT y facturas.'
      );
      return res.sendStatus(200);
    }

    if (message?.text === '/help') {
      await sendTelegramMessage(chatId,
        'Comandos disponibles:\n' +
        '/start - Iniciar bot\n' +
        '/help - Ver ayuda\n' +
        '/stats - Ver estadísticas'
      );
      return res.sendStatus(200);
    }

    if (message?.text === '/stats') {
      const dashboardService = require('../services/DashboardService');
      const resumen = await dashboardService.getResumen();

      await sendTelegramMessage(chatId,
        `📊 Estadísticas R&S Automoción\n\n` +
        `✅ OT Completadas: ${resumen.otCompletadas}\n` +
        `⏳ OT Pendientes: ${resumen.otPendientes}\n` +
        `💰 Ingresos Brutos: ${resumen.ingresosBrutos.toFixed(2)}€\n` +
        `💵 Ingresos Netos: ${resumen.ingresosNetos.toFixed(2)}€\n` +
        `⚠️ Pagos Pendientes: ${resumen.pagosPendientes.toFixed(2)}€\n` +
        `🔴 Facturas Vencidas: ${resumen.facturasVencidas}`
      );
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook:', error.message);
    res.sendStatus(500);
  }
});

async function sendTelegramMessage(chatId, text) {
  const { BOT_TOKEN } = require('../config/telegram');
  
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error.message);
  }
}

module.exports = router;