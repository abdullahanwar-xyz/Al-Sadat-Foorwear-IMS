const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// The manageable list behind the Online Orders source combobox. Plain,
// standalone rows - Invoice.source/OnlineOrder.source store the chosen
// value as free text (not a FK), so removing a source here never touches
// any existing invoice's already-recorded value, only what's offered going
// forward.
const OnlineOrderSource = sequelize.define('OnlineOrderSource', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  value: { type: DataTypes.STRING(50), allowNull: false, unique: true },
}, {
  tableName: 'online_order_sources',
  timestamps: true,
});

module.exports = OnlineOrderSource;
