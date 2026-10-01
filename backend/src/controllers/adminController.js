const supabaseAdmin = require('../lib/supabaseAdmin');

// @desc    Get stats for admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Example: Count total users
    const { count: usersCount, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    if (usersError) throw usersError;

    // We can add more stats later (courses count, etc.)
    
    res.json({
      success: true,
      data: {
        totalUsers: usersCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Update subscription status
// Helper to sync expired subscriptions
const syncExpiredSubscriptions = async () => {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, course_id, created_at, status, courses(access_duration_days)')
      .eq('status', 'active');

    if (error || !subs) return;

    const now = new Date();
    const expiredIds = [];

    for (const sub of subs) {
      const duration = sub.courses?.access_duration_days;
      if (duration) {
        const createdDate = new Date(sub.created_at);
        const expiryDate = new Date(createdDate.getTime() + duration * 24 * 60 * 60 * 1000);
        if (now > expiryDate) {
          expiredIds.push(sub.id);
        }
      }
    }

    if (expiredIds.length > 0) {
      // Try updating status to 'expired'
      try {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .in('id', expiredIds);
      } catch (err) {
        console.warn('Could not update status to expired (constraint might need update):', err.message);
      }
    }
  } catch (err) {
    console.error('Error syncing expired subscriptions:', err);
  }
};

// @desc    Update subscription status
// @route   PUT /api/admin/subscriptions/:id
// @access  Private/Admin
const updateSubscriptionStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // If activating, check if course has access_duration_days to set expires_at
    let updatePayload = { status };

    if (status === 'active') {
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('course_id, created_at, courses(access_duration_days)')
        .eq('id', id)
        .single();

      if (currentSub?.courses?.access_duration_days) {
        const duration = currentSub.courses.access_duration_days;
        const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();
        // Try including expires_at
        try {
          const { data, error } = await supabaseAdmin
            .from('subscriptions')
            .update({ status, expires_at: expiresAt, created_at: new Date().toISOString() })
            .eq('id', id)
            .select();

          if (!error && data && data.length > 0) {
            return res.json({ success: true, data: data[0] });
          }
        } catch (colErr) {
          // If expires_at column does not exist yet, fallback to status only
          console.warn('expires_at column might not exist yet, falling back to standard update');
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Extend or Renew a subscription
// @route   POST /api/admin/subscriptions/:id/extend
// @access  Private/Admin
const extendSubscription = async (req, res) => {
  const { id } = req.params;
  const { days } = req.body; // number of additional days

  try {
    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*, courses(access_duration_days)')
      .eq('id', id)
      .single();

    if (subError || !sub) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const durationDays = Number(days) || sub.courses?.access_duration_days || 30;
    const newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    let updateData = {
      status: 'active',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ ...updateData, expires_at: newExpiresAt })
        .eq('id', id)
        .select();

      if (!error && data && data.length > 0) {
        return res.json({ success: true, data: data[0], message: `تم تمديد الاشتراك بنجاح لمدة ${durationDays} يوم.` });
      }
    } catch (e) {
      // fallback
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;

    res.json({ success: true, data: data[0], message: `تم تمديد الاشتراك بنجاح لمدة ${durationDays} يوم.` });
  } catch (error) {
    console.error('Error extending subscription:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Sync and auto-expire all subscriptions
// @route   POST /api/admin/subscriptions/sync-expired
// @access  Private/Admin
const syncExpiredSubscriptionsHandler = async (req, res) => {
  try {
    await syncExpiredSubscriptions();
    res.json({ success: true, message: 'Subscriptions synced successfully' });
  } catch (error) {
    console.error('Error in syncExpiredSubscriptionsHandler:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Delete a subscription
// @route   DELETE /api/admin/subscriptions/:id
// @access  Private/Admin
const deleteSubscription = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Create a new student
// @route   POST /api/admin/students
// @access  Private/Admin
const createStudent = async (req, res) => {
  const { email, password, full_name, phone_number, grade_level } = req.body;

  try {
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone_number, grade_level: grade_level || null }
    });

    if (authError) throw authError;

    // Ensure the profile has phone_number, full_name, and grade_level
    if (user?.user?.id) {
      const updateData = {};
      if (grade_level) updateData.grade_level = grade_level;
      if (phone_number) updateData.phone_number = phone_number;
      if (full_name) updateData.full_name = full_name;

      if (Object.keys(updateData).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', user.user.id);
          
        if (profileError) {
          console.error('Failed to update student profile data:', profileError);
        }
      }
    }

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
};

// @desc    Delete a student
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'تعذر الاتصال بـ Supabase Admin Service' });
    }

    // 1. First try using the database RPC function (atomic & clean)
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('admin_delete_student', {
        p_student_id: id
      });
      if (!rpcError && (rpcData?.success || rpcData === true)) {
        return res.json({ success: true, message: 'Student deleted successfully via database RPC' });
      }
    } catch (rpcErr) {
      console.warn('admin_delete_student RPC failed or not installed, falling back to manual cleanup:', rpcErr.message);
    }

    // 2. Fallback: Clean up dependent records across all tables to prevent FK constraint violations
    try {
      await supabaseAdmin.from('student_reviews').delete().eq('user_id', id);
      await supabaseAdmin.from('subscriptions').delete().eq('user_id', id);
      await supabaseAdmin.from('quiz_submissions').delete().eq('student_id', id);
      await supabaseAdmin.from('lesson_progress').delete().eq('user_id', id);
      await supabaseAdmin.from('enrollments').delete().eq('user_id', id);
      await supabaseAdmin.from('notifications').delete().eq('user_id', id);
      await supabaseAdmin.from('gamification_logs').delete().eq('user_id', id);
      await supabaseAdmin.from('chat_messages').update({ deleted_by: null }).eq('deleted_by', id);
      await supabaseAdmin.from('chat_messages').delete().eq('sender_id', id);
    } catch (cleanErr) {
      console.warn('Non-critical cleanup warning during student deletion:', cleanErr.message);
    }

    // 3. Delete from public profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.warn('Profile deletion warning:', profileError.message);
    }

    // 4. Delete user from Supabase Auth system
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError && !authError.message?.toLowerCase().includes('not found')) {
      throw authError;
    }

    res.json({ success: true, message: 'تم مسح الطالب وبياناته بالكامل بنجاح' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
};

// @desc    Update a student
// @route   PUT /api/admin/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { email, password, full_name, phone_number, grade_level } = req.body;

  try {
    // 1. Update Auth User (email, password, user_metadata)
    const updateData = {
      email,
      user_metadata: { full_name, phone: phone_number, grade_level: grade_level || null }
    };
    if (password) {
      updateData.password = password;
    }

    const { data: user, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);

    if (authError) throw authError;

    // 2. Update Public Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email,
        full_name,
        phone_number,
        grade_level: grade_level || null
      })
      .eq('id', id);

    if (profileError) {
      console.error('Failed to update student profile:', profileError);
      throw profileError;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, error: error.message || 'Server Error' });
  }
};

// @desc    Adjust student XP points (Grant / Deduct)
// @route   POST /api/admin/students/:id/adjust-xp
// @access  Private/Admin
const adjustStudentXp = async (req, res) => {
  const { id } = req.params;
  const { amount, type, delta, newXp, reason } = req.body;

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'تعذر الاتصال بـ Supabase Admin Service' });
    }

    // 1. Verify student exists and get current XP
    const { data: student, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, xp_points')
      .eq('id', id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ success: false, error: 'الطالب غير موجود أو تم حذفه' });
    }

    const currentXp = Number(student.xp_points) || 0;
    let finalXp;

    if (newXp !== undefined && !isNaN(Number(newXp))) {
      finalXp = Math.max(0, Math.round(Number(newXp)));
    } else {
      let adjustmentDelta = 0;
      if (delta !== undefined && !isNaN(Number(delta))) {
        adjustmentDelta = Number(delta);
      } else {
        const rawAmount = Math.abs(Number(amount) || 0);
        adjustmentDelta = type === 'subtract' ? -rawAmount : rawAmount;
      }
      finalXp = Math.max(0, currentXp + adjustmentDelta);
    }

    const netChange = finalXp - currentXp;

    // 2. Update student XP via supabaseAdmin (bypasses RLS)
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ xp_points: finalXp })
      .eq('id', id)
      .select()
      .single();

    if (profileError) {
      console.error('Failed to update student XP in database:', profileError);
      throw profileError;
    }

    // 3. Optional: Send Notification to Student
    try {
      const isPositive = netChange >= 0;
      const formattedReason = reason && reason.trim() ? `: ${reason.trim()}` : '';
      await supabaseAdmin.from('notifications').insert([{
        user_id: id,
        title: isPositive ? '🎉 مكافأة نقاط جديدة!' : 'ℹ️ تحديث في رصيد النقاط',
        message: isPositive
          ? `حصلت على +${netChange} نقطة XP إضافية في رصيدك${formattedReason}!`
          : `تم خصم ${Math.abs(netChange)} نقطة XP من رصيدك${formattedReason}.`,
        type: 'xp'
      }]);
    } catch (notifErr) {
      console.warn('Optional notification could not be created:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'تم تحديث نقاط الطالب بنجاح',
      xp_points: finalXp,
      delta: netChange,
      student: updatedProfile
    });
  } catch (error) {
    console.error('Error adjusting student XP:', error);
    res.status(500).json({ success: false, error: error.message || 'حدث خطأ أثناء تعديل النقاط' });
  }
};

// @desc    Get current gamification XP rules
// @route   GET /api/gamification/rules
// @access  Public
const getGamificationRulesHandler = async (req, res) => {
  try {
    // 1. Try Supabase platform_settings if table exists
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('platform_settings')
          .select('value')
          .eq('key', 'gamification_rules')
          .maybeSingle();

        if (!error && data?.value) {
          return res.json({ success: true, rules: data.value });
        }
      } catch (sbErr) {
        // Fallback to local JSON
      }
    }

    // 2. Fallback to local JSON file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../../data/gamification_rules.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return res.json({ success: true, rules: JSON.parse(content) });
    }

    res.json({
      success: true,
      rules: {
        lesson_completed: 15,
        quiz_passed: 20,
        quiz_full_score: 50,
        course_completed: 100,
        notes_saved: 5
      }
    });
  } catch (error) {
    console.error('Error fetching gamification rules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rules' });
  }
};

// @desc    Update gamification XP rules
// @route   POST /api/admin/gamification/rules
// @access  Private/Admin
const updateGamificationRulesHandler = async (req, res) => {
  try {
    const rules = req.body;
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid rules object' });
    }

    // 1. Persist to local JSON file
    const fs = require('fs');
    const path = require('path');
    const dirPath = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, 'gamification_rules.json');
    fs.writeFileSync(filePath, JSON.stringify(rules, null, 2), 'utf8');

    // 2. Try persisting to Supabase platform_settings if available
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('platform_settings')
          .upsert({
            key: 'gamification_rules',
            value: rules,
            updated_at: new Date().toISOString()
          });
      } catch (sbErr) {
        console.warn('Supabase platform_settings upsert error:', sbErr.message);
      }
    }

    res.json({ success: true, message: 'Gamification rules updated successfully', rules });
  } catch (error) {
    console.error('Error updating gamification rules:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update rules' });
  }
};

// @desc    Clear all messages in a specific chat (general grade or private student)
// @route   POST /api/admin/chat/clear
// @access  Private/Admin
const clearChatHandler = async (req, res) => {
  try {
    const { type, id } = req.body;
    const adminId = req.user.id;

    if (!type || !id) {
      return res.status(400).json({ success: false, error: 'نوع ومعرف المحادثة مطلوبان' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Supabase admin client not initialized' });
    }

    // 1. Collect media URLs to delete from storage if any
    let mediaFilesToDelete = [];
    try {
      let selectQuery = supabaseAdmin.from('chat_messages').select('media_url');
      if (type === 'general') {
        selectQuery = selectQuery.eq('grade_level', id).is('receiver_id', null);
      } else {
        selectQuery = selectQuery.or(`and(sender_id.eq.${adminId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${adminId}),and(receiver_id.eq.${id},grade_level.is.null),and(sender_id.eq.${id},grade_level.is.null)`);
      }
      const { data: mediaRows } = await selectQuery;
      if (mediaRows && mediaRows.length > 0) {
        mediaFilesToDelete = mediaRows
          .filter(r => r.media_url && typeof r.media_url === 'string' && r.media_url.includes('/chat_media/'))
          .map(r => {
            const parts = r.media_url.split('/chat_media/');
            return parts[parts.length - 1];
          })
          .filter(Boolean);
      }
    } catch (mErr) {
      console.warn('Could not list media files to delete from storage:', mErr.message);
    }

    // 2. Perform DB deletion
    let deleteQuery = supabaseAdmin.from('chat_messages').delete({ count: 'exact' });
    if (type === 'general') {
      deleteQuery = deleteQuery.eq('grade_level', id).is('receiver_id', null);
    } else if (type === 'private') {
      deleteQuery = deleteQuery.or(`and(sender_id.eq.${adminId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${adminId}),and(receiver_id.eq.${id},grade_level.is.null),and(sender_id.eq.${id},grade_level.is.null)`);
    } else {
      return res.status(400).json({ success: false, error: 'نوع المحادثة غير صالح' });
    }

    const { error: delError, count } = await deleteQuery;
    if (delError) {
      console.error('Error clearing chat from database:', delError);
      return res.status(500).json({ success: false, error: delError.message || 'فشل حذف الرسائل' });
    }

    // 3. Clean up storage files asynchronously
    if (mediaFilesToDelete.length > 0) {
      supabaseAdmin.storage.from('chat_media').remove(mediaFilesToDelete).catch(err => {
        console.warn('Failed to delete media files from storage:', err.message);
      });
    }

    return res.json({
      success: true,
      message: type === 'general' ? 'تم تنظيف محادثة الصف بنجاح' : 'تم تنظيف المحادثة الخاصة بنجاح',
      deletedCount: count || 0
    });
  } catch (error) {
    console.error('Error in clearChatHandler:', error);
    return res.status(500).json({ success: false, error: error.message || 'حدث خطأ في الخادم أثناء تنظيف المحادثة' });
  }
};

module.exports = {
  getDashboardStats,
  updateSubscriptionStatus,
  extendSubscription,
  syncExpiredSubscriptionsHandler,
  deleteSubscription,
  createStudent,
  updateStudent,
  deleteStudent,
  adjustStudentXp,
  getGamificationRulesHandler,
  updateGamificationRulesHandler,
  clearChatHandler
};
