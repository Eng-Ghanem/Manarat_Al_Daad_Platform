import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Paperclip, Mic, Square, X, Image as ImageIcon, FileText, Loader, Reply, AtSign } from 'lucide-react';
import { chatService } from '../lib/chatService';

export default function ChatInput({ onSendMessage, replyingTo = null, onCancelReply = null, participants = [] }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const attachMenuRef = useRef(null);
  const mentionMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(event.target)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    setShowAttachMenu(false);

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
    } else {
      setMediaPreview('document'); // placeholder for PDF/docs
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setMessage(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\u0600-\u06FF]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(cursor - match[1].length - 1);
    } else {
      setMentionQuery(null);
      setMentionIndex(null);
    }
  };

  const [mentionedUsers, setMentionedUsers] = useState([]);

  const handleSelectMention = (participant) => {
    if (mentionIndex === null) return;
    const before = message.slice(0, mentionIndex);
    const after = message.slice(mentionIndex + (mentionQuery?.length || 0) + 1);
    // Put @Name on line 1 and newline so user types their message directly underneath
    const newText = `${before}@${participant.name}\n${after}`;
    setMessage(newText);
    setMentionedUsers(prev => {
      if (prev.some(p => p.id === participant.id)) return prev;
      return [...prev, participant];
    });
    setMentionQuery(null);
    setMentionIndex(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = (before + `@${participant.name}\n`).length;
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
  };

  const filteredParticipants = mentionQuery !== null && Array.isArray(participants)
    ? participants.filter(p => p && p.name && p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(isRTL ? 'الميكروفون غير مدعوم في هذا المتصفح' : 'Microphone not supported on this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const actualType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const ext = actualType.includes('mp4') ? 'mp4' : actualType.includes('aac') ? 'aac' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        const file = new File([audioBlob], `voice-note.${ext}`, { type: actualType });
        setMediaFile(file);
        setMediaPreview('audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert(t('chat_mic_permission_denied') || (isRTL ? 'يرجى السماح بالوصول إلى الميكروفون' : 'Please allow microphone access'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !mediaFile) || isUploading) return;

    setIsUploading(true);
    let mediaUrl = null;
    let mediaType = null;

    try {
      if (mediaFile) {
        mediaUrl = await chatService.uploadMedia(mediaFile, 'chat_media');
        
        if (mediaFile.type.startsWith('image/')) mediaType = 'image';
        else if (mediaFile.type.startsWith('video/')) mediaType = 'video';
        else if (mediaFile.type.startsWith('audio/')) mediaType = 'audio';
        else mediaType = 'document';
      }

      const finalContent = message.trim() || null;

      await onSendMessage({
        content: finalContent,
        mediaUrl,
        mediaType,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          sender_name: replyingTo.sender_name,
          content: replyingTo.content || '',
          media_type: replyingTo.media_type || null
        } : null,
        mentions: mentionedUsers
      });

      setMessage('');
      clearMedia();
      setMentionQuery(null);
      setMentionedUsers([]);
      if (onCancelReply) onCancelReply();
    } catch (err) {
      console.error('Submit error:', err);
      alert(t('chat_send_error'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-5 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shrink-0 sticky bottom-0 z-30 shadow-lg">
      
      {/* Replying Preview Bar */}
      {replyingTo && (
        <div className="max-w-4xl mx-auto mb-2.5 px-3.5 py-2 bg-blue-50/90 dark:bg-slate-900/90 rounded-2xl border-s-4 border-blue-600 flex items-center justify-between shadow-xs transition-all animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Reply className="w-4 h-4 rtl:-scale-x-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('chat_replying_to')}</span>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 truncate">{replyingTo.sender_name}</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 truncate mt-0.5">
                {replyingTo.media_type ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {replyingTo.media_type === 'image' && '📷 ' + t('chat_photo')}
                    {replyingTo.media_type === 'audio' && '🎤 ' + t('chat_voice')}
                    {replyingTo.media_type === 'video' && '🎥 ' + t('chat_video')}
                    {replyingTo.media_type === 'document' && '📄 ' + t('chat_doc')}
                    {replyingTo.content ? ` • ${replyingTo.content}` : ''}
                  </span>
                ) : (
                  replyingTo.content || ''
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            title={t('chat_cancel_reply')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Media Preview Area */}
      {mediaFile && mediaPreview !== 'audio' && (
        <div className="max-w-4xl mx-auto mb-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 flex items-start gap-4 relative">
          <button 
            type="button" 
            onClick={clearMedia}
            className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {mediaPreview === 'document' ? (
            <div className="flex items-center gap-3 p-2">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{mediaFile.name}</p>
                <p className="text-xs text-gray-500">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          ) : mediaFile.type?.startsWith('video/') ? (
            <video src={mediaPreview} controls className="max-h-32 rounded-xl border border-gray-200" />
          ) : (
            <img src={mediaPreview} alt="Preview" className="max-h-32 rounded-xl border border-gray-200 object-contain" />
          )}
        </div>
      )}

      {/* Audio Preview (WhatsApp Style) */}
      {mediaFile && mediaPreview === 'audio' && (
        <div className="max-w-4xl mx-auto flex items-center gap-4 w-full p-2 bg-gray-50 dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <button 
            type="button" 
            onClick={clearMedia}
            disabled={isUploading}
            className="w-10 h-10 shrink-0 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center bg-white dark:bg-slate-800 rounded-full px-4 py-2 border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <audio src={URL.createObjectURL(mediaFile)} controls controlsList="nodownload noplaybackrate" className="h-10 w-full" />
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={handleSubmit}
            className="w-12 h-12 shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:-translate-y-1"
          >
            {isUploading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-1 rtl:ml-0 rtl:-mr-1" />}
          </button>
        </div>
      )}

      {/* Recording UI */}
      {isRecording && (
        <div className="max-w-4xl mx-auto mb-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
            <span className="font-bold font-mono text-lg tracking-wider">{formatTime(recordingTime)}</span>
            <span className="text-sm">{t('chat_recording')}</span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            <Square className="w-5 h-5 fill-current" />
            <span className="font-bold text-sm">{t('chat_stop')}</span>
          </button>
        </div>
      )}

      {/* Input Row */}
      {(!mediaFile || mediaPreview !== 'audio') && !isRecording && (
        <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
          
          {/* Mentions Dropdown Menu */}
          {mentionQuery !== null && filteredParticipants.length > 0 && (
            <div 
              ref={mentionMenuRef}
              className={`absolute bottom-full mb-3 ${isRTL ? 'right-2' : 'left-2'} w-72 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 p-1.5 divide-y divide-gray-100 dark:divide-slate-700/50 animate-in fade-in slide-in-from-bottom-2`}
            >
              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1 font-arabic">
                  <AtSign className="w-3 h-3 text-blue-500" />
                  <span>إشارة إلى عضو أو معلم</span>
                </span>
                <span className="text-[9px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{filteredParticipants.length}</span>
              </div>
              <div className="pt-1 space-y-0.5">
                {filteredParticipants.slice(0, 10).map((p) => (
                  <button
                    key={p.id || p.name}
                    type="button"
                    onClick={() => handleSelectMention(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors text-right"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate font-arabic">{p.name}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.role === 'admin' ? 'معلم خبير / الإدارة' : 'طالب'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attach Menu */}
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <Paperclip className="w-6 h-6" />
            </button>
            
            {showAttachMenu && (
              <div className={`absolute bottom-14 ${isRTL ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 py-2 w-48 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2`}>
                <button
                  type="button"
                  onClick={() => { fileInputRef.current.accept = "image/*,video/*"; fileInputRef.current.click(); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm">{t('chat_attach_media')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx"; fileInputRef.current.click(); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm">{t('chat_attach_doc')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />

          <div className="flex-1 bg-gray-100 dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextChange}
              placeholder={t('chat_input_ph')}
              className="w-full max-h-32 min-h-[48px] bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-500 resize-none py-3.5 px-5 text-sm sm:text-base leading-relaxed"
              rows={1}
              disabled={isUploading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>

          {message.trim() || mediaFile ? (
            <button
              type="submit"
              disabled={isUploading}
              className="w-12 h-12 shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1"
            >
              {isUploading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-1 rtl:ml-0 rtl:-mr-1" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="w-12 h-12 shrink-0 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center transition-all shadow-sm"
            >
              <Mic className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </form>
  );
}
