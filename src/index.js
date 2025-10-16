require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════╗
║   🚗 R&S AUTOMOCIÓN - BACKEND        ║
╠═══════════════════════════════════════╣
║   Port: ${PORT}                      
║   Environment: ${process.env.NODE_ENV || 'development'}
║   MongoDB: Connected                  
║   Status: ✅ ONLINE                   
╚═══════════════════════════════════════╝
      `);
    });

    if (process.env.NODE_ENV === 'production') {
      await registerTelegramWebhook();
    }

  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

async function registerTelegramWebhook() {
  try {
    const { BOT_TOKEN } = require('./config/telegram');
    const webhookUrl = process.env.WEBHOOK_URL || 'https://talleragil.onrender.com/webhook';

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Telegram webhook registrado:', webhookUrl);
    } else {
      console.warn('⚠️ Error registrando webhook:', data.description);
    }
  } catch (error) {
    console.error('❌ Error webhook:', error.message);
  }
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
