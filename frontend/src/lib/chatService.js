import { supabase } from './supabase';

export const chatService = {
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
    return data;
  },

  // Send a message
  async sendMessage({ senderId, receiverId = null, gradeLevel = null, content, mediaUrl = null, mediaType = null }) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          grade_level: gradeLevel,
          content,
          media_url: mediaUrl,
          media_type: mediaType
        }
      ])
      .select(`
        *,
        sender:profiles!chat_messages_sender_id_fkey(full_name, role)
      `)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }
    return data;
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
    return data;
  },

  // Delete a message
  async deleteMessage(messageId, userId) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_deleted: true, deleted_by: userId })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
    return true;
  },

  // Subscribe to real-time message changes (INSERT, UPDATE, DELETE)
  subscribeToMessages(callback) {
    const subscription = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
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

  // Upload media file to Supabase Storage
  async uploadMedia(file, path) {
    const fileExt = file.name.split('.').pop();
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
  }
};
