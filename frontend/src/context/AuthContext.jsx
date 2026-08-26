import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const convertArabicNumerals = (str) => {
  if (!str) return str;
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => arabicNumbers.indexOf(d));
};

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
    let cleanId = convertArabicNumerals(identifier).trim();

    // Check if identifier is not an email (e.g. phone number)
    if (!cleanId.includes('@')) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone_number', cleanId)
          .single();

        if (error || !data || !data.email) {
          return { error: { message: 'لم يتم العثور على حساب بهذا الرقم' } };
        }
        
        emailToUse = data.email;
      } catch (err) {
        console.error('Error looking up email:', err);
        return { error: { message: 'حدث خطأ أثناء التحقق من رقم الهاتف' } };
      }
    } else {
      emailToUse = cleanId.toLowerCase(); // Ensure emails are lowercased
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
    // Optimistic UI update for instant feedback
    setUser(null);
    setProfile(null);
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

  const loginWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login, 
      loginWithGoogle,
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
