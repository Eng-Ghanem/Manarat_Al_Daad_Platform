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

    // Update the profile manually to include grade_level since the DB trigger doesn't map it currently
    if (grade_level && user?.user?.id) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ grade_level })
        .eq('id', user.user.id);
        
      if (profileError) {
        console.error('Failed to update grade_level in profile:', profileError);
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
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) throw error;

    res.json({ success: true, message: 'Student deleted successfully' });
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

module.exports = {
  getDashboardStats,
  updateSubscriptionStatus,
  extendSubscription,
  syncExpiredSubscriptionsHandler,
  deleteSubscription,
  createStudent,
  updateStudent,
  deleteStudent,
  adjustStudentXp
};
