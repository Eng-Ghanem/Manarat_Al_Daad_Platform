const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const { getDashboardStats } = require('../controllers/adminController');

const router = express.Router();

// Apply protect and adminOnly middlewares to all routes in this file
router.use(protect);
router.use(adminOnly);

// Route: GET /api/admin/stats
router.get('/stats', getDashboardStats);

module.exports = router;
