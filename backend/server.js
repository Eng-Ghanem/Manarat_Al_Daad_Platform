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
const { getGamificationRulesHandler } = require('./src/controllers/adminController');

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/quizzes', quizRoutes);
app.get('/api/gamification/rules', getGamificationRulesHandler);

// Mention Notifications Dispatcher (Service Role Bypasses RLS)
app.post('/api/chat/mention-notify', async (req, res) => {
  try {
    const { mentionedUserIds, senderName, senderId, messageSnippet, isRTL } = req.body;
    if (!mentionedUserIds || !Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No mentioned users provided' });
    }

    const supabaseAdmin = require('./src/lib/supabaseAdmin');
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Supabase admin client not available' });
    }

    const notificationsToInsert = mentionedUserIds
      .filter(id => id && id !== senderId)
      .map(userId => ({
        user_id: userId,
        title: isRTL ? 'إشارة في المحادثة' : 'Mention in Chat',
        message: isRTL 
          ? `قام ${senderName || 'أحد الأعضاء'} بالإشارة إليك في المحادثة: "${(messageSnippet || '').slice(0, 60)}"`
          : `${senderName || 'Someone'} mentioned you in the chat: "${(messageSnippet || '').slice(0, 60)}"`,
        type: 'chat_mention',
        link: '/chat'
      }));

    if (notificationsToInsert.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert);
      if (error) {
        console.error('Error inserting mention notifications via supabaseAdmin:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    return res.json({ success: true, count: notificationsToInsert.length });
  } catch (err) {
    console.error('Mention notify error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Test Route
app.get('/', (req, res) => {
  res.send('مرحباً بك في الخادم الخلفي لمنصة مَنَارَةُ الضَّادِ!');
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
