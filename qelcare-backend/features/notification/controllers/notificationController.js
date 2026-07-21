const Notification = require("../models/Notification");

const notificationController = {
  async getMine(req, res) {
    try {
      const rows = await Notification.findForUser(req.user.user_id, {
        unread_only: String(req.query.unread_only || "").toLowerCase() === "true",
        limit: req.query.limit,
      });
      const unread_count = await Notification.unreadCount(req.user.user_id);
      res.json({
        success: true,
        data: rows,
        notifications: rows,
        unread_count,
      });
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch notifications." });
    }
  },

  async markRead(req, res) {
    try {
      const notification = await Notification.markRead({
        id: req.params.id,
        user_id: req.user.user_id,
      });

      if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found." });
      }

      const unread_count = await Notification.unreadCount(req.user.user_id);
      res.json({
        success: true,
        message: "Notification marked as read.",
        data: notification,
        notification,
        unread_count,
      });
    } catch (err) {
      console.error("Mark notification read error:", err);
      res.status(500).json({ success: false, message: "Failed to update notification." });
    }
  },

  async markAllRead(req, res) {
    try {
      const updated = await Notification.markAllRead(req.user.user_id);
      res.json({
        success: true,
        message: "Notifications marked as read.",
        updated,
        unread_count: 0,
      });
    } catch (err) {
      console.error("Mark all notifications read error:", err);
      res.status(500).json({ success: false, message: "Failed to update notifications." });
    }
  },
};

module.exports = notificationController;
