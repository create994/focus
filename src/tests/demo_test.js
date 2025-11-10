/* eslint-disable no-console */
process.env.USE_MOCK_MAX_API = 'true';

const { initDatabase } = require('../db/database');
const dataSource = require('../bot/dataSource');
const botLogic = require('../bot/botLogic');
const reminders = require('../bot/reminders');

const demo = async () => {

  await initDatabase();
  await dataSource.initialize();

  const payload = {
    message: {
      text: 'Show my schedule',
      chatId: 'demo-chat'
    },
    user: {
      id: 'demo-user',
      displayName: 'Demo User',
      locale: 'en'
    }
  };

  console.log('=== Sending command: Show my schedule ===');
  await botLogic.processIncomingMessage(payload);

  console.log('=== Scheduling reminders sweep ===');
  await reminders.dispatchUpcomingReminders(new Date());

  console.log('Demo test finished. Check logs above for reminder dispatch details.');
};

demo()
  .then(() => {
    console.log('Demo script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Demo script failed', error);
    process.exit(1);
  });

