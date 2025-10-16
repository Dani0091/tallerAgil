require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

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