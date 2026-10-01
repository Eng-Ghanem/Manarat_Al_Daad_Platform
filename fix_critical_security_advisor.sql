-- ==============================================================================
-- مَنَارَةُ الضَّادِ - سكريبت إصلاح تحذيرات الأمان في Supabase Advisors
-- 1. حل مشكلة (Security Definer View [CRITICAL] في public.student_quiz_questions)
-- 2. حل تحذيرات (Auth RLS Initialization Plan) لتسريع الاستعلامات
-- 3. تفعيل حفظ رقم الهاتف التلقائي للطلاب الجدد
-- 4. دعم تحديد طلاب معينين في الحصص التجريبية
-- ==============================================================================

-- 1. إصلاح الـ View وجعلها تعمل بـ security_invoker = true
-- هذا السطر وحده يحل مشكلة الـ CRITICAL فوراً!
ALTER VIEW IF EXISTS public.student_quiz_questions SET (security_invoker = true);

-- إعادة تعريف الـ View للتأكد من خلوها من عمود الإجابة الصحيحة وتفعيل security_invoker
CREATE OR REPLACE VIEW public.student_quiz_questions
WITH (security_invoker = true) AS
SELECT id, quiz_id, question_type, text, options, marks, created_at
FROM public.quiz_questions;

GRANT SELECT ON public.student_quiz_questions TO authenticated;
GRANT SELECT ON public.student_quiz_questions TO anon;

-- ==============================================================================
-- 2. حل تحذيرات الأداء (Auth RLS Initialization Plan) لجميع الجداول الظاهرة في القائمة
-- استبدال auth.uid() المباشرة بـ (SELECT auth.uid()) لمنع إعادة الفحص لكل صف
-- ==============================================================================

-- A. جدول الكورسات (courses)
DROP POLICY IF EXISTS "Admins can view all courses." ON public.courses;
CREATE POLICY "Admins can view all courses." ON public.courses FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')));

DROP POLICY IF EXISTS "Admins can manage courses." ON public.courses;
CREATE POLICY "Admins can manage courses." ON public.courses FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')));

-- B. جدول الدروس (lessons)
DROP POLICY IF EXISTS "Admins can manage lessons." ON public.lessons;
CREATE POLICY "Admins can manage lessons." ON public.lessons FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')));

-- C. جدول التسجيلات (enrollments)
DROP POLICY IF EXISTS "Users can view their own enrollments." ON public.enrollments;
CREATE POLICY "Users can view their own enrollments." ON public.enrollments FOR SELECT 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage enrollments." ON public.enrollments;
CREATE POLICY "Admins can manage enrollments." ON public.enrollments FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')));

-- D. جدول تقدم الدروس (lesson_progress)
DROP POLICY IF EXISTS "Users can update their own progress." ON public.lesson_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON public.lesson_progress;
CREATE POLICY "Users can update their own progress." ON public.lesson_progress FOR ALL 
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all progress." ON public.lesson_progress;
CREATE POLICY "Admins can view all progress." ON public.lesson_progress FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')));

-- E. جدول رسائل الشات (chat_messages)
DROP POLICY IF EXISTS "Users can only send as themselves" ON public.chat_messages;
CREATE POLICY "Users can only send as themselves" ON public.chat_messages FOR INSERT 
WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update their own chat messages" ON public.chat_messages FOR UPDATE 
USING (sender_id = (SELECT auth.uid()));

-- ==============================================================================
-- 3. تحديث دالة إنشاء البروفايل للطلاب لضمان حفظ رقم الهاتف والصف الدراسي تلقائياً
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, gender, grade_level)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Student'), 
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'phone_number', new.raw_user_meta_data->>'phone', new.phone),
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'grade_level'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    grade_level = COALESCE(EXCLUDED.grade_level, public.profiles.grade_level);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- صلاحيات كاملة للإدارة على جدول profiles (تعديل وحذف وإضافة بيانات الطلاب)
DROP POLICY IF EXISTS "Admins full access on profiles" ON public.profiles;
CREATE POLICY "Admins full access on profiles"
ON public.profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) 
    AND (p.role IN ('admin', 'teacher') OR p.email = '41147332a@gmail.com')
  )
);

-- ==============================================================================
-- 4. دعم تحديد طلاب معينين في الحصص التجريبية المجانية (trial_sessions)
-- ==============================================================================
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'grade';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_ids UUID[] DEFAULT '{}';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_names TEXT[] DEFAULT '{}';
