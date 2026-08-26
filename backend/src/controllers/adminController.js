const supabaseAdmin = require('../lib/supabaseAdmin');

// @desc    Get stats for admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Example: Count total users
    const { count: usersCount, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

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
// @route   PUT /api/admin/subscriptions/:id
// @access  Private/Admin
const updateSubscriptionStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status })
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

module.exports = {
  getDashboardStats,
  updateSubscriptionStatus,
  deleteSubscription,
  createStudent,
  updateStudent,
  deleteStudent
};
