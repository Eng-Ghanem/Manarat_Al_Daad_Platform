const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '../../.env' }); // Load from root

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a Supabase client with the Service Role key
// This bypasses Row Level Security (RLS) entirely, so it MUST ONLY be used in protected Admin routes.
let supabaseAdmin = null;

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.warn('⚠️ Missing SUPABASE_SERVICE_ROLE_KEY in .env file. Admin functions will not work.');
}

module.exports = supabaseAdmin;
