const { Sequelize, DataTypes } = require('sequelize');
const config = require('../utils/config');
const logger = require('../utils/logger');
const defineUserModel = require('../models/userModel');
const defineEventModel = require('../models/eventModel');
const defineOrganizationModel = require('../models/organizationModel');

const sequelize = new Sequelize(config.dbUrl, {
  logging: config.env === 'production' ? false : (msg) => logger.debug(msg),
  dialectOptions: config.dbUrl.startsWith('sqlite')
    ? {
        timezone: 'Etc/UTC'
      }
    : {}
});

const User = defineUserModel(sequelize);
const Organization = defineOrganizationModel(sequelize);
const Event = defineEventModel(sequelize);

const Subscription = sequelize.define('Subscription', {
  status: {
    type: DataTypes.ENUM('invited', 'accepted', 'declined'),
    defaultValue: 'invited'
  },
  locale: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: config.defaultLocale
  },
  lastReminderAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

const MessageLog = sequelize.define('MessageLog', {
  direction: {
    type: DataTypes.ENUM('incoming', 'outgoing'),
    allowNull: false
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false
  },
  statusCode: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

const ReminderPreference = sequelize.define('ReminderPreference', {
  leadMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: config.reminderLeadMinutes
  },
  channels: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: ['max']
  }
});

User.hasMany(Subscription, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
Subscription.belongsTo(User);

Event.hasMany(Subscription, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
Subscription.belongsTo(Event);

Organization.hasMany(Event, { foreignKey: { allowNull: true }, onDelete: 'SET NULL' });
Event.belongsTo(Organization, { foreignKey: { allowNull: true } });

User.hasMany(MessageLog, { foreignKey: { allowNull: true } });
MessageLog.belongsTo(User);

Event.hasMany(MessageLog, { foreignKey: { allowNull: true } });
MessageLog.belongsTo(Event);

User.hasOne(ReminderPreference, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
ReminderPreference.belongsTo(User);

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    const syncOptions = config.env === 'production'
      ? {}
      : { alter: true };
    await sequelize.sync(syncOptions);
    logger.info('Database connection established and models synchronized');
  } catch (error) {
    logger.error('Unable to initialize database', { error: error.message });
    throw error;
  }
};

module.exports = {
  sequelize,
  initDatabase,
  models: {
    User,
    Event,
    Organization,
    Subscription,
    MessageLog,
    ReminderPreference
  }
};

