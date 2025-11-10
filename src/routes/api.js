const express = require('express');
const router = express.Router();

const dataSource = require('../bot/dataSource');
const botLogic = require('../bot/botLogic');
const maxPlatformAdapter = require('../bot/maxPlatformAdapter');
const logger = require('../utils/logger');

router.get('/events', async (req, res) => {
  try {
    const { category, organization, limit } = req.query;
    const events = await dataSource.listUpcomingEvents({
      category,
      organization,
      limit: limit ? Number(limit) : undefined
    });

    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    logger.error('Failed to fetch events', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/subscribe', async (req, res) => {
  try {
    const { maxUserId, chatId, category, eventId } = req.body;
    if (!maxUserId) {
      return res.status(400).json({ success: false, message: 'maxUserId is required' });
    }

    const user = await dataSource.getOrCreateUser({ maxUserId, maxChatId: chatId });
    let events;

    if (eventId) {
      const event = await dataSource.subscribeUserToEvent(user.id, eventId);
      events = [event];
    } else if (category) {
      events = await dataSource.subscribeUserToCategory(user.id, category);
    } else {
      return res.status(400).json({ success: false, message: 'Either eventId or category must be provided' });
    }

    res.json({
      success: true,
      subscribedCount: events ? events.length : 0,
      events
    });
  } catch (error) {
    logger.error('Subscription failed', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { maxUserId, chatId, command } = req.body;
    if (!maxUserId || !command) {
      return res.status(400).json({ success: false, message: 'maxUserId and command are required' });
    }

    await botLogic.processIncomingMessage({
      message: {
        text: command,
        chatId
      },
      user: {
        id: maxUserId
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Chat command failed', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/webhook', async (req, res) => {
  const result = await maxPlatformAdapter.handleIncomingMessage(req.body);
  res.status(result.status || 200).json(result);
});

module.exports = router;

