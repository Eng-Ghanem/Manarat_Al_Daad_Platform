-- ==============================================================================
-- مَنَارَةُ الضَّادِ - سكريبت إصلاح تحذيرات الأمان في Supabase Advisors
-- 1. حل مشكلة (Security Definer View [CRITICAL] في public.student_quiz_questions)
-- 2. حل تحذيرات (Auth RLS Initialization Plan) لتسريع الاستعلامات
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
