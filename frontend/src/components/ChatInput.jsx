import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Paperclip, Mic, Square, X, Image as ImageIcon, FileText, Loader } from 'lucide-react';
import { chatService } from '../lib/chatService';

export default function ChatInput({ onSendMessage }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
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
        mediaType
      });

      setMessage('');
      clearMedia();
    } catch (err) {
      console.error('Submit error:', err);
      alert(t('chat_send_error'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-5 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shrink-0 sticky bottom-0 z-30 shadow-lg">
      
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
