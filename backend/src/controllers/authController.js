const supabaseAdmin = require('../lib/supabaseAdmin');

// Helper to mask email for PII protection
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  const visibleStart = name.slice(0, 2);
  const visibleEnd = name.slice(-1);
  return `${visibleStart}****${visibleEnd}@${domain}`;
};

// @desc    Lookup email by phone number
// @route   POST /api/auth/lookup-email
// @access  Public
const lookupEmailByPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف صحيح' });
    }

    const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      return res.status(400).json({ success: false, error: 'صيغة رقم الهاتف غير صالحة' });
    }

    // Search in profiles table for this phone number using Admin Privileges (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('phone_number', cleanPhone)
      .single();

    if (error || !data || !data.email) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على حساب بهذا الرقم' });
    }

    res.json({ 
      success: true, 
      data: { 
        email: data.email,
        maskedEmail: maskEmail(data.email) 
      } 
    });
  } catch (error) {
    console.error('Error looking up email by phone:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

module.exports = {
  lookupEmailByPhone
};
