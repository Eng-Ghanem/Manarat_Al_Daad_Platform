const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const { 
  getDashboardStats, 
  updateSubscriptionStatus, 
  extendSubscription,
  syncExpiredSubscriptionsHandler,
  deleteSubscription, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  adjustStudentXp,
  updateGamificationRulesHandler
} = require('../controllers/adminController');

const router = express.Router();

// Apply protect and adminOnly middlewares to all routes in this file
router.use(protect);
router.use(adminOnly);

// Route: GET /api/admin/stats
router.get('/stats', getDashboardStats);

// Route: POST /api/admin/subscriptions/sync-expired
router.post('/subscriptions/sync-expired', syncExpiredSubscriptionsHandler);

// Route: PUT /api/admin/subscriptions/:id
router.put('/subscriptions/:id', updateSubscriptionStatus);

// Route: POST /api/admin/subscriptions/:id/extend
router.post('/subscriptions/:id/extend', extendSubscription);

// Route: DELETE /api/admin/subscriptions/:id
router.delete('/subscriptions/:id', deleteSubscription);

// Route: POST /api/admin/students
router.post('/students', createStudent);

// Route: PUT /api/admin/students/:id
router.put('/students/:id', updateStudent);

// Route: DELETE /api/admin/students/:id
router.delete('/students/:id', deleteStudent);

// Route: POST /api/admin/students/:id/adjust-xp
router.post('/students/:id/adjust-xp', adjustStudentXp);

// Route: POST /api/admin/gamification/rules
router.post('/gamification/rules', updateGamificationRulesHandler);

module.exports = router;
