const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Event', {
    externalId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM('lecture', 'seminar', 'meeting', 'workshop', 'deadline', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  });

