import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { chatService } from '../lib/chatService';
import { useAuth } from '../context/AuthContext';
import { Send, Users, ShieldAlert, Shield, MessageSquare, Image as ImageIcon, X, Loader, FileText, Check, CheckCheck, MoreVertical, Pencil, Trash2, Ban, ArrowRight, Reply, Calendar } from 'lucide-react';
import FadeIn from '../components/FadeIn';
import ChatInput from '../components/ChatInput';

export default function StudentChat() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n?.language === 'ar';
  const { user, profile } = useAuth();

  const [adminProfile, setAdminProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // { type: 'general' | 'private' }
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, private: 0 });
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [activeMessageOptions, setActiveMessageOptions] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    fetchAdmin();
  }, []);

  useEffect(() => {
    if (adminProfile && profile) {
      fetchUnreadCounts();

      const channel = supabase
        .channel('student_unread_counts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
          const newMsg = payload.new;
          if (newMsg.sender_id !== user.id) {
            const isForMePrivate = newMsg.receiver_id === user.id;
            const isForMyGrade = newMsg.grade_level === profile.grade_level && !newMsg.receiver_id;

            if (isForMePrivate || isForMyGrade) {
              setUnreadCounts(prev => {
                const isCurrentActiveGeneral = activeChat?.type === 'general' && isForMyGrade;
                const isCurrentActivePrivate = activeChat?.type === 'private' && isForMePrivate;

                if (!isCurrentActiveGeneral && !isCurrentActivePrivate) {
                  return {
                    ...prev,
                    general: isForMyGrade ? prev.general + 1 : prev.general,
                    private: isForMePrivate ? prev.private + 1 : prev.private
                  };
                }
                return prev;
              });
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [adminProfile, profile, activeChat, user.id]);

  useEffect(() => {
    if (activeChat && adminProfile && profile) {
      loadMessages();
    }
  }, [activeChat, adminProfile, profile]);

  useEffect(() => {
    if (activeChat && adminProfile && profile) {
      const unsubscribe = chatService.subscribeToMessages((payload) => {
        const event = payload.eventType;
        const newMsg = payload.new;
        const oldMsg = payload.old;

        if (event === 'INSERT') {
          const isForGeneral = activeChat.type === 'general' && newMsg.grade_level === profile.grade_level && !newMsg.receiver_id;
          const isForPrivate = activeChat.type === 'private' &&
            ((newMsg.sender_id === user.id && newMsg.receiver_id === adminProfile.id) ||
              (newMsg.sender_id === adminProfile.id && newMsg.receiver_id === user.id));

          if (isForGeneral || isForPrivate) {
            supabase.from('profiles').select('full_name, role').eq('id', newMsg.sender_id).single()
              .then(({ data }) => {
                if (data) newMsg.sender = data;
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
              })
              .catch(() => {
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
              });
          }
        } else if (event === 'UPDATE') {
          setMessages(prev => prev.map(msg => msg.id === newMsg.id ? { ...msg, ...newMsg } : msg));
        } else if (event === 'DELETE') {
          setMessages(prev => prev.filter(msg => msg.id !== oldMsg.id));
        }
      });
      return () => unsubscribe();
    }
  }, [activeChat, adminProfile, profile, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  const fetchAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAdminProfile(data);
    } catch (err) {
      console.error('Error fetching admin profile:', err);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_id, grade_level, receiver_id')
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (error) throw error;

      let generalCount = 0;
      let privateCount = 0;

      data.forEach(msg => {
        if (msg.receiver_id === user.id) {
          privateCount++;
        } else if (msg.grade_level === profile.grade_level && !msg.receiver_id) {
          generalCount++;
        }
      });

      setUnreadCounts({ general: generalCount, private: privateCount });
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  const handleSelectChat = (type) => {
    setActiveChat({ type });
    window.scrollTo({ top: 0, behavior: 'instant' });
    setUnreadCounts(prev => ({ ...prev, [type]: 0 }));
  };

  const chatCacheRef = useRef({});

  const loadMessages = async () => {
    if (!activeChat) return;
    const cacheKey = `${activeChat.type}_${activeChat.type === 'general' ? profile?.grade_level : adminProfile?.id}`;
    if (chatCacheRef.current[cacheKey]) {
      setMessages(chatCacheRef.current[cacheKey]);
    } else {
      setLoading(true);
    }

    try {
      const data = await chatService.fetchMessages({
        gradeLevel: activeChat.type === 'general' ? profile?.grade_level : null,
        studentId: activeChat.type === 'private' ? user.id : null,
        isAdmin: false,
        adminId: adminProfile?.id
      });
      setMessages(data || []);
      chatCacheRef.current[cacheKey] = data || [];

      const unreadIds = (data || []).filter(m => m.sender_id !== user.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await chatService.markAsRead(unreadIds);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToMessage = (targetId) => {
    if (!targetId) return;
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-amber-400', 'transition-all', 'duration-500');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-amber-400');
      }, 2000);
    }
  };

  const handleReplyClick = (msg) => {
    setReplyingTo({
      id: msg.id,
      sender_name: getSenderName(msg),
      content: msg.content,
      media_type: msg.media_type,
      media_url: msg.media_url
    });
    setActiveMessageOptions(null);
  };

  const handleSendMessage = async ({ content, mediaUrl, mediaType, replyTo, mentions }) => {
    // 1. Optimistic Message for Instant 0ms Display
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activeChat.type === 'private' ? adminProfile?.id : null,
      grade_level: activeChat.type === 'general' ? profile?.grade_level : null,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      is_read: false,
      sender: {
        full_name: profile?.full_name || t('chat_you'),
        role: profile?.role || 'student'
      },
      is_optimistic: true
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);

    // Instant auto-scroll
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 10);

    try {
      const realMsg = await chatService.sendMessage({
        senderId: user.id,
        receiverId: activeChat.type === 'private' ? adminProfile?.id : null,
        gradeLevel: activeChat.type === 'general' ? profile?.grade_level : null,
        content,
        mediaUrl,
        mediaType,
        replyTo
      });

      // Replace optimistic placeholder with real confirmed message
      setMessages(prev => prev.map(m => m.id === tempId ? (realMsg || m) : m));

      // Update cache
      const cacheKey = `${activeChat.type}_${activeChat.type === 'general' ? profile?.grade_level : adminProfile?.id}`;
      if (chatCacheRef.current[cacheKey]) {
        chatCacheRef.current[cacheKey] = chatCacheRef.current[cacheKey].map(m => m.id === tempId ? (realMsg || m) : m);
      }

      // 2. Dispatch notifications to mentioned users reliably
      if (mentions && Array.isArray(mentions) && mentions.length > 0) {
        const senderName = profile?.full_name || t('chat_student_default');
        chatService.notifyMentions({
          mentionedUsers: mentions,
          senderName,
          senderId: user.id,
          messageSnippet: content,
          isRTL
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  };

  const handleEditClick = (msg) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content || '');
    setActiveMessageOptions(null);
  };

  const handleSaveEdit = async (msgId) => {
    if (!editingContent.trim()) {
      alert('لا يمكن حفظ رسالة فارغة.');
      return;
    }
    try {
      await chatService.editMessage(msgId, editingContent);
      setEditingMessageId(null);
      setEditingContent('');
    } catch (error) {
      console.error(error);
      alert('خطأ أثناء تعديل الرسالة');
    }
  };

  const handleDeleteMessage = (msgId) => {
    setMessageToDelete(msgId);
    setActiveMessageOptions(null);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    try {
      await chatService.deleteMessage(messageToDelete, user.id);
      setMessageToDelete(null);
    } catch (error) {
      console.error(error);
      alert('خطأ أثناء حذف الرسالة');
    }
  };

  const chatParticipants = React.useMemo(() => {
    const list = [];
    if (adminProfile) {
      list.push({ id: adminProfile.id, name: adminProfile.full_name || 'أ. سيد غريب', role: 'admin' });
    } else {
      list.push({ id: 'admin', name: 'أ. سيد غريب', role: 'admin' });
    }
    const seen = new Set(list.map(p => p.id));
    messages.forEach(m => {
      if (m.sender_id && !seen.has(m.sender_id) && m.sender?.full_name) {
        seen.add(m.sender_id);
        list.push({ id: m.sender_id, name: m.sender.full_name, role: m.sender.role || 'student' });
      }
    });
    return list;
  }, [adminProfile, messages]);

  const renderTextWithMentions = (text, isMe = false) => {
    if (!text) return null;
    // High contrast styling for light mode, dark mode, and isMe bubble
    const badgeClass = isMe
      ? 'bg-black/30 text-amber-200 border-amber-300/40 shadow-xs'
      : 'bg-amber-100 text-amber-950 border-amber-300 shadow-xs dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-500/40';

    const atSignClass = isMe
      ? 'text-amber-300 font-black'
      : 'text-amber-700 dark:text-amber-400 font-black';

    if (text.includes('@')) {
      const lines = text.split('\n');
      const mentions = [];
      const bodyLines = [];
      let inMentionsHeader = true;

      // Extract known names from chatParticipants for accurate matching
      const knownNames = (chatParticipants || [])
        .map(p => (typeof p === 'string' ? p : p?.name)?.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (inMentionsHeader && trimmed.startsWith('@')) {
          const afterAt = trimmed.slice(1).trim();
          // Check if matches a known participant name
          const matched = knownNames.find(n => 
            afterAt.toLowerCase() === n.toLowerCase() ||
            afterAt.toLowerCase().startsWith(n.toLowerCase() + ' ')
          );

          if (matched) {
            mentions.push(matched);
            const rest = afterAt.slice(matched.length).trim();
            if (rest) {
              bodyLines.push(rest);
              inMentionsHeader = false;
            }
          } else {
            // Line starts with @ but not in knownNames
            // If there are multiple lines or no spaces, treat entire line as mention name
            if (i < lines.length - 1 || !afterAt.includes(' ')) {
              mentions.push(afterAt);
            } else {
              // Single line with spaces, e.g. "@علي ازيك"
              const spaceIdx = afterAt.indexOf(' ');
              mentions.push(afterAt.slice(0, spaceIdx));
              bodyLines.push(afterAt.slice(spaceIdx).trim());
              inMentionsHeader = false;
            }
          }
        } else {
          inMentionsHeader = false;
          bodyLines.push(line);
        }
      }

      const bodyText = bodyLines.join('\n').trim();

      if (mentions.length > 0) {
        return (
          <div className="flex flex-col items-start gap-1 w-full" dir="auto">
            {/* Mention badge pills - preceded by @ */}
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              {mentions.map((mName, idx) => (
                <div 
                  key={idx} 
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border font-black text-xs tracking-wide ${badgeClass}`}
                >
                  <span className={atSignClass} dir="ltr">@</span>
                  <bdi className="font-bold">{mName}</bdi>
                </div>
              ))}
            </div>

            {/* Message Body underneath if present */}
            {bodyText ? (
              <div className="leading-relaxed break-words whitespace-pre-wrap mt-0.5 text-sm" dir="auto">
                {bodyText}
              </div>
            ) : null}
          </div>
        );
      }

      // Inline @mentions fallback
      const parts = text.split(/(@[^\s@\n]+)/g);
      return (
        <span dir="auto" className="break-words leading-relaxed whitespace-pre-wrap text-sm">
          {parts.map((part, i) => {
            if (part.startsWith('@')) {
              const name = part.slice(1);
              return (
                <span 
                  key={i} 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-black text-xs mx-0.5 ${badgeClass}`}
                >
                  <span className={atSignClass} dir="ltr">@</span>
                  <bdi className="font-bold">{name}</bdi>
                </span>
              );
            }
            return part;
          })}
        </span>
      );
    }

    return <span dir="auto" className="break-words leading-relaxed whitespace-pre-wrap">{text}</span>;
  };

  // Generate a consistent color for each sender based on their ID
  const nameColors = [
    'text-rose-500', 'text-violet-500', 'text-amber-500', 'text-emerald-500',
    'text-sky-500', 'text-pink-500', 'text-indigo-400', 'text-teal-500',
    'text-orange-400', 'text-cyan-500', 'text-lime-500', 'text-fuchsia-500',
  ];
  const avatarColors = [
    'from-rose-500 to-pink-600', 'from-violet-500 to-purple-600', 'from-amber-400 to-orange-500',
    'from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-pink-500 to-rose-600',
    'from-indigo-500 to-violet-600', 'from-teal-500 to-cyan-600', 'from-orange-400 to-red-500',
    'from-cyan-500 to-sky-600', 'from-lime-500 to-green-600', 'from-fuchsia-500 to-pink-600',
  ];
  const getSenderColorIndex = (senderId) => {
    if (!senderId) return 0;
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % nameColors.length;
  };
  const getSenderName = (msg) => {
    if (msg.sender_id === user.id) return profile?.full_name || t('chat_student_default');
    if (msg.sender?.role === 'admin' || msg.sender_id === adminProfile?.id) return adminProfile?.full_name || t('chat_platform_admin');
    return msg.sender?.full_name || t('chat_student_default');
  };
  const isAdminSender = (msg) => msg.sender?.role === 'admin' || msg.sender_id === adminProfile?.id;

  const formatMsgTime = (dateStr) => {
    try {
      const d = dateStr ? new Date(dateStr) : new Date();
      if (isNaN(d.getTime())) return '';
      const locale = (i18n?.language === 'ar' || isRTL) ? 'ar-EG' : 'en-US';
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      try {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (err) {
        return '';
      }
    }
  };

  const isSameDay = (d1Str, d2Str) => {
    if (!d1Str || !d2Str) return false;
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatChatDateDivider = (dateStr) => {
    try {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';

      const now = new Date();
      const isToday = 
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) return t('chat_today', 'اليوم');

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = 
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return t('chat_yesterday', 'أمس');

      const locale = (i18n?.language === 'ar' || isRTL) ? 'ar-EG-u-nu-latn' : 'en-US';
      return date.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  if (!profile?.grade_level) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl text-center max-w-md w-full mx-4 border border-gray-100 dark:border-slate-700">
          <ShieldAlert className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('chat_complete_profile_warning')}</h2>
          <p className="text-gray-500 dark:text-gray-400">{t('chat_complete_profile_desc', 'يجب عليك تحديد صفك الدراسي أولاً لتتمكن من استخدام نظام الدردشة والتواصل مع زملائك.')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100dvh-8rem)] md:h-[calc(100vh-80px)] mt-16 md:mt-20 mb-16 md:mb-0 max-w-7xl mx-auto rounded-none md:rounded-3xl overflow-hidden shadow-2xl border-0 md:border border-gray-200 dark:border-slate-700 font-arabic relative z-10">

      {/* Sidebar */}
      <div className={`w-full md:w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col shrink-0 transition-transform ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {t('chat_sidebar_title')}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button
            onClick={() => handleSelectChat('general')}
            className={`w-full flex items-center justify-between gap-4 px-4 py-4 rounded-2xl transition-all relative ${activeChat?.type === 'general' ? 'bg-blue-600 shadow-lg shadow-blue-600/30 text-white scale-[1.02]' : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-slate-700'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${activeChat?.type === 'general' ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'}`}>
                <Users className="w-6 h-6" />
              </div>
              <div className="rtl:text-right ltr:text-left">
                <span className="block font-bold text-lg">{t('chat_general_title')}</span>
                <span className={`block text-xs ${activeChat?.type === 'general' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t(`grade_${profile.grade_level}`)}
                </span>
              </div>
            </div>
            {Object.keys(unreadCounts).some(key => ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'].includes(key)) && (
              <span className="absolute left-4 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
            )}
          </button>

          <button
            onClick={() => handleSelectChat('private')}
            className={`w-full flex items-center justify-between gap-4 px-4 py-4 rounded-2xl transition-all relative ${activeChat?.type === 'private' ? 'bg-purple-600 shadow-lg shadow-purple-600/30 text-white scale-[1.02]' : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-slate-700'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${activeChat?.type === 'private' ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'}`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="rtl:text-right ltr:text-left">
                <span className="block font-bold text-lg">{t('chat_admin_sender')}</span>
                <span className={`block text-xs ${activeChat?.type === 'private' ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('chat_direct_communication')}
                </span>
              </div>
            </div>
            {unreadCounts.private > 0 && (
              <span className="absolute left-4 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
            )}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 w-full flex-col bg-[#eef0f3] dark:bg-slate-900 relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-20 px-4 sm:px-6 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3 sm:gap-4 z-10 shadow-sm shrink-0">
              <button
                onClick={() => setActiveChat(null)}
                className="md:hidden p-2 -mr-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              {activeChat.type === 'general' ? (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0 shadow-md">
                  أ
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl truncate">
                  {activeChat.type === 'general' ? `${t('chat_general_title')} - ${t(`grade_${profile.grade_level}`)}` : t('chat_platform_admin')}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {activeChat.type === 'general' ? t('chat_general_subtitle') : t('chat_private_subtitle')}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundBlendMode: 'overlay' }}>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === user.id;
                  const prevMsg = messages[index - 1];
                  const nextMsg = messages[index + 1];
                  const showDateDivider = index === 0 || !isSameDay(prevMsg?.created_at, msg.created_at);
                  const showAvatar = !isMe && (!nextMsg || nextMsg.sender_id !== msg.sender_id);
                  const isFirstInGroup = index === 0 || prevMsg?.sender_id !== msg.sender_id || showDateDivider;
                  const hasMention = Boolean(msg.content && msg.content.includes('@'));
                  const shouldShowSenderName = isFirstInGroup || hasMention;
                  const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : Date.now();
                  const isDeletable = !isNaN(msgTime) && (Date.now() - msgTime) < 60 * 60 * 1000;
                  const colorIdx = getSenderColorIndex(msg.sender_id);
                  const senderName = getSenderName(msg);
                  const senderInitial = senderName.charAt(0);
                  const isAdmin = isAdminSender(msg);

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateDivider && (
                        <div className="flex items-center justify-center my-4 select-none sticky top-2 z-20 pointer-events-none">
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-xs border bg-white/95 dark:bg-slate-800/95 text-gray-600 dark:text-gray-300 border-gray-200/90 dark:border-slate-700/90 backdrop-blur-md">
                            <Calendar className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                            <span>{formatChatDateDivider(msg.created_at)}</span>
                          </div>
                        </div>
                      )}

                      <FadeIn delay={index * 10} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'
                        } ${activeMessageOptions === msg.id ? 'relative z-50' : 'relative z-10'}`}>

                      {/* Avatar for others (WhatsApp style - bottom aligned) */}
                      {!isMe && (
                        <div className="shrink-0 w-8 h-8 mb-0.5">
                          {showAvatar ? (
                            isAdmin ? (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-md">
                                <Shield className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                {senderInitial}
                              </div>
                            )
                          ) : (
                            <div className="w-8 h-8" />
                          )}
                        </div>
                      )}

                      <div 
                        id={`msg-${msg.id}`}
                        className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group`}
                      >
                        {/* Quick hover reply button on desktop */}
                        {!msg.is_deleted && (
                          <div 
                            onClick={() => handleReplyClick(msg)}
                            title={t('chat_reply')}
                            className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? '-left-8' : '-right-8'} w-7 h-7 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 dark:text-blue-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-0 shadow-xs active:scale-90`}
                          >
                            <Reply className="w-3.5 h-3.5 rtl:-scale-x-100" />
                          </div>
                        )}

                        <motion.div 
                          drag={!msg.is_deleted ? "x" : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={{ right: 0.5, left: 0 }}
                          dragTransition={{ bounceStiffness: 900, bounceDamping: 28 }}
                          onDragEnd={(e, info) => {
                            if (info.offset.x > 25 || info.velocity.x > 150) {
                              handleReplyClick(msg);
                              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                navigator.vibrate(25);
                              }
                            }
                          }}
                          onDoubleClick={() => !msg.is_deleted && handleReplyClick(msg)}
                          className={`rounded-2xl px-3 py-2 shadow-sm relative transition-all ${activeMessageOptions === msg.id ? 'z-50' : 'z-10'
                          } ${isMe
                            ? 'bg-blue-600 text-white rounded-tl-none'
                            : isAdmin
                              ? 'bg-gradient-to-l from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-md'
                              : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-tr-none border border-gray-200 dark:border-slate-700'
                          }`}>

                          {/* Sender Name - Clean WhatsApp Style */}
                          {shouldShowSenderName && (() => {
                            const nameColorClasses = [
                              'text-rose-600 dark:text-rose-400', 'text-violet-600 dark:text-violet-400',
                              'text-amber-600 dark:text-amber-400', 'text-emerald-600 dark:text-emerald-400',
                              'text-sky-600 dark:text-sky-400', 'text-pink-600 dark:text-pink-400',
                              'text-indigo-600 dark:text-indigo-400', 'text-teal-600 dark:text-teal-400',
                              'text-orange-600 dark:text-orange-400', 'text-cyan-600 dark:text-cyan-400',
                              'text-lime-600 dark:text-lime-400', 'text-fuchsia-600 dark:text-fuchsia-400',
                            ];
                            return (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className={`text-[13px] font-black tracking-wide font-arabic ${isMe ? 'text-blue-100' : isAdmin ? 'text-purple-100' : nameColorClasses[colorIdx]
                                  }`}>
                                  {senderName}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] text-blue-200 bg-black/20 px-1.5 py-0.5 rounded-full font-bold">• {t('chat_you')}</span>
                                )}
                                {isAdmin && !isMe && (
                                  <span className="text-[10px] text-purple-100 bg-black/20 px-1.5 py-0.5 rounded-full font-bold shadow-sm">• {t('chat_admin_sender')}</span>
                                )}
                              </div>
                            );
                          })()}

                          {msg.is_deleted ? (
                            <div className={`flex items-center gap-2 text-sm italic py-1 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                              <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span>{(() => {
                                const isDeletedByAdmin = (msg.deleted_by && msg.deleted_by !== msg.sender_id) || (adminProfile?.id && msg.deleted_by === adminProfile.id);
                                return isDeletedByAdmin ? t('chat_msg_deleted_admin') : t('chat_msg_deleted');
                              })()}</span>
                            </div>
                          ) : (
                            <>
                              {/* Quoted Reply Card */}
                              {msg.reply_to && (
                                <div 
                                  onClick={() => scrollToMessage(msg.reply_to.id)}
                                  className={`rounded-xl px-3 py-1.5 mb-2 text-xs cursor-pointer border-s-4 transition-all hover:opacity-90 ${
                                    isMe
                                      ? 'bg-blue-700/60 border-amber-300 text-blue-100'
                                      : 'bg-gray-100/90 dark:bg-slate-700/80 border-blue-500 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                                    <Reply className="w-3 h-3 text-amber-400 rtl:-scale-x-100" />
                                    <span className="truncate">{msg.reply_to.sender_name}</span>
                                  </div>
                                  <p className="line-clamp-2 text-[11px] opacity-90 truncate">
                                    {msg.reply_to.media_type ? (
                                      <span className="flex items-center gap-1">
                                        {msg.reply_to.media_type === 'image' && '📷 ' + t('chat_photo')}
                                        {msg.reply_to.media_type === 'audio' && '🎤 ' + t('chat_voice')}
                                        {msg.reply_to.media_type === 'video' && '🎥 ' + t('chat_video')}
                                        {msg.reply_to.media_type === 'document' && '📄 ' + t('chat_doc')}
                                        {msg.reply_to.content ? ` • ${msg.reply_to.content}` : ''}
                                      </span>
                                    ) : (
                                      msg.reply_to.content || ''
                                    )}
                                  </p>
                                </div>
                              )}

                              {/* Render Media */}
                              {msg.media_url && (
                                <div className="mb-2">
                                  {msg.media_type === 'image' && (
                                    <button onClick={() => setFullscreenImage(msg.media_url)} className="block w-full text-right focus:outline-none">
                                      <img src={msg.media_url} alt="Attachment" className="max-w-full max-h-60 rounded-xl mb-1 object-cover hover:opacity-90 transition-opacity" />
                                    </button>
                                  )}
                                  {msg.media_type === 'video' && (
                                    <video src={msg.media_url} controls className="max-w-full max-h-60 rounded-xl mb-1 bg-black" />
                                  )}
                                  {msg.media_type === 'audio' && (
                                    <div className="w-64 max-w-full overflow-hidden rounded-full">
                                      <audio src={msg.media_url} controls controlsList="nodownload noplaybackrate" className={`w-full h-10 ${isMe ? 'opacity-90' : ''}`} />
                                    </div>
                                  )}
                                  {msg.media_type === 'document' && (
                                    <a href={msg.media_url} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isMe ? 'bg-blue-700/50 border-blue-500 hover:bg-blue-700' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600'}`}>
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-blue-500 text-white' : 'bg-purple-100 text-purple-600'}`}>
                                        <FileText className="w-5 h-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{t('chat_attachment')}</p>
                                        <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{t('chat_click_to_open')}</p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              )}

                              {editingMessageId === msg.id ? (
                                <div className="mt-1 flex flex-col gap-2">
                                  <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-sm text-gray-900 dark:text-white"
                                    rows={2}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => { setEditingMessageId(null); setEditingContent(''); }}
                                      className="px-3 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-slate-600"
                                    >
                                      {t('chat_cancel')}
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(msg.id)}
                                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                    >
                                      {t('chat_save')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                msg.content && msg.media_type !== 'audio' && (
                                  <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderTextWithMentions(msg.content, isMe)}</div>
                                )
                              )}
                            </>
                          )}

                          {/* Timestamp + read receipt */}
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ps-7 ${isMe ? 'text-blue-200' : isAdmin ? 'text-gray-400' : 'text-gray-400 dark:text-gray-500'
                            }`} dir="ltr">
                            {msg.is_edited && !msg.is_deleted && <span className="opacity-70">{t('chat_edited')}</span>}
                            <span>{formatMsgTime(msg.created_at)}</span>
                            {isMe && (
                              msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-200" /> : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Options Button - ONLY VISIBLE for user's own message within 1 hour, OR admin within 1 hour */}
                          {!msg.is_deleted && ((isMe && isDeletable) || (profile?.role === 'admin' && isDeletable)) && (
                            <div className="absolute bottom-1.5 left-1.5 z-20">
                              <button
                                onClick={() => setActiveMessageOptions(activeMessageOptions === msg.id ? null : msg.id)}
                                className={`p-1 rounded-full shadow-xs backdrop-blur-xs transition-all active:scale-90 ${
                                  isMe 
                                    ? 'bg-black/25 hover:bg-black/40 text-blue-100 hover:text-white' 
                                    : 'bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300'
                                }`}
                                title={t('chat_msg_options')}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {activeMessageOptions === msg.id && (
                                <div className="absolute bottom-full mb-1.5 left-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden">
                                  {/* Reply Button - Available for all messages */}
                                  <button
                                    onClick={() => handleReplyClick(msg)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    <Reply className="w-3.5 h-3.5 rtl:-scale-x-100" />
                                    <span>{t('chat_reply')}</span>
                                  </button>

                                  {/* Edit Button - Allowed for my messages within 1 hour */}
                                  {isMe && isDeletable && msg.media_type !== 'audio' && (msg.content || !msg.media_url) && (
                                    <button
                                      onClick={() => handleEditClick(msg)}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-t border-gray-100 dark:border-slate-700"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      <span>{t('chat_edit')}</span>
                                    </button>
                                  )}

                                  {/* Delete Button - Allowed for my messages within 1 hour or admin */}
                                  {((isMe && isDeletable) || (profile?.role === 'admin' && isDeletable)) && (
                                    <button
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-slate-700"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>{t('chat_delete')}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      </div>

                      {/* Spacer for my messages (no avatar on right side) */}
                      {isMe && <div className="w-8 shrink-0" />}
                    </FadeIn>
                  </React.Fragment>
                );
                })
              )}

              {/* Click outside to close options */}
              {activeMessageOptions && (
                <div
                  className="absolute inset-0 z-40"
                  onClick={() => setActiveMessageOptions(null)}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeChat && (
              <ChatInput 
                onSendMessage={handleSendMessage} 
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                participants={chatParticipants}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-6 text-center">
            <MessageSquare className="w-24 h-24 mb-6 text-gray-400" />
            <h2 className="text-3xl font-bold text-gray-500 font-arabic mb-2">{t('chat_welcome_title')}</h2>
            <p className="text-gray-400 text-lg">{t('chat_welcome_desc')}</p>
          </div>
        )}
      </div>
    </div>

      {/* Fullscreen Image Modal */ }
  {
    fullscreenImage && (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
        <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-8 h-8" />
        </button>
      </div>
    )
  }

  {/* Delete Confirmation Modal */ }
  {
    messageToDelete && (
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
        <FadeIn className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-arabic">{t('chat_delete_msg_title')}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('chat_delete_msg_desc')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setMessageToDelete(null)}
              className="flex-1 px-4 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold transition-colors"
            >
              {t('common_cancel')}
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-2.5 rounded-xl text-white bg-red-600 hover:bg-red-700 font-bold transition-colors"
            >
              {t('common_delete')}
            </button>
          </div>
        </FadeIn>
      </div>
    )
  }
    </>
  );
}
