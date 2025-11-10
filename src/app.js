const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { initDatabase } = require('./db/database');
const { startScheduler } = require('./utils/scheduler');
const dataSource = require('./bot/dataSource');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

app.use((err, req, res, next) => {
  logger.error('Unhandled application error', { error: err.message, stack: err.stack });
  // eslint-disable-next-line n/no-callback-literal
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const start = async () => {
  try {
    await initDatabase();
    await dataSource.initialize();
    await startScheduler();
    app.listen(config.port, () => {
      logger.info(`MAX productivity bot listening on port ${config.port}`, {
        environment: config.env,
        mockMode: config.useMockMaxApi
      });
    });
  } catch (error) {
    logger.error('Failed to start application', { error: error.message });
    process.exitCode = 1;
  }
};

if (require.main === module) {
  start();
}

module.exports = app;

