import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { chatService } from '../../lib/chatService';
import { useAuth } from '../../context/AuthContext';
import { Send, Users, User as UserIcon, Search, Check, CheckCheck, Loader, MessageSquare, FileText, Image as ImageIcon, Play, Pause, MoreVertical, Pencil, Trash2, X, Ban } from 'lucide-react';
import FadeIn from '../../components/FadeIn';
import ChatInput from '../../components/ChatInput';

export default function AdminChat() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  
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
  const messagesEndRef = useRef(null);

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
                setMessages(prev => [...prev, newMsg]);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[id];
      return newCounts;
    });
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await chatService.fetchMessages({
        gradeLevel: activeChat.type === 'general' ? activeChat.id : null,
        studentId: activeChat.type === 'private' ? activeChat.id : null,
        isAdmin: true,
        adminId: user.id
      });
      setMessages(data || []);
      
      // Mark as read
      const unreadIds = data.filter(m => m.sender_id !== user.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await chatService.markAsRead(unreadIds);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async ({ content, mediaUrl, mediaType }) => {
    try {
      await chatService.sendMessage({
        senderId: user.id,
        receiverId: activeChat.type === 'private' ? activeChat.id : null,
        gradeLevel: activeChat.type === 'general' ? activeChat.id : null,
        content,
        mediaUrl,
        mediaType
      });
    } catch (err) {
      console.error('Error sending message:', err);
      throw err; // Re-throw to handle it in ChatInput
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
      await chatService.deleteMessage(messageToDelete);
      setMessageToDelete(null);
    } catch (error) {
      console.error(error);
      alert('خطأ أثناء حذف الرسالة');
    }
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
    if (msg.sender_id === user.id) return profile?.full_name || 'الإدارة';
    return msg.sender?.full_name || 'مستخدم';
  };
  const getSenderLabel = (msg) => {
    if (msg.sender_id === user.id) return 'أنت';
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gray-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-xl">
      
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-800 flex flex-col border-l border-gray-200 dark:border-slate-700 shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white mb-4">المحادثات</h2>
          
          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-slate-900 rounded-xl p-1 mb-4 relative">
            <button
              onClick={() => setSidebarTab('general')}
              className={`relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${sidebarTab === 'general' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              عامة
              {Object.keys(unreadCounts).some(key => grades.some(g => g.id === key)) && (
                <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab('private')}
              className={`relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${sidebarTab === 'private' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              خاصة
              {Object.keys(unreadCounts).some(key => !grades.some(g => g.id === key)) && (
                <span className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {sidebarTab === 'private' && (
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ابحث عن طالب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {sidebarTab === 'general' && (
            <div className="space-y-6">
              {/* Primary */}
              <div>
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">المرحلة الابتدائية</h3>
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
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">المرحلة الإعدادية</h3>
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
                <h3 className="px-3 text-xs font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">المرحلة الثانوية</h3>
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
          )}

          {sidebarTab === 'private' && (
            <div>
              <div className="space-y-1">
                {filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectChat('private', student.id, student.full_name || 'طالب')}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors relative ${activeChat?.id === student.id ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {student.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="text-right flex-1 min-w-0 pr-2">
                      <h4 className="font-bold text-sm truncate">{student.full_name || 'بدون اسم'}</h4>
                      {student.grade_level && <p className="text-xs opacity-70 truncate">{t(`grade_${student.grade_level}`)}</p>}
                    </div>
                    {unreadCounts[student.id] > 0 && (
                      <span className="absolute left-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    )}
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">لا يوجد طلاب مطابقين</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5] dark:bg-slate-900 relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4 z-10 shadow-sm shrink-0">
              {activeChat.type === 'general' ? (
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {activeChat.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">{activeChat.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeChat.type === 'general' ? 'محادثة عامة لكل طلاب الصف' : 'محادثة خاصة'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundBlendMode: 'overlay' }}>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === user.id;
                  const prevMsg = messages[index - 1];
                  const nextMsg = messages[index + 1];
                  const showAvatar = !isMe && (!nextMsg || nextMsg.sender_id !== msg.sender_id);
                  const isFirstInGroup = index === 0 || prevMsg?.sender_id !== msg.sender_id;
                  const isDeletable = (new Date() - new Date(msg.created_at)) < 60 * 60 * 1000;
                  const colorIdx = getSenderColorIndex(msg.sender_id);
                  const senderName = getSenderName(msg);
                  const senderInitial = senderName.charAt(0);
                  
                  return (
                    <FadeIn key={msg.id} delay={index * 10} className={`flex items-end gap-2 ${
                      isMe ? 'justify-end' : 'justify-start'
                    } ${activeMessageOptions === msg.id ? 'relative z-50' : 'relative z-10'}`}>

                      {/* Avatar for others (WhatsApp style - bottom aligned) */}
                      {!isMe && (
                        <div className="shrink-0 w-8 h-8 mb-0.5">
                          {showAvatar ? (
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                              {senderInitial}
                            </div>
                          ) : (
                            <div className="w-8 h-8" />
                          )}
                        </div>
                      )}

                      <div className={`max-w-[68%] flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}>
                        <div className={`rounded-2xl px-3 py-2 shadow-sm relative group transition-all ${
                          activeMessageOptions === msg.id ? 'z-50' : 'z-10'
                        } ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-br-sm' 
                            : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-100 dark:border-slate-700'
                        }`}>

                          {/* Sender Name - professional badge style */}
                          {isFirstInGroup && (() => {
                            const nameBgColors = [
                              'rgba(244,63,94,0.18)','rgba(139,92,246,0.18)','rgba(251,191,36,0.18)','rgba(16,185,129,0.18)',
                              'rgba(14,165,233,0.18)','rgba(236,72,153,0.18)','rgba(99,102,241,0.18)','rgba(20,184,166,0.18)',
                              'rgba(249,115,22,0.18)','rgba(6,182,212,0.18)','rgba(132,204,22,0.18)','rgba(217,70,239,0.18)',
                            ];
                            const nameFgColors = [
                              '#fb7185','#a78bfa','#fbbf24','#34d399',
                              '#38bdf8','#f472b6','#818cf8','#2dd4bf',
                              '#fb923c','#22d3ee','#a3e635','#e879f9',
                            ];
                            return (
                              <div className={`flex items-center gap-2 mb-2 pb-2 ${
                                isMe 
                                  ? 'border-b border-blue-400/30' 
                                  : 'border-b border-gray-200 dark:border-slate-600/70'
                              }`}>
                                <span
                                  className="text-[12px] font-extrabold tracking-wide font-arabic px-2.5 py-0.5 rounded-full"
                                  style={isMe ? {
                                    background: 'rgba(255,255,255,0.15)',
                                    color: '#bfdbfe',
                                  } : {
                                    background: nameBgColors[colorIdx],
                                    color: nameFgColors[colorIdx],
                                  }}
                                >
                                  {senderName}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] text-blue-300/70">• أنت</span>
                                )}
                              </div>
                            );
                          })()}

                          {msg.is_deleted ? (
                            <div className={`flex items-center gap-2 text-sm italic py-1 ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                              <Ban className="w-3.5 h-3.5" />
                              <span>تم حذف هذه الرسالة</span>
                            </div>
                          ) : (
                            <>
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
                                        <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>ملف مرفق</p>
                                        <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>اضغط للفتح</p>
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
                                      إلغاء
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(msg.id)}
                                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                    >
                                      حفظ
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                msg.content && msg.media_type !== 'audio' && (
                                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                                )
                              )}
                            </>
                          )}

                          {/* Timestamp + read receipt */}
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`} dir="ltr">
                            {msg.is_edited && !msg.is_deleted && <span className="opacity-70">(معدلة)</span>}
                            <span>{new Date(msg.created_at).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-200" /> : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Options Button - Admin controls ALL messages within 1h */}
                          {!msg.is_deleted && isDeletable && (
                            <div className={`absolute top-1 ${isMe ? 'left-1' : 'right-1'} transition-opacity ${activeMessageOptions === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button
                                onClick={() => setActiveMessageOptions(activeMessageOptions === msg.id ? null : msg.id)}
                                className={`p-1 rounded-full transition-colors ${isMe ? 'text-blue-100 hover:text-white hover:bg-blue-700/50' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                title="خيارات الرسالة"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              
                              {activeMessageOptions === msg.id && (
                                <div className={`absolute mt-1 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden ${isMe ? 'left-0' : 'right-0'}`}>
                                  {/* Edit - only for text messages */}
                                  {!msg.media_url && (
                                    <button
                                      onClick={() => handleEditClick(msg)}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      <span>تعديل</span>
                                      {!isMe && <span className="mr-auto text-[10px] text-orange-400 font-bold">إدارة</span>}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-slate-700"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>حذف</span>
                                    {!isMe && <span className="mr-auto text-[10px] text-orange-400 font-bold">إدارة</span>}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Spacer for my messages side (no avatar) */}
                      {isMe && <div className="w-8 shrink-0" />}
                    </FadeIn>
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
            <ChatInput onSendMessage={handleSendMessage} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50">
            <MessageSquare className="w-20 h-20 mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-500">اختر محادثة للبدء</h2>
          </div>
        )}
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
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-arabic">حذف الرسالة</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">هل أنت متأكد من حذف هذه الرسالة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setMessageToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl text-white bg-red-600 hover:bg-red-700 font-bold transition-colors"
              >
                حذف
              </button>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}
