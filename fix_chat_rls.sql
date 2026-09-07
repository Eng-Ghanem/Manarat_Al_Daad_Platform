-- 1. التأكد من وجود الأعمدة اللازمة في الجدول
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- 2. تفعيل الـ RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. مسح السياسات القديمة
DROP POLICY IF EXISTS "Users can update their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can update any chat message" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;

-- 4. السماح للمستخدم بتعديل وحذف رسالته الخاصة
CREATE POLICY "Users can update their own chat messages" ON chat_messages FOR UPDATE USING (
    auth.uid() = sender_id
);

-- 5. السماح للإدارة بتعديل أو حذف أي رسالة
CREATE POLICY "Admins can update any chat message" ON chat_messages FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
