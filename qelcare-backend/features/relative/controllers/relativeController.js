const Relative = require("../models/Relative");

module.exports = {
  async list(req, res) {
    try {
      const relatives = await Relative.listByOwner(req.user.user_id);
      res.json({ success: true, data: relatives, relatives });
    } catch (err) {
      console.error("List relatives error:", err);
      res.status(500).json({ success: false, message: "Failed to load saved relatives." });
    }
  },

  async create(req, res) {
    try {
      const relative = await Relative.create(req.user.user_id, req.body);
      res.status(201).json({ success: true, message: "Relative saved.", data: relative, relative });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Create relative error:", err);
      res.status(500).json({ success: false, message: "Failed to save relative." });
    }
  },

  async update(req, res) {
    try {
      const relative = await Relative.updateOwned(req.params.id, req.user.user_id, req.body);
      if (!relative) return res.status(404).json({ success: false, message: "Relative not found." });
      res.json({ success: true, message: "Relative updated.", data: relative, relative });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      console.error("Update relative error:", err);
      res.status(500).json({ success: false, message: "Failed to update relative." });
    }
  },

  async remove(req, res) {
    try {
      const deleted = await Relative.deleteOwned(req.params.id, req.user.user_id);
      if (!deleted) return res.status(404).json({ success: false, message: "Relative not found." });
      res.json({ success: true, message: "Relative removed." });
    } catch (err) {
      console.error("Delete relative error:", err);
      res.status(500).json({ success: false, message: "Failed to remove relative." });
    }
  },
};
