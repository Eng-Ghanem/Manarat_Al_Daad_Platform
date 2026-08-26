import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    // 1. Fetch initial count of pending subscriptions
    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
          
        if (error) throw error;
        setPendingCount(count || 0);
      } catch (err) {
        console.error('Error fetching notification count:', err);
      }
    };

    fetchPendingCount();

    // 2. Subscribe to realtime updates on the subscriptions table
    const subscription = supabase
      .channel('public:subscriptions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        // Just refetch the count whenever any change happens to subscriptions
        // to keep it simple and accurate.
        fetchPendingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Only render for admins
  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <Link 
      to="/admin-dashboard/subscriptions"
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
      title="طلبات الاشتراك"
    >
      <Bell size={20} />
      
      {/* Red Dot Indicator */}
      {pendingCount > 0 && (
        <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
    </Link>
  );
}
