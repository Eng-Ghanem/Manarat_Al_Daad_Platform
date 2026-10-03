import React from 'react';
import { supabase } from '../lib/supabase';
import { playChimeSound } from './notificationSound';
import toast from 'react-hot-toast';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Safe parser for session time string (e.g., '21:00', '09:00', '21:00:00', '09:00 م', '9:00 PM')
function parseTimeString(timeStr, baseDate) {
  if (!timeStr) return null;
  const str = String(timeStr).trim();
  
  let hours = 0;
  let minutes = 0;

  // Handle 12-hour format with Arabic or English AM/PM
  const isPM = /م|pm/i.test(str);
  const isAM = /ص|am/i.test(str);

  const clean = str.replace(/[^\d:]/g, '');
  const parts = clean.split(':').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    hours = parts[0];
    minutes = parts[1];

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  } else {
    return null;
  }

  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Checks for live sessions starting within the next 5 minutes.
 * When an imminent session is detected:
 * 1. Plays the "طن" bell chime sound.
 * 2. Inserts an in-app notification in Supabase.
 * 3. Shows an interactive popup toast.
 * 
 * @param {Object} profile - The currently authenticated user profile
 * @param {Function} navigate - React Router navigate function
 * @param {Function} onNewNotification - Callback to refresh bell UI state
 */
export async function checkUpcomingLiveSessions(profile, navigate, onNewNotification) {
  if (!profile || !profile.id) return;

  const now = new Date();
  const todayDayName = ARABIC_DAYS[now.getDay()];
  const todayKey = now.toISOString().slice(0, 10);
  const isAdmin = profile.role === 'admin' || profile.role === 'teacher' || profile.email === '41147332a@gmail.com';

  try {
    // 1. Check weekly recurring schedules
    const { data: weeklyData, error: weeklyErr } = await supabase
      .from('weekly_schedules')
      .select('*')
      .eq('is_active', true);

    if (!weeklyErr && Array.isArray(weeklyData)) {
      for (const ws of weeklyData) {
        // Eligibility check for students
        if (!isAdmin) {
          if (ws.target_type === 'student' && ws.target_student_id && ws.target_student_id !== profile.id) {
            continue;
          }
          if (ws.grade_level && profile.grade_level && ws.grade_level !== profile.grade_level) {
            continue;
          }
        }

        // Check if schedule runs today
        if (Array.isArray(ws.days) && ws.days.includes(todayDayName)) {
          const startTime = parseTimeString(ws.start_time, now);
          if (startTime) {
            const diffMin = (startTime.getTime() - now.getTime()) / (1000 * 60);

            // Trigger when between 0.05 and 5.2 minutes remaining
            if (diffMin > 0.05 && diffMin <= 5.2) {
              const reminderKey = `notif_reminded_ws_${ws.id}_${todayKey}_${Math.floor(startTime.getTime() / 3600000)}`;
              if (!sessionStorage.getItem(reminderKey)) {
                sessionStorage.setItem(reminderKey, 'true');
                await triggerSessionAlert({
                  id: ws.id,
                  title: ws.title || 'الحصة الأسبوعية المباشرة',
                  grade: ws.grade_level || 'الحصة المباشرة',
                  zoom_link: ws.zoom_link,
                  minutesLeft: Math.max(1, Math.round(diffMin)),
                  isAdmin,
                  profile,
                  navigate,
                  onNewNotification
                });
              }
            }
          }
        }
      }
    }

    // 2. Check individual online_sessions
    const { data: onlineData, error: onlineErr } = await supabase
      .from('online_sessions')
      .select('*')
      .gte('start_time', now.toISOString())
      .lte('start_time', new Date(now.getTime() + 10 * 60000).toISOString());

    if (!onlineErr && Array.isArray(onlineData)) {
      for (const os of onlineData) {
        if (!isAdmin) {
          if (os.grade_level && profile.grade_level && os.grade_level !== profile.grade_level) {
            continue;
          }
        }

        const startTime = new Date(os.start_time);
        const diffMin = (startTime.getTime() - now.getTime()) / (1000 * 60);

        if (diffMin > 0.05 && diffMin <= 5.2) {
          const reminderKey = `notif_reminded_os_${os.id}_${todayKey}`;
          if (!sessionStorage.getItem(reminderKey)) {
            sessionStorage.setItem(reminderKey, 'true');
            await triggerSessionAlert({
              id: os.id,
              title: os.title || 'حصة تفاعلية مباشرة',
              grade: os.grade_level || 'الحصة المباشرة',
              zoom_link: os.zoom_link,
              minutesLeft: Math.max(1, Math.round(diffMin)),
              isAdmin,
              profile,
              navigate,
              onNewNotification
            });
          }
        }
      }
    }

  } catch (err) {
    console.warn('Upcoming session reminder check warning:', err);
  }
}

/**
 * Fires the alert: sound + in-app notification + interactive toast.
 */
async function triggerSessionAlert({ id, title, grade, zoom_link, minutesLeft, isAdmin, profile, navigate, onNewNotification }) {
  // 1. Play signature "طن" bell chime sound
  playChimeSound(true);

  const targetLink = isAdmin ? '/admin-dashboard/live-sessions' : '/live-sessions';
  const notifTitle = isAdmin 
    ? `⏰ تذكير: حصتك المباشرة تبدأ بعد ${minutesLeft} دقائق!` 
    : `⏰ تنبيه: حصتك المباشرة تبدأ بعد ${minutesLeft} دقائق!`;
    
  const notifMessage = isAdmin
    ? `حصة "${title}" (${grade}) على وشك البدء خلال ${minutesLeft} دقائق. اضغط للانضمام وبدء الغرفة.`
    : `استعد لدخول حصة "${title}" (${grade})، متبقي ${minutesLeft} دقائق فقط. اضغط للدخول.`;

  // 2. Persist in database notifications table
  try {
    await supabase.from('notifications').insert([{
      user_id: profile.id,
      title: notifTitle,
      message: notifMessage,
      type: 'live_session',
      link: targetLink,
      is_read: false
    }]);
  } catch (e) {
    console.warn('Could not persist session reminder notification to database:', e);
  }

  // 3. Callback to refresh notification count / list in UI
  if (onNewNotification) {
    onNewNotification();
  }

  // 4. Interactive Glassmorphic Toast Notification
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 border border-blue-500/30 overflow-hidden font-arabic transition-all duration-300 transform`}
      style={{ direction: 'rtl' }}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="shrink-0 pt-0.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-blue-400 opacity-50"></span>
              🔔
            </span>
          </div>
          <div className="mr-3 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {notifTitle}
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {notifMessage}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col border-r border-gray-200 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
        <button
          onClick={() => {
            toast.dismiss(t.id);
            if (navigate) navigate(targetLink);
          }}
          className="w-full border border-transparent rounded-none p-3 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 focus:outline-none transition-colors"
        >
          دخول الآن 🚀
        </button>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none p-2 flex items-center justify-center text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none transition-colors"
        >
          إغلاق
        </button>
      </div>
    </div>
  ), {
    duration: 8000,
    position: 'top-center'
  });
}
