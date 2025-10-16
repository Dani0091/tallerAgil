const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

router.get('/wake', (req, res) => {
  console.log('✅ Servicio activado');
  res.json({ status: 'Service activated' });
});

router.get('/resume', async (req, res) => {
  try {
    const { BOT_TOKEN } = require('../config/telegram');

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://talleragil.onrender.com/webhook`
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook reanudado');
      res.json({ status: 'Webhook resumed' });
    } else {
      res.status(400).json({ error: data.description });
    }
  } catch (error) {
    console.error('Error resuming webhook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;