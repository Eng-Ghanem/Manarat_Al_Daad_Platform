-- ======================================================================================
-- مَنَارَةُ الضَّادِ - حزمة الأمان الشاملة لقواعد البيانات (Master Security Hardening)
-- ======================================================================================

-- 1. حماية الملفات الشخصية (Profiles Table Protection)
-- منع أي طالب أو مستخدم عادي من الترقية الذاتية لرتبة أدمن أو تعديل رصيد الـ XP
CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا كان التحديث قادماً من مستخدم عادي يعدل ملفه بنفسه
    IF (auth.uid() = OLD.id) AND (OLD.role != 'admin') THEN
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            RAISE EXCEPTION 'أمني: غير مصرح لك بتغيير الصلاحيات أو الرتبة!';
        END IF;
        IF (NEW.xp_points IS DISTINCT FROM OLD.xp_points) THEN
            RAISE EXCEPTION 'أمني: غير مصرح لك بتعديل رصيد النقاط يدوياً!';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_profile_sensitive_fields();

-- 2. حماية الاشتراكات (Subscriptions Table Protection)
-- منع التفعيل الذاتي؛ أي اشتراك جديد يُضاف بواسطة الطالب يجب أن تكون حالته 'pending'
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON subscriptions 
FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND (status = 'pending' OR status IS NULL)
);

-- 3. حماية الشات (Chat Messages Protection)
-- منع انتحال الشخصيات أو إرسال رسائل باسم مستخدمين آخرين
DROP POLICY IF EXISTS "Users can only send as themselves" ON chat_messages;
CREATE POLICY "Users can only send as themselves" ON chat_messages 
FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

-- 4. حماية سرية إجابات الامتحانات (Quiz Integrity & Anti-Cheat)
-- منع الطلاب من قراءة عمود correct_option_index
DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON quiz_questions;
CREATE POLICY "Admins and teachers view full quiz questions" ON quiz_questions 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

-- إنشاء View آمن للطلاب لا يحتوي على عمود الإجابة الصحيحة
CREATE OR REPLACE VIEW public.student_quiz_questions AS
SELECT id, quiz_id, question_type, text, options, marks, created_at
FROM quiz_questions;

GRANT SELECT ON public.student_quiz_questions TO authenticated;

-- 5. حماية إيصالات الدفع البنكية (Receipts Storage Bucket Protection)
-- تحويل حاوية الإيصالات إلى خاصة لحماية بيانات الطلاب وأرقام الهواتف والتحويلات
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 6. حماية إكمال الدروس (Lesson Progress Protection)
-- منع تسجيل إكمال الدروس لغير المشتركين الفعليين
DROP POLICY IF EXISTS "Users can insert their own progress" ON lesson_progress;
CREATE POLICY "Users can insert their own progress" ON lesson_progress 
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
        EXISTS (
            SELECT 1 FROM lessons l
            JOIN courses c ON c.id = l.course_id
            LEFT JOIN subscriptions s ON s.course_id = c.id AND s.user_id = auth.uid() AND s.status = 'approved'
            WHERE l.id = lesson_progress.lesson_id AND (l.is_free_preview = true OR s.id IS NOT NULL)
        )
    )
);
