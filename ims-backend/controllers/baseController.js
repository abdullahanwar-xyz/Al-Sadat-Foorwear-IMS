class BaseController {
  constructor(model) {
    this.model = model;
  }

  // Get all records
  async getAll(req, res) {
    try {
      const items = await this.model.findAll();
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  // Get a single record by ID
  async getById(req, res) {
    try {
      const item = await this.model.findByPk(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  // Create a new record
  async create(req, res) {
    try {
      const item = await this.model.create(req.body);
      return res.status(201).json(item);
    } catch (error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  // Update a record
  async update(req, res) {
    try {
      const [updated] = await this.model.update(req.body, {
        where: { id: req.params.id }
      });
      if (!updated) {
        return res.status(404).json({ message: 'Item not found' });
      }
      const updatedItem = await this.model.findByPk(req.params.id);
      return res.status(200).json(updatedItem);
    } catch (error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: error.message });
    }
  }

  // Delete a record
  async delete(req, res) {
    try {
      const deleted = await this.model.destroy({
        where: { id: req.params.id }
      });
      if (!deleted) {
        return res.status(404).json({ message: 'Item not found' });
      }
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
}

module.exports = BaseController;
