-- إضافة عمود is_deleted لمعرفة الرسائل المحذوفة
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
