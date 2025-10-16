#!/bin/bash

# ================================================================
# SCRIPT PARTE 2: CREAR SERVICES, ROUTES, MIDDLEWARE, UTILS, APP
# Ejecutar desde la raíz del proyecto (tallerAgil/)
# ================================================================

echo "🚀 Creando Services, Routes, Middleware, Utils y App..."

# Debido a limitaciones de longitud, voy a crear un script que descarga
# los archivos desde snippets individuales.

# Por ahora, te doy los archivos MÁS CRÍTICOS:

# ================================================================
# APP.JS
# ================================================================
cat > src/app.js << 'EOF'
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const connectDB = require('./config/database');

const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');
const telegramRoutes = require('./routes/telegram');

const errorHandler = require('./middleware/errorHandler');
const loggerMiddleware = require('./middleware/logger');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(loggerMiddleware);

app.use('/health', healthRoutes);
app.use('/wake', healthRoutes);
app.use('/resume', healthRoutes);
app.use('/webhook', telegramRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'R&S Automoción API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      api: '/api/*',
      webhook: '/webhook'
    }
  });
});

app.use(errorHandler);

module.exports = app;
EOF

echo "✅ app.js creado"

# ================================================================
# INDEX.JS
# ================================================================
cat > src/index.js << 'EOF'
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
EOF

echo "✅ index.js creado"

echo ""
echo "✅ ARCHIVOS PRINCIPALES CREADOS"
echo ""
echo "⚠️  NOTA: Por limitaciones de longitud, los Services, Routes, Middleware y Utils"
echo "    se crearán en el siguiente paso."
echo ""
echo "Continúa con las instrucciones manuales para completar los archivos restantes."
