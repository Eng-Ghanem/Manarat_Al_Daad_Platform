import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    let emailToUse = identifier;

    // Check if identifier is not an email (e.g. phone number)
    if (!identifier.includes('@')) {
      try {
        const response = await fetch('http://localhost:5000/api/auth/lookup-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: identifier })
        });
        const result = await response.json();
        
        if (result.success && result.data.email) {
          emailToUse = result.data.email;
        } else {
          return { error: { message: result.error || 'لم يتم العثور على حساب بهذا الرقم' } };
        }
      } catch (err) {
        console.error('Error looking up email:', err);
        return { error: { message: 'تعذر الاتصال بالخادم للتحقق من رقم الهاتف' } };
      }
    }

    return supabase.auth.signInWithPassword({ email: emailToUse, password });
  };

  const register = async (email, password, fullName, phone, gender, gradeLevel) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          gender: gender || null,
          grade_level: gradeLevel || null
        }
      }
    });
  };

  const logout = async () => {
    return supabase.auth.signOut();
  };

  const updateProfile = async (userId, updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
        
      if (error) throw error;
      setProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }
  };

  const verifyOtp = async (email, token, type) => {
    return supabase.auth.verifyOtp({ email, token, type });
  };

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email);
  };

  const updatePassword = async (newPassword) => {
    return supabase.auth.updateUser({ password: newPassword });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login, 
      register, 
      logout, 
      updateProfile,
      verifyOtp,
      resetPassword,
      updatePassword
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
