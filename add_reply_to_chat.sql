-- إضافة عمود الردود (reply_to) في جدول الرسائل (chat_messages)
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS reply_to JSONB DEFAULT NULL;

-- التأكد من وجود عمود deleted_by وصلاحيات التعديل
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.chat_messages.reply_to IS 'Stores quoted reply message metadata: id, sender_name, content, media_type';
