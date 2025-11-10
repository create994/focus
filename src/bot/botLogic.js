const config = require('../utils/config');
const logger = require('../utils/logger');
const dataSource = require('./dataSource');
const reminders = require('./reminders');
const maxPlatformAdapter = require('./maxPlatformAdapter');

const COPY = {
  en: {
    greeting: 'Hello! I can help you stay on top of your schedule. Choose an option:',
    options: ['Show my schedule', 'Subscribe to category', 'Remind me about next event'],
    noEvents: 'You have no upcoming events yet. Ask me to show available events.',
    scheduleTitle: 'Your upcoming events',
    nextEventTitle: 'Your next event',
    subscribedToCategory: (category) => `Subscribed to the latest events in the "${category}" category.`,
    categoryNotFound: 'I could not find events in that category. Try another one.',
    categoryNotRecognized: 'Please specify a supported category (lecture, meeting, workshop, deadline).',
    reminderScheduled: (title, date) => `Reminder scheduled for "${title}" at ${date}.`,
    help: 'Try commands like "Show my schedule", "Subscribe to category lecture", or "Remind me about next event".'
  },
  ru: {
    greeting: 'Привет! Я помогу вам не забывать о событиях. Выберите действие:',
    options: ['Показать расписание', 'Подписаться на категорию', 'Напомни о следующем событии'],
    noEvents: 'У вас пока нет предстоящих событий. Попросите показать доступные события.',
    scheduleTitle: 'Ваши ближайшие события',
    nextEventTitle: 'Следующее событие',
    subscribedToCategory: (category) => `Вы подписаны на события категории «${category}».`,
    categoryNotFound: 'Мне не удалось найти события в этой категории. Попробуйте другую.',
    categoryNotRecognized: 'Укажите поддерживаемую категорию (лекция, встреча, воркшоп, дедлайн).',
    reminderScheduled: (title, date) => `Напоминание для «${title}» запланировано на ${date}.`,
    help: 'Попробуйте команды: «Показать расписание», «Подписаться на категорию лекции», «Напомни о следующем событии».'
  }
};

const CATEGORY_ALIASES = {
  lecture: ['lecture', 'lectures', 'лекция', 'лекции'],
  meeting: ['meeting', 'meetings', 'встреча', 'встречи', 'совещание'],
  workshop: ['workshop', 'workshops', 'семинар', 'воркшоп'],
  deadline: ['deadline', 'deadlines', 'дедлайн', 'срок'],
  other: ['other', 'другое']
};

const normalizeLocale = (locale) => {
  if (!locale) {
    return config.defaultLocale;
  }

  const lower = locale.toLowerCase();
  return config.supportedLocales.includes(lower) ? lower : config.defaultLocale;
};

const detectIntent = (text) => {
  if (!text) return 'help';
  const normalized = text.trim().toLowerCase();

  const intents = [
    { key: 'show_schedule', patterns: ['show my schedule', 'показать расписание', 'покажи расписание'] },
    { key: 'subscribe_category', patterns: ['subscribe to category', 'подписаться на категорию', 'подпишись на категорию'] },
    { key: 'remind_next', patterns: ['remind me about next event', 'напомни о следующем событии', 'напомни о следующем'] }
  ];

  const intent = intents.find(({ patterns }) => patterns.some((pattern) => normalized.startsWith(pattern)));
  return intent ? intent.key : 'help';
};

const extractCategory = (text) => {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  const parts = normalized.split(/\s+/);
  const subscribeIndex = parts.findIndex((part) => ['category', 'категорию', 'категории'].includes(part));
  if (subscribeIndex >= 0 && subscribeIndex + 1 < parts.length) {
    return parts.slice(subscribeIndex + 1).join(' ');
  }
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

const normalizeCategory = (rawCategory) => {
  if (!rawCategory) return null;
  const normalized = rawCategory.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return null;
};

const localizeCategory = (category, locale) => {
  if (locale === 'ru') {
    switch (category) {
      case 'lecture':
        return 'лекция';
      case 'meeting':
        return 'встреча';
      case 'workshop':
        return 'воркшоп';
      case 'deadline':
        return 'дедлайн';
      default:
        return 'другое';
    }
  }
  return category;
};

const formatDateTime = (date, locale) => {
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: config.timezone
    }).format(new Date(date));
  } catch (error) {
    logger.warn('Failed to format date, using ISO string', { error: error.message });
    return new Date(date).toISOString();
  }
};

const buildStructuredMessage = (locale, title, bodyLines, actions = []) => ({
  type: 'structured',
  locale,
  content: {
    type: 'card',
    version: '1.0',
    header: title,
    body: bodyLines.map((text) => ({
      type: 'text',
      text
    })),
    actions: actions.map((action) => ({
      type: 'reply',
      title: action,
      payload: action
    }))
  }
});

const sendMessage = async ({ user, chatId, message, eventId = null }) => {
  const response = await maxPlatformAdapter.sendMessage({
    chatId: chatId || user.maxChatId,
    message
  });

  await dataSource.recordMessageLog({
    userId: user.id,
    eventId,
    direction: 'outgoing',
    payload: message,
    statusCode: response.status
  });

  return response;
};

const handleShowSchedule = async ({ user, locale, chatId }) => {
  const events = await dataSource.getEventsForUser(user.id);
  const dictionary = COPY[locale];

  if (events.length === 0) {
    const fallbackEvents = await dataSource.listUpcomingEvents({ organization: config.orgName, limit: 5 });
    const body = fallbackEvents.length
      ? fallbackEvents.map((event) => `• ${event.title} — ${formatDateTime(event.startTime, locale)}`).join('\n')
      : dictionary.noEvents;

    const message = buildStructuredMessage(locale, dictionary.scheduleTitle, [body], dictionary.options);
    await sendMessage({ user, chatId, message });
    return;
  }

  const bodyLines = events.map((event) => `${event.title} — ${formatDateTime(event.startTime, locale)} (${event.location || 'Online'})`);
  const message = buildStructuredMessage(locale, dictionary.scheduleTitle, bodyLines, dictionary.options);
  await sendMessage({ user, chatId, message });
};

const handleSubscribeCategory = async ({ user, locale, chatId, text }) => {
  const dictionary = COPY[locale];
  const categoryInput = extractCategory(text);
  const normalizedCategory = normalizeCategory(categoryInput);

  if (!normalizedCategory) {
    const available = await dataSource.getAvailableCategories();
    const message = buildStructuredMessage(
      locale,
      dictionary.scheduleTitle,
      [
        dictionary.categoryNotRecognized,
        `Available categories: ${available.map((cat) => localizeCategory(cat, locale)).join(', ')}`
      ],
      dictionary.options
    );
    await sendMessage({ user, chatId, message });
    return;
  }

  const subscriptions = await dataSource.subscribeUserToCategory(user.id, normalizedCategory);
  if (!subscriptions || subscriptions.length === 0) {
    const message = buildStructuredMessage(locale, dictionary.scheduleTitle, [dictionary.categoryNotFound], dictionary.options);
    await sendMessage({ user, chatId, message });
    return;
  }

  const formattedDate = formatDateTime(subscriptions[0].startTime, locale);
  const message = buildStructuredMessage(
    locale,
    dictionary.scheduleTitle,
    [dictionary.subscribedToCategory(localizeCategory(normalizedCategory, locale)), dictionary.reminderScheduled(subscriptions[0].title, formattedDate)],
    dictionary.options
  );
  await sendMessage({ user, chatId, message, eventId: subscriptions[0].id });
};

const handleRemindNext = async ({ user, locale, chatId }) => {
  const dictionary = COPY[locale];
  const event = await dataSource.getNextEventForUser(user.id);

  if (!event) {
    const message = buildStructuredMessage(locale, dictionary.nextEventTitle, [dictionary.noEvents], dictionary.options);
    await sendMessage({ user, chatId, message });
    return;
  }

  await reminders.scheduleImmediateReminder(user, event);

  const formattedDate = formatDateTime(event.startTime, locale);
  const message = buildStructuredMessage(
    locale,
    dictionary.nextEventTitle,
    [`${event.title} — ${formattedDate}`, event.location ? `Location: ${event.location}` : ''],
    dictionary.options
  );
  await sendMessage({ user, chatId, message, eventId: event.id });
};

const handleHelp = async ({ user, locale, chatId }) => {
  const dictionary = COPY[locale];
  const message = buildStructuredMessage(locale, dictionary.scheduleTitle, [dictionary.greeting, dictionary.help], dictionary.options);
  await sendMessage({ user, chatId, message });
};

const processIncomingMessage = async (incoming) => {
  const { message = {}, user: maxUser = {} } = incoming;
  const text = message.text || '';
  const locale = normalizeLocale(maxUser.locale);

  if (!maxUser.id && !message.userId) {
    throw new Error('MAX payload must include a user identifier');
  }

  const user = await dataSource.getOrCreateUser({
    maxUserId: maxUser.id || message.userId,
    maxChatId: message.chatId,
    displayName: maxUser.displayName || maxUser.name,
    email: maxUser.email,
    role: maxUser.role || 'student',
    locale
  });

  await dataSource.recordMessageLog({
    userId: user.id,
    direction: 'incoming',
    payload: incoming
  });

  const intent = detectIntent(text);
  logger.info('Processing incoming command', { intent, text, userId: user.id });

  switch (intent) {
    case 'show_schedule':
      await handleShowSchedule({ user, locale, chatId: message.chatId });
      break;
    case 'subscribe_category':
      await handleSubscribeCategory({ user, locale, chatId: message.chatId, text });
      break;
    case 'remind_next':
      await handleRemindNext({ user, locale, chatId: message.chatId });
      break;
    default:
      await handleHelp({ user, locale, chatId: message.chatId });
      break;
  }

  return { success: true };
};

const sendScheduleToUser = async ({ maxUserId, chatId }) => {
  const user = await dataSource.getOrCreateUser({ maxUserId, maxChatId: chatId });
  const locale = normalizeLocale(user.locale);
  await handleShowSchedule({ user, locale, chatId });
};

const remindNextEventForUser = async ({ maxUserId, chatId }) => {
  const user = await dataSource.getOrCreateUser({ maxUserId, maxChatId: chatId });
  const locale = normalizeLocale(user.locale);
  await handleRemindNext({ user, locale, chatId });
};

module.exports = {
  processIncomingMessage,
  sendScheduleToUser,
  remindNextEventForUser
};

