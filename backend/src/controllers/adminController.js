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

module.exports = {
  getDashboardStats
};
