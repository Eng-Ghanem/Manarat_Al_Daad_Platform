import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { chatService } from '../../lib/chatService';
import { useAuth } from '../../context/AuthContext';
import { Send, Users, User as UserIcon, Search, Check, CheckCheck, Loader, MessageSquare, FileText, Image as ImageIcon, Play, Pause, MoreVertical, Pencil, Trash2, X, Ban, ArrowRight, Reply, Calendar, RotateCcw } from 'lucide-react';
import FadeIn from '../../components/FadeIn';
import ChatInput from '../../components/ChatInput';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function AdminChat() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState('general'); // 'general' | 'private'
  const [activeChat, setActiveChat] = useState(null); // { type: 'general'|'private', id: string, name: string }
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // { [chatId]: count }
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [activeMessageOptions, setActiveMessageOptions] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const grades = [
    { id: 'primary_1', name: t('grade_primary_1') },
    { id: 'primary_2', name: t('grade_primary_2') },
    { id: 'primary_3', name: t('grade_primary_3') },
    { id: 'primary_4', name: t('grade_primary_4') },
    { id: 'primary_5', name: t('grade_primary_5') },
    { id: 'primary_6', name: t('grade_primary_6') },
    { id: 'prep_1', name: t('grade_prep_1') },
    { id: 'prep_2', name: t('grade_prep_2') },
    { id: 'prep_3', name: t('grade_prep_3') },
    { id: 'sec_1', name: t('grade_sec_1') },
    { id: 'sec_2', name: t('grade_sec_2') },
    { id: 'sec_3', name: t('grade_sec_3') },
  ];

  useEffect(() => {
    fetchStudents();
    fetchUnreadCounts();

    // Global listener for unread messages
    const channel = supabase
      .channel('admin_unread_counts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const newMsg = payload.new;
        if (newMsg.sender_id !== user.id) {
          // Check if message is for admin
          const isForAdmin = (newMsg.receiver_id === user.id) || (newMsg.grade_level && !newMsg.receiver_id);
          if (isForAdmin) {
            setUnreadCounts(prev => {
              // If we are currently in this chat, don't show unread
              const isCurrentActiveGeneral = activeChat?.type === 'general' && activeChat?.id === newMsg.grade_level;
              const isCurrentActivePrivate = activeChat?.type === 'private' && activeChat?.id === newMsg.sender_id;

              if (!isCurrentActiveGeneral && !isCurrentActivePrivate) {
                const key = newMsg.receiver_id ? newMsg.sender_id : newMsg.grade_level;
                return { ...prev, [key]: (prev[key] || 0) + 1 };
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
  }, [user.id, activeChat]);

  useEffect(() => {
    if (activeChat) {
      loadMessages();
    }
  }, [activeChat]);

  useEffect(() => {
    if (activeChat) {
      const unsubscribe = chatService.subscribeToMessages((payload) => {
        const event = payload.eventType;
        const newMsg = payload.new;
        const oldMsg = payload.old;

        if (event === 'INSERT') {
          const isForGeneral = activeChat.type === 'general' && newMsg.grade_level === activeChat.id && !newMsg.receiver_id;
          const isForPrivate = activeChat.type === 'private' &&
            ((newMsg.sender_id === activeChat.id && newMsg.receiver_id === user.id) ||
              (newMsg.sender_id === user.id && newMsg.receiver_id === activeChat.id));

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
  }, [activeChat, user.id]);

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

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
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

      const counts = {};
      data.forEach(msg => {
        if (msg.receiver_id === user.id) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        } else if (msg.grade_level && !msg.receiver_id) {
          counts[msg.grade_level] = (counts[msg.grade_level] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  const handleSelectChat = (type, id, name) => {
    setActiveChat({ type, id, name });
    window.scrollTo({ top: 0, behavior: 'instant' });
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[id];
      return newCounts;
    });
  };

  const chatCacheRef = useRef({});

  const loadMessages = async () => {
    if (!activeChat) return;
    const cacheKey = `${activeChat.type}_${activeChat.id}`;
    if (chatCacheRef.current[cacheKey]) {
      setMessages(chatCacheRef.current[cacheKey]);
    } else {
      setLoading(true);
    }

    try {
      const data = await chatService.fetchMessages({
        gradeLevel: activeChat.type === 'general' ? activeChat.id : null,
        studentId: activeChat.type === 'private' ? activeChat.id : null,
        isAdmin: true,
        adminId: user.id
      });
      setMessages(data || []);
      chatCacheRef.current[cacheKey] = data || [];

      // Mark as read
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
    // 1. Optimistic Message for 0ms Perceived Latency
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activeChat.type === 'private' ? activeChat.id : null,
      grade_level: activeChat.type === 'general' ? activeChat.id : null,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      is_read: false,
      sender: {
        full_name: profile?.full_name || 'أ. سيد غريب',
        role: 'admin'
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
        receiverId: activeChat.type === 'private' ? activeChat.id : null,
        gradeLevel: activeChat.type === 'general' ? activeChat.id : null,
        content,
        mediaUrl,
        mediaType,
        replyTo
      });

      // Replace optimistic placeholder with confirmed server message
      setMessages(prev => prev.map(m => m.id === tempId ? (realMsg || m) : m));

      // Update cache
      const cacheKey = `${activeChat.type}_${activeChat.id}`;
      if (chatCacheRef.current[cacheKey]) {
        chatCacheRef.current[cacheKey] = chatCacheRef.current[cacheKey].map(m => m.id === tempId ? (realMsg || m) : m);
      }

      // 2. Dispatch notifications to mentioned students reliably
      if (mentions && Array.isArray(mentions) && mentions.length > 0) {
        const senderName = profile?.full_name || 'أ. سيد غريب';
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

  const handleConfirmClearChat = async () => {
    if (!activeChat) return;
    try {
      setIsClearingChat(true);
      await chatService.clearChat({
        type: activeChat.type,
        id: activeChat.id,
        adminId: user.id
      });

      // Instantly clear local state and cache
      setMessages([]);
      const cacheKey = `${activeChat.type}_${activeChat.id}`;
      chatCacheRef.current[cacheKey] = [];

      toast.success(isRTL ? 'تم تنظيف المحادثة بالكامل والبدء من جديد!' : 'Chat cleared successfully!');
    } catch (err) {
      console.error('Error clearing chat:', err);
      toast.error(isRTL ? 'فشل تنظيف المحادثة' : 'Failed to clear chat');
    } finally {
      setIsClearingChat(false);
      setClearChatModalOpen(false);
    }
  };

  const chatParticipants = React.useMemo(() => {
    const list = [{ id: user.id, name: profile?.full_name || 'أ. سيد غريب', role: 'admin' }];
    const seen = new Set([user.id]);
    students.forEach(s => {
      if (s.id && !seen.has(s.id) && s.full_name) {
        seen.add(s.id);
        list.push({ id: s.id, name: s.full_name, role: 'student' });
      }
    });
    messages.forEach(m => {
      if (m.sender_id && !seen.has(m.sender_id) && m.sender?.full_name) {
        seen.add(m.sender_id);
        list.push({ id: m.sender_id, name: m.sender.full_name, role: m.sender.role || 'student' });
      }
    });
    return list;
  }, [students, user.id, profile, messages]);

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

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  // Generate a consistent color for each sender based on their name
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
    if (msg.sender_id === user.id) return profile?.full_name || t('chat_admin_sender');
    return msg.sender?.full_name || t('chat_user');
  };
  const getSenderLabel = (msg) => {
    if (msg.sender_id === user.id) return t('chat_you');
    return null;
  };

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

  return (
    <>
      <div className="flex h-[calc(100dvh-8rem)] md:h-[calc(100vh-80px)] mt-16 md:mt-20 mb-16 md:mb-0 bg-gray-50 dark:bg-slate-900 rounded-none md:rounded-3xl overflow-hidden border-0 md:border border-gray-200 dark:border-slate-800 shadow-xl relative z-10">

      {/* Sidebar */}
      <div className={`w-full lg:w-80 bg-white dark:bg-slate-800 flex flex-col border-l border-gray-200 dark:border-slate-700 shrink-0 transition-transform ${activeChat ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white">{t('chat_sidebar_title')}</h2>
            <button
              onClick={() => navigate('/admin-dashboard')}
              className="p-1.5 px-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title={t('back') || 'لوحة التحكم'}
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              <span>{isRTL ? 'لوحة التحكم' : 'Dashboard'}</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-slate-900 rounded-xl p-1 mb-4 relative">
            <button
              onClick={() => setSidebarTab('general')}
              className={`relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${sidebarTab === 'general' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t('chat_tab_general')}
              {Object.keys(unreadCounts).some(key => grades.some(g => g.id === key)) && (
                <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab('private')}
              className={`relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${sidebarTab === 'private' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {t('chat_tab_private')}
              {unreadCounts.private > 0 && (
                <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Search Box (Only in private chats) */}
          {sidebarTab === 'private' && (
            <div className="relative">
              <Search className="w-4 h-4 absolute top-3 right-3 text-gray-400" />
              <input
                type="text"
                placeholder={t('chat_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          )}
        </div>

        {/* List of Chats */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {sidebarTab === 'general' ? (
            <div className="space-y-6">
              {/* Primary */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">{t('chat_primary_stage')}</h3>
                <div className="space-y-1">
                  {grades.filter(g => g.id.startsWith('primary')).map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => handleSelectChat('general', grade.id, grade.name)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors ${activeChat?.id === grade.id ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeChat?.id === grade.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-slate-700'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">{grade.name}</span>
                      </div>
                      {unreadCounts[grade.id] > 0 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preparatory */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">{t('chat_prep_stage')}</h3>
                <div className="space-y-1">
                  {grades.filter(g => g.id.startsWith('prep')).map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => handleSelectChat('general', grade.id, grade.name)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors ${activeChat?.id === grade.id ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeChat?.id === grade.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-slate-700'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">{grade.name}</span>
                      </div>
                      {unreadCounts[grade.id] > 0 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Secondary */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">{t('chat_sec_stage')}</h3>
                <div className="space-y-1">
                  {grades.filter(g => g.id.startsWith('sec')).map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => handleSelectChat('general', grade.id, grade.name)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors ${activeChat?.id === grade.id ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeChat?.id === grade.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-slate-700'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">{grade.name}</span>
                      </div>
                      {unreadCounts[grade.id] > 0 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Private Students List */
            <div className="space-y-1">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  {t('chat_no_students')}
                </div>
              ) : (
                filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectChat('private', student.id, student.full_name)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors ${activeChat?.id === student.id ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
                        {student.full_name?.charAt(0) || 'ط'}
                      </div>
                      <div className="text-right min-w-0">
                        <p className="font-bold text-sm truncate">{student.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{student.grade_level ? t(`grade_${student.grade_level}`) : student.email}</p>
                      </div>
                    </div>
                    {unreadCounts[student.id] > 0 && (
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 w-full flex-col bg-[#eef0f3] dark:bg-slate-900 relative ${!activeChat ? 'hidden lg:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-3 sm:px-6 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between z-10 shadow-sm shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 font-bold text-xs shrink-0"
                  title={t('back') || 'رجوع'}
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  <span>{isRTL ? 'رجوع' : 'Back'}</span>
                </button>
                {activeChat.type === 'general' ? (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                    {activeChat.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg truncate">{activeChat.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activeChat.type === 'general' ? t('chat_general_desc') : t('chat_private_desc')}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Clear Chat (تنظيف المحادثة) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setClearChatModalOpen(true)}
                  disabled={messages.length === 0 || isClearingChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold font-arabic transition-all border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                  title={isRTL ? 'تنظيف المحادثة بالكامل ومسح كافة الرسائل السابقة' : 'Clear all messages in this chat'}
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isClearingChat ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRTL ? 'تنظيف المحادثة' : 'Clear Chat'}</span>
                  <span className="sm:hidden">{isRTL ? 'تنظيف' : 'Clear'}</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-4" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundBlendMode: 'overlay' }}>
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

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateDivider && (
                        <div className="flex items-center justify-center my-4 select-none pointer-events-none">
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-xs border bg-white/95 dark:bg-slate-800/95 text-gray-600 dark:text-gray-300 border-gray-200/90 dark:border-slate-700/90 backdrop-blur-md">
                            <Calendar className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                            <span>{formatChatDateDivider(msg.created_at)}</span>
                          </div>
                        </div>
                      )}

                      <FadeIn delay={index * 10} className={`flex items-end ${isMe ? 'justify-end' : 'justify-start'} ${activeMessageOptions === msg.id ? 'relative z-50' : 'relative z-10'}`}>

                      <div 
                        id={`msg-${msg.id}`}
                        className={`max-w-[94%] sm:max-w-[76%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group`}
                      >
                        {/* Quick hover reply button on desktop */}
                        {!msg.is_deleted && (
                          <div 
                            onClick={() => handleReplyClick(msg)}
                            title={t('chat_reply')}
                            className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? '-left-8' : '-right-8'} w-7 h-7 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-0 shadow-xs active:scale-90`}
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
                            ? 'bg-gradient-to-l from-purple-600 to-indigo-600 text-white rounded-tl-none shadow-md'
                            : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-tr-none border border-gray-200 dark:border-slate-700'
                          }`}>

                          {/* Sender Name - Highlighted & Decorated Badge */}
                          {shouldShowSenderName && (() => {
                            const nameColorClasses = [
                              'text-rose-500 dark:text-rose-400', 'text-violet-500 dark:text-violet-400',
                              'text-amber-500 dark:text-amber-400', 'text-emerald-500 dark:text-emerald-400',
                              'text-sky-500 dark:text-sky-400', 'text-pink-500 dark:text-pink-400',
                              'text-indigo-500 dark:text-indigo-400', 'text-teal-500 dark:text-teal-400',
                              'text-orange-500 dark:text-orange-400', 'text-cyan-500 dark:text-cyan-400',
                              'text-lime-500 dark:text-lime-400', 'text-fuchsia-500 dark:text-fuchsia-400',
                            ];
                            return (
                              <div className="flex items-center gap-1.5 mb-2 select-none">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black shadow-xs border ${
                                  isMe
                                    ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/60 text-purple-100 border-purple-400/40 shadow-purple-900/20'
                                    : 'bg-black/10 dark:bg-white/10 text-gray-800 dark:text-gray-100 border-black/5 dark:border-white/10'
                                }`}>
                                  <span className={`tracking-wide font-arabic font-black ${
                                    isMe ? 'text-purple-100' : nameColorClasses[colorIdx]
                                  }`}>
                                    {senderName}
                                  </span>
                                  {isMe && (
                                    <span className="text-[10px] text-amber-300 bg-black/30 px-1.5 py-0.2 rounded-md font-bold border border-amber-400/30">
                                      • {t('chat_admin_sender')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {msg.is_deleted ? (
                            <div className={`flex items-center gap-2 text-sm italic py-1 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                              <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span>{(() => {
                                const isDeletedByAdmin = (msg.deleted_by && msg.deleted_by !== msg.sender_id) || (msg.deleted_by && msg.deleted_by === user.id);
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
                                      ? 'bg-purple-700/60 border-amber-300 text-purple-100'
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
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ps-7 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`} dir="ltr">
                            {msg.is_edited && !msg.is_deleted && <span className="opacity-70">{t('chat_edited')}</span>}
                            <span>{formatMsgTime(msg.created_at)}</span>
                            {isMe && (
                              msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-200" /> : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Options Button - VISIBLE for active messages within 1 hour */}
                          {!msg.is_deleted && isDeletable && (
                            <div className="absolute bottom-1.5 left-1.5 z-20">
                              <button
                                onClick={() => setActiveMessageOptions(activeMessageOptions === msg.id ? null : msg.id)}
                                className={`p-1 rounded-full shadow-xs backdrop-blur-xs transition-all active:scale-90 ${
                                  isMe 
                                    ? 'bg-black/25 hover:bg-black/40 text-purple-100 hover:text-white' 
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

                                  {/* Edit - allowed only for MY text messages or media WITH text within 1 hour */}
                                  {isMe && isDeletable && msg.media_type !== 'audio' && (msg.content || !msg.media_url) && (
                                    <button
                                      onClick={() => handleEditClick(msg)}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-t border-gray-100 dark:border-slate-700"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      <span>{t('chat_edit')}</span>
                                      {!isMe && <span className={`mr-auto text-[10px] text-orange-400 font-bold`}>{t('chat_admin_sender')}</span>}
                                    </button>
                                  )}

                                  {/* Delete - Admin can delete within 1 hour */}
                                  {isDeletable && (
                                    <button
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-slate-700"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>{t('chat_delete')}</span>
                                      {!isMe && <span className={`mr-auto text-[10px] text-orange-400 font-bold`}>{t('chat_admin_sender')}</span>}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      </div>
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
            <ChatInput 
              onSendMessage={handleSendMessage} 
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              participants={chatParticipants}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50">
            <MessageSquare className="w-20 h-20 mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-500">{t('chat_select_to_start')}</h2>
          </div>
        )}
      </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
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
      )}

      {/* Clear Chat Confirmation Modal */}
      <ConfirmModal
        isOpen={clearChatModalOpen}
        onClose={() => !isClearingChat && setClearChatModalOpen(false)}
        onConfirm={handleConfirmClearChat}
        title={isRTL ? 'تنظيف المحادثة بالكامل؟' : 'Clear Entire Chat?'}
        message={
          isRTL
            ? `هل أنت متأكد من رغبتك في تنظيف محادثة "${activeChat?.name || ''}" بالكامل؟ سيتم مسح كافة الرسائل السابقة والصور والوسائط في هذه الغرفة نهائياً من قاعدة البيانات للبدء من جديد.`
            : `Are you sure you want to clear all messages in "${activeChat?.name || ''}"? All previous messages, images, and audio will be permanently deleted from the database to start fresh.`
        }
        confirmText={isClearingChat ? (isRTL ? 'جاري التنظيف...' : 'Clearing...') : (isRTL ? 'نعم، تنظيف المحادثة' : 'Yes, Clear Chat')}
        cancelText={isRTL ? 'إلغاء' : 'Cancel'}
        isDanger={true}
      />
    </>
  );
}
