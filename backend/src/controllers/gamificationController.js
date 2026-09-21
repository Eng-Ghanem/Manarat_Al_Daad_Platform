const supabaseAdmin = require('../lib/supabaseAdmin');

// Allowed action types and their maximum reasonable limits to prevent tampering
const MAX_XP_PER_AWARD = 150;

/**
 * @desc    Award XP points securely to an authenticated student
 * @route   POST /api/gamification/award-xp
 * @access  Private (Authenticated users)
 */
const awardXpHandler = async (req, res) => {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const { userId, amount, reason, link } = req.body;

    // 1. Validate Target User
    const targetUserId = userId || callerId;
    
    // Students can ONLY award XP to themselves (e.g. on finishing a lesson or quiz)
    if (callerRole !== 'admin' && callerRole !== 'teacher' && targetUserId !== callerId) {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح: لا يمكن منح نقاط لمستخدم آخر' 
      });
    }

    // 2. Validate Amount
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'قيمة النقاط غير صالحة' 
      });
    }

    if (parsedAmount > MAX_XP_PER_AWARD && callerRole !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        error: `لا يمكن إضافة أكثر من ${MAX_XP_PER_AWARD} نقطة في المرة الواحدة` 
      });
    }

    // 3. Fetch Target User Profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, xp_points, role, full_name')
      .eq('id', targetUserId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'الملف الشخصي للطالب غير موجود' 
      });
    }

    // Admins and Teachers should never accumulate student XP
    if (profile.role === 'admin' || profile.role === 'teacher') {
      return res.json({ 
        success: true, 
        message: 'تم التخطي: لا يتم احتساب نقاط للمشرفين أو المعلمين',
        xp_points: 0 
      });
    }

    // 4. Calculate new XP
    const currentXp = Number(profile.xp_points) || 0;
    const newXp = currentXp + parsedAmount;

    // 5. Update DB using supabaseAdmin (Service role bypasses RLS and triggers safely)
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ xp_points: newXp })
      .eq('id', targetUserId);

    if (updateErr) {
      console.error('Error updating XP in database:', updateErr);
      return res.status(500).json({ 
        success: false, 
        error: 'فشل تحديث نقاط الطالب في قاعدة البيانات' 
      });
    }

    // 6. Send in-app notification to student
    try {
      const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 100) : '';
      const notifPayload = {
        user_id: targetUserId,
        title: '🎉 نقاط تميز جديدة!',
        message: `مبروك! حصلت على +${parsedAmount} نقطة XP ${sanitizedReason ? `مقابل ${sanitizedReason}` : ''}. إجمالي رصيدك الآن ${newXp} نقطة!`,
        type: 'xp_reward',
        link: link || '/dashboard',
        is_read: false,
        created_at: new Date().toISOString()
      };

      await supabaseAdmin.from('notifications').insert([notifPayload]);
    } catch (notifErr) {
      console.warn('Optional XP notification insert failed:', notifErr.message);
    }

    return res.json({
      success: true,
      xp_points: newXp,
      delta: parsedAmount,
      message: 'تم إضافة نقاط التميز بنجاح'
    });

  } catch (error) {
    console.error('Error in awardXpHandler:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في الخادم أثناء إضافة النقاط' 
    });
  }
};

module.exports = {
  awardXpHandler
};
