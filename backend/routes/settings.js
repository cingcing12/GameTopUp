const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { requireAdmin } = require('../middleware/auth');

const DEFAULT_SETTINGS = {
  telegramUsername: 'pheak_topup',
  telegramEnabled: true
};

// GET /api/settings (Public - used by frontend to display Telegram button)
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find({});
    const settingsMap = { ...DEFAULT_SETTINGS };

    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings', ...DEFAULT_SETTINGS });
  }
});

// PUT /api/settings (Admin only - update settings)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const updatedSettings = {};

    for (const [key, value] of Object.entries(updates)) {
      const setting = await Setting.findOneAndUpdate(
        { key },
        { key, value, updatedAt: Date.now() },
        { upsert: true, new: true }
      );
      updatedSettings[key] = setting.value;
    }

    res.json({ message: 'Settings updated successfully', settings: updatedSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ message: 'Error saving settings' });
  }
});

module.exports = router;
