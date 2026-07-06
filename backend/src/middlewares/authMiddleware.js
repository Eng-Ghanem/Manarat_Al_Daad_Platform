const supabaseAdmin = require('../lib/supabaseAdmin');

// Middleware to verify JWT token and optionally check if user is an Admin
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized to access this route, no token provided' });
    }

    // Verify token with Supabase
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server misconfiguration: supabaseAdmin is null' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Not authorized, token failed verification' });
    }

    // Fetch user profile to get the role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ error: 'Error fetching user profile data' });
    }

    // Attach user and profile role to the request object
    req.user = {
      ...user,
      role: profile.role
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

// Middleware to restrict access to Admin users only
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

module.exports = { protect, adminOnly };
