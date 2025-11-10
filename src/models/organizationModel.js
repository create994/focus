const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Organization', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.ENUM('education', 'corporate', 'performing-arts', 'healthcare', 'government', 'community', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    defaultLocale: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'en'
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UTC'
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  });

