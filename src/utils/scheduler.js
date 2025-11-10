const cron = require('node-cron');
const logger = require('./logger');
const config = require('./config');
const reminders = require('../bot/reminders');

let reminderTask;

const startScheduler = async () => {
  if (reminderTask) {
    reminderTask.stop();
  }

  reminderTask = cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        await reminders.dispatchUpcomingReminders(new Date());
      } catch (error) {
        logger.error('Scheduled reminder sweep failed', { error: error.message });
      }
    },
    {
      scheduled: true,
      timezone: config.timezone
    }
  );

  logger.info('Scheduler started', { cron: '*/5 * * * *', timezone: config.timezone });
  return reminderTask;
};

const stopScheduler = () => {
  if (reminderTask) {
    reminderTask.stop();
    logger.info('Scheduler stopped');
  }
};

module.exports = {
  startScheduler,
  stopScheduler
};

