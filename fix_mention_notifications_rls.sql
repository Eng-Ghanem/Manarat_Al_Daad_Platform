-- =========================================================================
-- 1. إضافة عمود الردود (reply_to) في جدول chat_messages إذا لم يكن موجوداً
-- =========================================================================
ALTER TABLE IF EXISTS public.chat_messages 
ADD COLUMN IF NOT EXISTS reply_to JSONB DEFAULT NULL;

-- =========================================================================
-- 2. السماح للمستخدمين (الطلاب والمعلمين) بإرسال إشعارات المنشن (chat_mention)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can insert chat mentions" ON public.notifications;
CREATE POLICY "Authenticated users can insert chat mentions" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
    type = 'chat_mention' OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);
