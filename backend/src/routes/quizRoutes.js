const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const supabaseAdmin = require('../lib/supabaseAdmin');

const router = express.Router();

// GET /api/quizzes/counts
// Returns question counts for all quizzes (safe public summary, bypasses RLS)
router.get('/counts', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .select('quiz_id');

    if (error) throw error;

    const counts = {};
    (data || []).forEach(item => {
      if (item.quiz_id) {
        counts[item.quiz_id] = (counts[item.quiz_id] || 0) + 1;
      }
    });

    return res.json({ success: true, counts });
  } catch (error) {
    console.error('Error fetching quiz counts:', error);
    return res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /api/quizzes/:id/review
// Secure endpoint: Returns questions with correct options ONLY if student has already submitted this quiz (or is staff)
router.get('/:id/review', protect, async (req, res) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'teacher';

    if (!isStaff) {
      // Ensure student actually submitted this quiz
      const { data: submission, error: sErr } = await supabaseAdmin
        .from('quiz_submissions')
        .select('id')
        .eq('quiz_id', quizId)
        .eq('student_id', userId)
        .single();

      if (sErr || !submission) {
        return res.status(403).json({ error: 'غير مصرح: لا يمكنك مراجعة الأسئلة قبل تسليم الامتحان.' });
      }
    }

    // Fetch full questions for review
    const { data: questions, error: qErr } = await supabaseAdmin
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true });

    if (qErr) throw qErr;

    return res.json({ success: true, questions: questions || [] });
  } catch (error) {
    console.error('Error in quiz review endpoint:', error);
    return res.status(500).json({ error: 'Failed to load quiz review' });
  }
});

module.exports = router;
