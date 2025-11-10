const { createLogger, format, transports } = require('winston');
const config = require('./config');

const logger = createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}] ${stack || message} ${metaString}`.trim();
    })
  ),
  transports: [
    new transports.Console()
  ]
});

module.exports = logger;

