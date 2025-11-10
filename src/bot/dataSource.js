const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { models } = require('../db/database');

const SAMPLE_DATA = [
  {
    organization: 'Tech University',
    events: [
      {
        externalId: 'tech-uni-ml-lecture',
        title: 'Machine Learning Lecture',
        description: 'Introduction to supervised learning with practical examples.',
        datetime: '2025-11-10T10:00:00Z',
        location: 'Auditorium 204',
        category: 'lecture'
      },
      {
        externalId: 'tech-uni-lab',
        title: 'Computer Vision Lab',
        description: 'Hands-on lab on convolutional neural networks.',
        datetime: '2025-11-10T13:00:00Z',
        location: 'Lab 5',
        category: 'workshop'
      }
    ]
  },
  {
    organization: 'Maxim Corp',
    events: [
      {
        externalId: 'maxim-quarterly-sync',
        title: 'Quarterly Strategy Sync',
        description: 'Company-wide alignment meeting for Q4 goals.',
        datetime: '2025-11-10T15:00:00Z',
        location: 'Conference Room A',
        category: 'meeting'
      },
      {
        externalId: 'maxim-standup',
        title: 'Platform Stand-up',
        description: 'Daily platform engineering stand-up call.',
        datetime: '2025-11-11T08:00:00Z',
        location: 'MAX Video Room',
        category: 'meeting'
      }
    ]
  }
];

const resolveDataSourcePath = () => {
  if (!process.env.DATA_SOURCE_PATH) {
    return null;
  }
  return path.isAbsolute(process.env.DATA_SOURCE_PATH)
    ? process.env.DATA_SOURCE_PATH
    : path.resolve(process.cwd(), process.env.DATA_SOURCE_PATH);
};

const loadEventsFromFile = () => {
  const dataSourcePath = resolveDataSourcePath();
  if (!dataSourcePath) {
    return SAMPLE_DATA;
  }

  try {
    const fileContent = fs.readFileSync(dataSourcePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    logger.error('Failed to load events from custom data source, falling back to sample data', { error: error.message });
    return SAMPLE_DATA;
  }
};

const upsertEventRecord = async (organization, eventPayload) => {
  const [event] = await models.Event.findOrCreate({
    where: {
      externalId: eventPayload.externalId || null,
      title: eventPayload.title,
      startTime: new Date(eventPayload.datetime)
    },
    defaults: {
      description: eventPayload.description,
      category: eventPayload.category || 'other',
      location: eventPayload.location,
      startTime: new Date(eventPayload.datetime),
      organization,
      source: eventPayload.source || 'seed',
      metadata: eventPayload.metadata || {}
    }
  });

  return event;
};

const ensureSeedData = async () => {
  const eventCount = await models.Event.count();
  if (eventCount > 0) {
    return;
  }

  const datasets = loadEventsFromFile();

  for (const dataset of datasets) {
    for (const event of dataset.events) {
      // eslint-disable-next-line no-await-in-loop
      await upsertEventRecord(dataset.organization, event);
    }
  }

  logger.info('Seed events inserted into the database');
};

const getOrCreateUser = async ({
  maxUserId,
  maxChatId,
  displayName,
  email,
  role = 'student',
  locale = config.defaultLocale
}) => {
  const [user] = await models.User.findOrCreate({
    where: { maxUserId },
    defaults: {
      maxChatId: maxChatId || null,
      displayName: displayName || null,
      email: email || null,
      role,
      locale
    }
  });

  if (maxChatId && user.maxChatId !== maxChatId) {
    user.maxChatId = maxChatId;
    await user.save();
  }

  return user;
};

const listUpcomingEvents = async ({ category, organization, limit = 10 } = {}) => {
  const where = {
    startTime: {
      [Op.gte]: new Date()
    }
  };

  if (category) {
    where.category = category;
  }

  if (organization) {
    where.organization = organization;
  }

  const events = await models.Event.findAll({
    where,
    order: [['startTime', 'ASC']],
    limit
  });

  return events;
};

const getEventsForUser = async (userId) => {
  const subscriptions = await models.Subscription.findAll({
    where: {
      UserId: userId,
      status: 'accepted'
    },
    include: [models.Event],
    order: [[models.Event, 'startTime', 'ASC']]
  });

  return subscriptions.map((subscription) => subscription.Event);
};

const getNextEventForUser = async (userId) => {
  const subscriptions = await models.Subscription.findAll({
    where: {
      UserId: userId,
      status: 'accepted'
    },
    include: [models.Event],
    order: [[models.Event, 'startTime', 'ASC']],
    limit: 1
  });

  return subscriptions.length > 0 ? subscriptions[0].Event : null;
};

const subscribeUserToEvent = async (userId, eventId) => {
  const event = await models.Event.findByPk(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  const [subscription] = await models.Subscription.findOrCreate({
    where: {
      UserId: userId,
      EventId: eventId
    }
  });

  subscription.status = 'accepted';
  await subscription.save();

  return event;
};

const subscribeUserToCategory = async (userId, category) => {
  const events = await listUpcomingEvents({ category, limit: 5 });
  if (events.length === 0) {
    return null;
  }

  const subscriptions = await Promise.all(
    events.map((event) => subscribeUserToEvent(userId, event.id))
  );

  return subscriptions;
};

const recordMessageLog = async ({
  userId,
  eventId = null,
  direction,
  payload,
  statusCode = null,
  error = null
}) => {
  await models.MessageLog.create({
    UserId: userId || null,
    EventId: eventId,
    direction,
    payload,
    statusCode,
    error
  });
};

const getAvailableCategories = async () => {
  const categories = await models.Event.findAll({
    attributes: ['category'],
    group: ['category']
  });

  return categories.map((entry) => entry.category);
};

module.exports = {
  initialize: async () => {
    await ensureSeedData();
    logger.info('Data source initialized', { organization: config.orgName });
  },
  getOrCreateUser,
  listUpcomingEvents,
  getEventsForUser,
  getNextEventForUser,
  subscribeUserToEvent,
  subscribeUserToCategory,
  recordMessageLog,
  getAvailableCategories
};

