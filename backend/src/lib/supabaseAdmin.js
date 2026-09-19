require('dns').setDefaultResultOrder('ipv4first');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from project root (.env)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Fallback if launched from backend directory or another location
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
