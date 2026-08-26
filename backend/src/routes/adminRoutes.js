const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const { getDashboardStats, updateSubscriptionStatus, deleteSubscription, createStudent, updateStudent, deleteStudent } = require('../controllers/adminController');

const router = express.Router();

// Apply protect and adminOnly middlewares to all routes in this file
router.use(protect);
router.use(adminOnly);

// Route: GET /api/admin/stats
router.get('/stats', getDashboardStats);

// Route: PUT /api/admin/subscriptions/:id
router.put('/subscriptions/:id', updateSubscriptionStatus);

// Route: DELETE /api/admin/subscriptions/:id
router.delete('/subscriptions/:id', deleteSubscription);

// Route: POST /api/admin/students
router.post('/students', createStudent);

// Route: PUT /api/admin/students/:id
router.put('/students/:id', updateStudent);

// Route: DELETE /api/admin/students/:id
router.delete('/students/:id', deleteStudent);

module.exports = router;
