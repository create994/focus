const config = require('../utils/config');
const logger = require('../utils/logger');
const { models } = require('../db/database');
const maxPlatformAdapter = require('./maxPlatformAdapter');
const dataSource = require('./dataSource');

const offsetsConfig = () => {
  if (Array.isArray(config.reminderOffsetsMinutes) && config.reminderOffsetsMinutes.length > 0) {
    return config.reminderOffsetsMinutes;
  }
  return [config.reminderLeadMinutes].filter(Boolean);
};

const buildReminderMessage = (userLocale, event, minutesLeft) => {
  const locale = userLocale === 'ru' ? 'ru' : 'en';
  const title = locale === 'ru' ? 'Напоминание о событии' : 'Event reminder';
  const timeLabel = locale === 'ru' ? 'Время' : 'Time';
  const locationLabel = locale === 'ru' ? 'Место' : 'Location';
  const minutesLabel = locale === 'ru' ? `Через ${minutesLeft} мин.` : `In ${minutesLeft} min`;

  return {
    type: 'structured',
    locale,
    content: {
      type: 'card',
      version: '1.0',
      header: title,
      body: [
        { type: 'text', text: event.title, style: 'header' },
        { type: 'text', text: `${timeLabel}: ${new Date(event.startTime).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { timeZone: config.timezone })}` },
        ...(event.location ? [{ type: 'text', text: `${locationLabel}: ${event.location}` }] : []),
        { type: 'text', text: minutesLabel }
      ],
      actions: [
        {
          type: 'reply',
          title: locale === 'ru' ? 'Показать расписание' : 'Show my schedule',
          payload: locale === 'ru' ? 'Показать расписание' : 'Show my schedule'
        }
      ]
    }
  };
};

const selectOrganizationContext = (event) => {
  if (!event || !event.Organization) {
    return {};
  }

  return {
    organizationName: event.Organization.name,
    organizationType: event.Organization.type
  };
};

const sendReminder = async ({ user, event, minutesLeft }) => {
  if (!user.maxChatId) {
    logger.warn('Skipping reminder because chatId is missing', { userId: user.id, eventId: event.id });
    return;
  }

  const message = buildReminderMessage(user.locale, event, minutesLeft);
  const response = await maxPlatformAdapter.sendMessage({
    chatId: user.maxChatId,
    message
  });

  await dataSource.recordMessageLog({
    userId: user.id,
    eventId: event.id,
    direction: 'outgoing',
    payload: { ...message, reminder: true },
    statusCode: response.status
  });
};

const dispatchUpcomingReminders = async (referenceDate = new Date()) => {
  const windowStart = referenceDate;
  const maxOffset = Math.max(config.reminderLeadMinutes, offsetsConfig()[0] || 0);
  const windowEnd = new Date(referenceDate.getTime() + maxOffset * 60 * 1000);
  const offsets = offsetsConfig();

  const subscriptions = await models.Subscription.findAll({
    where: { status: 'accepted' },
    include: [
      models.User,
      {
        model: models.Event,
        include: [models.Organization]
      }
    ]
  });

  const remindersToSend = subscriptions.filter(({ Event: event, lastReminderAt }) => {
    if (!event || !event.startTime) return false;
    const startTime = new Date(event.startTime);
    if (startTime < windowStart || startTime > windowEnd) return false;
    if (!lastReminderAt) return true;
    return new Date(lastReminderAt) < windowStart;
  });

  for (const subscription of remindersToSend) {
    const { User: user, Event: event } = subscription;
    const minutesLeft = Math.max(
      1,
      Math.round((new Date(event.startTime) - referenceDate) / (60 * 1000))
    );

    const nextOffset = offsets.find((offset) => {
      const alreadySentHigherOffset =
        typeof subscription.lastReminderOffset === 'number' && offset >= subscription.lastReminderOffset;
      const withinWindow =
        minutesLeft <= offset && minutesLeft >= Math.max(offset - config.reminderToleranceMinutes, 0);
      return withinWindow && !alreadySentHigherOffset;
    });

    if (!nextOffset) {
      continue;
    }

    try {
      await sendReminder({ user, event, minutesLeft: nextOffset });
      subscription.lastReminderAt = new Date();
      subscription.lastReminderOffset = nextOffset;
      await subscription.save();
      const context = selectOrganizationContext(event);
      logger.info('Reminder dispatched', {
        userId: user.id,
        eventId: event.id,
        minutesLeft: nextOffset,
        ...context
      });
    } catch (error) {
      logger.error('Failed to dispatch reminder', { error: error.message, userId: user.id, eventId: event.id });
      await dataSource.recordMessageLog({
        userId: user.id,
        eventId: event.id,
        direction: 'outgoing',
        payload: { reminder: true, offset: nextOffset },
        statusCode: error.response?.status || 500,
        error: error.message
      });
    }
  }
};

const scheduleImmediateReminder = async (user, event) => {
  const now = new Date();
  const minutesLeft = Math.max(
    1,
    Math.round((new Date(event.startTime) - now) / (60 * 1000))
  );
  await sendReminder({ user, event, minutesLeft });
};

module.exports = {
  dispatchUpcomingReminders,
  scheduleImmediateReminder
};

