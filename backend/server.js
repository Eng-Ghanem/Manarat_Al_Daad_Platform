require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const port = process.env.PORT || 5000;

// Security: Hide server technology stack
app.disable('x-powered-by');

// Security: HTTP Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable CSP header on API server to prevent breaking frontend iframe/video integrations
}));

// Security: Body parser limit to prevent Memory Exhaustion DoS
app.use(express.json({ limit: '50kb' }));

// Security: CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Security: Global Rate Limiter for all APIs
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار والمحاولة لاحقاً.' }
});
app.use('/api', globalLimiter);

// Security: Strict Rate Limiter for Authentication & Lookup Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // max 15 requests per 15 minutes to prevent brute force & enumeration
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'تم تجاوز حد محاولات التحقق. يرجى المحاولة بعد 15 دقيقة.' }
});

const adminRoutes = require('./src/routes/adminRoutes');
const authRoutes = require('./src/routes/authRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const gamificationRoutes = require('./src/routes/gamificationRoutes');
const { protect } = require('./src/middlewares/authMiddleware');

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/gamification', gamificationRoutes);

// Secure Mention Notifications Dispatcher (Requires Authentication)
app.post('/api/chat/mention-notify', protect, async (req, res) => {
  try {
    const { mentionedUserIds, senderName, messageSnippet, isRTL } = req.body;
    
    // Sender identity is strictly bound to the authenticated JWT token to prevent spoofing
    const senderId = req.user.id;

    if (!mentionedUserIds || !Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No mentioned users provided' });
    }

    // Rate / Payload limit: Maximum 20 mentions per single message to prevent notification flooding
    const safeMentionIds = mentionedUserIds
      .filter(id => id && typeof id === 'string' && id !== senderId)
      .slice(0, 20);

    if (safeMentionIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const supabaseAdmin = require('./src/lib/supabaseAdmin');
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Supabase admin client not available' });
    }

    const safeSenderName = typeof senderName === 'string' && senderName.trim()
      ? senderName.trim().slice(0, 50)
      : 'أحد الأعضاء';

    const cleanSnippet = typeof messageSnippet === 'string'
      ? messageSnippet.trim().slice(0, 70)
      : '';

    const notificationsToInsert = safeMentionIds.map(userId => ({
      user_id: userId,
      title: isRTL ? 'إشارة في المحادثة' : 'Mention in Chat',
      message: isRTL 
        ? `قام ${safeSenderName} بالإشارة إليك في المحادثة: "${cleanSnippet}"`
        : `${safeSenderName} mentioned you in the chat: "${cleanSnippet}"`,
      type: 'chat_mention',
      link: '/chat'
    }));

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationsToInsert);

    if (error) {
      console.error('Error inserting mention notifications:', error);
      return res.status(500).json({ success: false, error: 'فشل إرسال الإشعارات' });
    }

    return res.json({ success: true, count: notificationsToInsert.length });
  } catch (err) {
    console.error('Mention notify error:', err);
    return res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// Test / Health Route
app.get('/', (req, res) => {
  res.send('مرحباً بك في الخادم الخلفي لمنصة مَنَارَةُ الضَّادِ!');
});

// Central 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'المسار غير موجود' });
});

// Central Error Handler (Avoids leaking stack traces in production)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'حدث خطأ غير متوقع في الخادم' : err.message 
  });
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

