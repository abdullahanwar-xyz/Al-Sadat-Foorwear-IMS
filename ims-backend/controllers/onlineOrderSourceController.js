const OnlineOrderSource = require('../models/OnlineOrderSource');

class OnlineOrderSourceController {
  // Any signed-in staff member can list them (needed for the combobox
  // during order placement).
  getAll = async (req, res) => {
    try {
      const sources = await OnlineOrderSource.findAll({ order: [['value', 'ASC']] });
      return res.status(200).json(sources);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };

  // Self-service, same as the Collection combobox's "+ Add new" - any staff
  // member placing an order can introduce a new channel name on the fly.
  create = async (req, res) => {
    try {
      const { value } = req.body;
      const trimmed = (value || '').trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Source value is required' });
      }

      const existing = await OnlineOrderSource.findAll();
      const duplicate = existing.find((s) => s.value.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) {
        return res.status(200).json(duplicate);
      }

      const created = await OnlineOrderSource.create({ value: trimmed });
      return res.status(201).json(created);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const existing = await OnlineOrderSource.findOne({ where: { value: (req.body.value || '').trim() } });
        if (existing) return res.status(200).json(existing);
      }
      return res.status(500).json({ message: error.message });
    }
  };

  // Admin only (see routes) - removes it from the selectable list. Existing
  // invoices already created with this value are untouched, since
  // Invoice.source/OnlineOrder.source are plain strings, not a FK to this
  // table.
  delete = async (req, res) => {
    try {
      const { id } = req.params;
      const source = await OnlineOrderSource.findByPk(id);
      if (!source) {
        return res.status(404).json({ message: 'Source not found' });
      }
      await source.destroy();
      return res.status(200).json({ message: 'Source removed' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new OnlineOrderSourceController();
