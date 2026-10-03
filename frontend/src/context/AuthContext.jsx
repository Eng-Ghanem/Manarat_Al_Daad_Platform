import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const convertArabicNumerals = (str) => {
  if (!str) return str;
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => arabicNumbers.indexOf(d));
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('manarat_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('manarat_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cachedProfile = localStorage.getItem('manarat_cached_profile');
      const cachedUser = localStorage.getItem('manarat_cached_user');
      return !(cachedProfile && cachedUser);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        try {
          localStorage.setItem('manarat_cached_user', JSON.stringify(activeUser));
        } catch {}
        fetchProfile(activeUser.id);
      } else {
        try {
          localStorage.removeItem('manarat_cached_user');
          localStorage.removeItem('manarat_cached_profile');
        } catch {}
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        try {
          localStorage.removeItem('manarat_cached_user');
          localStorage.removeItem('manarat_cached_profile');
        } catch {}
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        try {
          localStorage.setItem('manarat_cached_user', JSON.stringify(session.user));
        } catch {}
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
        // Fallback to active user metadata if profile table query fails or RLS recursion occurs
        const { data: userData } = await supabase.auth.getUser();
        const activeUser = userData?.user;
        if (activeUser) {
          const meta = activeUser.user_metadata || {};
          const fallbackData = {
            id: userId,
            email: activeUser.email,
            full_name: meta.full_name || meta.name || activeUser.email?.split('@')[0] || 'طالب',
            phone_number: meta.phone_number || meta.phone || '',
            grade_level: meta.grade_level || '',
            role: meta.role || (activeUser.email === '41147332a@gmail.com' ? 'admin' : 'student'),
            xp_points: 0
          };
          setProfile(prev => prev || fallbackData);
          try {
            localStorage.setItem('manarat_cached_profile', JSON.stringify(fallbackData));
          } catch {}
        }
      } else if (data) {
        // If profile exists but some fields are missing while present in user_metadata, enrich them
        const { data: userData } = await supabase.auth.getUser();
        const activeUser = userData?.user;
        const meta = activeUser?.user_metadata || {};
        if (!data.full_name && (meta.full_name || meta.name)) {
          data.full_name = meta.full_name || meta.name;
        }
        if (!data.phone_number && (meta.phone_number || meta.phone)) {
          data.phone_number = meta.phone_number || meta.phone;
        }
        if (!data.grade_level && meta.grade_level) {
          data.grade_level = meta.grade_level;
        }

        // Platform Admins & Teachers should NEVER accumulate student XP or be ranked with students
        if ((data.role === 'admin' || data.role === 'teacher') && data.xp_points > 0) {
          supabase.from('profiles').update({ xp_points: 0 }).eq('id', userId).then(() => {});
          data.xp_points = 0;
        }
        setProfile(data);
        try {
          localStorage.setItem('manarat_cached_profile', JSON.stringify(data));
        } catch {}
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
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline'
        }
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
