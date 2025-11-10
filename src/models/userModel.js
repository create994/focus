const { DataTypes } = require('sequelize');
const config = require('../utils/config');

module.exports = (sequelize) =>
  sequelize.define('User', {
    maxUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    maxChatId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('student', 'employee', 'it-specialist'),
      allowNull: false,
      defaultValue: 'student'
    },
    locale: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: config.defaultLocale
    }
  });

