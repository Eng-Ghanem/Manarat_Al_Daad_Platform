import { supabase } from './supabase';

export const chatService = {
  // Helper to format/extract reply metadata if embedded
  formatMessage(msg) {
    if (!msg) return msg;
    if (!msg.reply_to && msg.content && typeof msg.content === 'string' && msg.content.startsWith('__REPLY__')) {
      const match = msg.content.match(/^__REPLY__(.*?)__ENDREPLY__\n?([\s\S]*)$/);
      if (match) {
        try {
          msg.reply_to = JSON.parse(match[1]);
          msg.content = match[2];
        } catch (e) {
          console.warn('Failed to parse embedded reply:', e);
        }
      }
    }
    return msg;
  },

  // Fetch messages for a specific general grade chat or private chat
  async fetchMessages({ gradeLevel, studentId, isAdmin, adminId }) {
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        sender:profiles!chat_messages_sender_id_fkey(full_name, role)
      `)
      .order('created_at', { ascending: true });

    if (gradeLevel) {
      // General Chat for a grade
      query = query.eq('grade_level', gradeLevel).is('receiver_id', null);
    } else if (studentId) {
      // Private Chat
      if (isAdmin) {
        // Admin chatting with student
        query = query.or(`and(sender_id.eq.${adminId},receiver_id.eq.${studentId}),and(sender_id.eq.${studentId},receiver_id.eq.${adminId})`);
      } else {
        // Student chatting with admin
        query = query.or(`and(sender_id.eq.${studentId},receiver_id.eq.${adminId}),and(sender_id.eq.${adminId},receiver_id.eq.${studentId})`);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
    return (data || []).map(m => this.formatMessage(m));
  },

  // Send a message
  async sendMessage({ senderId, receiverId = null, gradeLevel = null, content, mediaUrl = null, mediaType = null, replyTo = null }) {
    const payload = {
      sender_id: senderId,
      receiver_id: receiverId,
      grade_level: gradeLevel,
      content,
      media_url: mediaUrl,
      media_type: mediaType
    };

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([payload])
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(full_name, role)
        `)
        .single();

      if (error) {
        // Fallback: If reply_to column does not exist yet on remote schema, embed reply metadata in content so the quote is NEVER lost!
        if (error.message && error.message.includes('reply_to')) {
          delete payload.reply_to;
          if (replyTo) {
            payload.content = `__REPLY__${JSON.stringify(replyTo)}__ENDREPLY__\n${content || ''}`;
          }
          const retryRes = await supabase
            .from('chat_messages')
            .insert([payload])
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey(full_name, role)
            `)
            .single();
          if (retryRes.error) throw retryRes.error;
          return this.formatMessage(retryRes.data);
        }
        throw error;
      }
      return this.formatMessage(data);
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  },

  // Edit a message
  async editMessage(messageId, newContent) {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ content: newContent, is_edited: true })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      console.error('Error editing message:', error);
      throw error;
    }
    return this.formatMessage(data);
  },

  // Delete a message
  async deleteMessage(messageId, userId) {
    const updatePayload = { is_deleted: true };
    if (userId) {
      updatePayload.deleted_by = userId;
    }
    const { error } = await supabase
      .from('chat_messages')
      .update(updatePayload)
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
    return true;
  },

  // Clear all messages in a specific chat (general grade or private student)
  async clearChat({ type, id, adminId }) {
    if (!type || !id) throw new Error('نوع ومعرف المحادثة مطلوبان');

    // 1. Try secure backend admin endpoint
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/admin/chat/clear`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ type, id })
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) return json;
        }
      }
    } catch (backendErr) {
      console.warn('Backend clear chat failed, falling back to direct Supabase query:', backendErr);
    }

    // 2. Direct Supabase query fallback
    if (type === 'general') {
      const { error, count } = await supabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .eq('grade_level', id)
        .is('receiver_id', null);
      if (error) throw error;
      return { success: true, deletedCount: count || 0 };
    } else if (type === 'private') {
      const { error, count } = await supabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .or(`and(sender_id.eq.${adminId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${adminId}),and(receiver_id.eq.${id},grade_level.is.null),and(sender_id.eq.${id},grade_level.is.null)`);
      if (error) throw error;
      return { success: true, deletedCount: count || 0 };
    }

    return { success: true };
  },

  // Subscribe to real-time message changes (INSERT, UPDATE, DELETE)
  subscribeToMessages(callback) {
    const subscription = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.new) {
          payload.new = chatService.formatMessage(payload.new);
        }
        callback(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  },
  
  // Mark messages as read
  async markAsRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return;
    
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .in('id', messageIds);
      
    if (error) {
      console.error('Error marking as read:', error);
    }
  },

  // Upload media file to Supabase Storage with size and type security checks
  async uploadMedia(file, path) {
    if (!file) throw new Error('لا يوجد ملف للرفع');

    // Security validation: File size cap (15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('حجم الملف كبير جداً. الحد الأقصى هو 15 ميجابايت.');
    }

    // Security validation: Disallow dangerous executable/script extensions
    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    const disallowedExts = ['exe', 'bat', 'cmd', 'sh', 'php', 'pl', 'cgi', 'js', 'html', 'htm', 'vbs', 'ps1', 'msi', 'com'];
    if (disallowedExts.includes(fileExt)) {
      throw new Error('نوع هذا الملف غير مسموح به لدواعي الأمان.');
    }

    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat_media')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading media:', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  },

  // Notify mentioned users reliably through authenticated backend (with client-side fallback)
  async notifyMentions({ mentionedUsers, senderName, senderId, messageSnippet, isRTL = true }) {
    if (!mentionedUsers || !Array.isArray(mentionedUsers) || mentionedUsers.length === 0) return;
    const targetIds = mentionedUsers.map(u => (typeof u === 'string' ? u : u.id)).filter(id => id && id !== senderId);
    if (targetIds.length === 0) return;

    // 1. Try backend service-role endpoint (authenticated with user token)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No active user session');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/chat/mention-notify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mentionedUserIds: targetIds,
          senderName,
          senderId,
          messageSnippet,
          isRTL
        })
      });
      if (res.ok) return;
    } catch (err) {
      console.warn('Backend mention notification failed, trying Supabase direct:', err);
    }

    // 2. Fallback to direct client insert
    const notifs = targetIds.map(userId => ({
      user_id: userId,
      title: isRTL ? 'إشارة في المحادثة' : 'Mention in Chat',
      message: isRTL 
        ? `قام ${senderName} بالإشارة إليك في المحادثة: "${(messageSnippet || '').slice(0, 60)}"`
        : `${senderName} mentioned you in the chat: "${(messageSnippet || '').slice(0, 60)}"`,
      type: 'chat_mention',
      link: '/chat'
    }));

    await supabase.from('notifications').insert(notifs).catch(() => {});
  }
};
