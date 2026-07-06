const supabaseAdmin = require('../lib/supabaseAdmin');

// @desc    Lookup email by phone number
// @route   POST /api/auth/lookup-email
// @access  Public
const lookupEmailByPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Search in profiles table for this phone number using Admin Privileges (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('phone_number', phone)
      .single();

    if (error || !data || !data.email) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على حساب بهذا الرقم' });
    }

    res.json({ success: true, data: { email: data.email } });
  } catch (error) {
    console.error('Error looking up email by phone:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

module.exports = {
  lookupEmailByPhone
};
