const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { awardXpHandler } = require('../controllers/gamificationController');
const { getGamificationRulesHandler } = require('../controllers/adminController');

const router = express.Router();

// Public: Get rules
router.get('/rules', getGamificationRulesHandler);

// Protected: Secure XP awarding
router.post('/award-xp', protect, awardXpHandler);

module.exports = router;
