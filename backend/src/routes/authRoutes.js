const express = require('express');
const { lookupEmailByPhone } = require('../controllers/authController');

const router = express.Router();

// Route: POST /api/auth/lookup-email
router.post('/lookup-email', lookupEmailByPhone);

module.exports = router;
