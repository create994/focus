const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { models } = require('../db/database');

const SAMPLE_DATA = [
  {
    organization: 'Tech University',
    organizationDetails: {
      type: 'education',
      timezone: 'Europe/Moscow',
      defaultLocale: 'ru',
      contactEmail: 'it-dept@tech-university.example'
    },
    events: [
      {
        externalId: 'tech-uni-ml-lecture',
        title: 'Machine Learning Lecture',
        description: 'Introduction to supervised learning with practical examples.',
        datetime: '2025-11-10T10:00:00Z',
        location: 'Auditorium 204',
        category: 'lecture',
        audience: 'students',
        metadata: { faculty: 'Computer Science' }
      },
      {
        externalId: 'tech-uni-lab',
        title: 'Computer Vision Lab',
        description: 'Hands-on lab on convolutional neural networks.',
        datetime: '2025-11-10T13:00:00Z',
        location: 'Lab 5',
        category: 'workshop',
        audience: 'students',
        metadata: { equipment: ['GPU cluster', 'Depth cameras'] }
      }
    ]
  },
  {
    organization: 'Maxim Corp',
    organizationDetails: {
      type: 'corporate',
      timezone: 'Europe/Moscow',
      defaultLocale: 'en',
      contactEmail: 'hr@maxim-corp.example'
    },
    events: [
      {
        externalId: 'maxim-quarterly-sync',
        title: 'Quarterly Strategy Sync',
        description: 'Company-wide alignment meeting for Q4 goals.',
        datetime: '2025-11-10T15:00:00Z',
        location: 'Conference Room A',
        category: 'meeting',
        audience: 'employees'
      },
      {
        externalId: 'maxim-standup',
        title: 'Platform Stand-up',
        description: 'Daily platform engineering stand-up call.',
        datetime: '2025-11-11T08:00:00Z',
        location: 'MAX Video Room',
        category: 'meeting',
        audience: 'employees'
      }
    ]
  },
  {
    organization: 'City Theatre Collective',
    organizationDetails: {
      type: 'performing-arts',
      timezone: 'Europe/Moscow',
      defaultLocale: 'ru',
      contactEmail: 'events@citytheatre.example',
      metadata: { venue: 'Downtown Stage' }
    },
    events: [
      {
        externalId: 'theatre-ensemble-preview',
        title: 'Ensemble Preview Night',
        description: 'Open rehearsal with backstage tour for patrons.',
        datetime: '2025-11-12T18:30:00Z',
        location: 'Main Hall',
        category: 'other',
        audience: 'public',
        metadata: { dressCode: 'Smart casual' }
      }
    ]
  },
  {
    organization: 'Healthy Life Clinic',
    organizationDetails: {
      type: 'healthcare',
      timezone: 'Europe/Moscow',
      defaultLocale: 'ru',
      contactEmail: 'staff@healthylife.example',
      metadata: { campus: 'North Wing' }
    },
    events: [
      {
        externalId: 'clinic-shift-briefing',
        title: 'Surgery Team Shift Briefing',
        description: 'Daily stand-up for surgical staff.',
        datetime: '2025-11-11T05:45:00Z',
        location: 'OR Coordination Room',
        category: 'meeting',
        audience: 'employees',
        metadata: { department: 'Surgery' }
      },
      {
        externalId: 'clinic-wellness-workshop',
        title: 'Community Wellness Workshop',
        description: 'Open session on nutrition and preventive care.',
        datetime: '2025-11-13T09:00:00Z',
        location: 'Auditorium B',
        category: 'seminar',
        audience: 'public',
        metadata: { capacity: 120 }
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

const upsertOrganization = async (organizationName, details = {}) => {
  const [organization] = await models.Organization.findOrCreate({
    where: { name: organizationName },
    defaults: {
      type: details.type || 'other',
      defaultLocale: details.defaultLocale || config.defaultLocale,
      timezone: details.timezone || config.timezone,
      contactEmail: details.contactEmail || null,
      metadata: details.metadata || {}
    }
  });

  const shouldUpdate =
    organization.type !== (details.type || organization.type) ||
    organization.defaultLocale !== (details.defaultLocale || organization.defaultLocale) ||
    organization.timezone !== (details.timezone || organization.timezone) ||
    organization.contactEmail !== (details.contactEmail || organization.contactEmail);

  if (shouldUpdate) {
    organization.type = details.type || organization.type;
    organization.defaultLocale = details.defaultLocale || organization.defaultLocale;
    organization.timezone = details.timezone || organization.timezone;
    organization.contactEmail = details.contactEmail || organization.contactEmail;
    organization.metadata = details.metadata || organization.metadata;
    await organization.save();
  }

  return organization;
};

const upsertEventRecord = async (organizationName, organizationDetails, eventPayload) => {
  const organization = await upsertOrganization(organizationName, organizationDetails);

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
      organization: organizationName,
      audience: eventPayload.audience || 'public',
      source: eventPayload.source || 'seed',
      metadata: eventPayload.metadata || {},
      OrganizationId: organization.id
    }
  });

  if (!event.OrganizationId || event.OrganizationId !== organization.id) {
    event.OrganizationId = organization.id;
    event.organization = organizationName;
    event.audience = eventPayload.audience || event.audience || 'public';
    event.metadata = eventPayload.metadata || event.metadata;
    await event.save();
  }

  return event;
};

const ensureSeedData = async () => {
  const eventCount = await models.Event.count();
  if (eventCount > 0) {
    return;
  }

  const datasets = loadEventsFromFile();

  for (const dataset of datasets) {
    // eslint-disable-next-line no-await-in-loop
    await upsertOrganization(dataset.organization, dataset.organizationDetails);
    for (const event of dataset.events) {
      // eslint-disable-next-line no-await-in-loop
      await upsertEventRecord(dataset.organization, dataset.organizationDetails, event);
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

const listUpcomingEvents = async ({ category, organization, audience, organizationType, limit = 10 } = {}) => {
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

  if (audience) {
    where.audience = audience;
  }

  const events = await models.Event.findAll({
    where,
    include: organizationType
      ? [
          {
            model: models.Organization,
            where: { type: organizationType }
          }
        ]
      : [models.Organization],
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
    include: [
      {
        model: models.Event,
        include: [models.Organization]
      }
    ],
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
    include: [
      {
        model: models.Event,
        include: [models.Organization]
      }
    ],
    order: [[models.Event, 'startTime', 'ASC']],
    limit: 1
  });

  return subscriptions.length > 0 ? subscriptions[0].Event : null;
};

const subscribeUserToEvent = async (userId, eventId) => {
  const event = await models.Event.findByPk(eventId, { include: [models.Organization] });
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
  subscription.lastReminderOffset = null;
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

const listOrganizations = async () => {
  const organizations = await models.Organization.findAll({
    order: [['name', 'ASC']]
  });

  return organizations;
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
  getAvailableCategories,
  listOrganizations
};

