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

-- صلاحيات جدول profiles خالية من أي استدعاء ذاتي (Recursion Loop)
CREATE OR REPLACE FUNCTION public.is_admin_or_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND (role IN ('admin', 'teacher') OR email = '41147332a@gmail.com')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_teacher() TO authenticated, anon;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin update all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admin insert" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;

CREATE POLICY "Public profiles viewable by everyone"
ON public.profiles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can update own profile or admin update all"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_admin_or_teacher())
WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_teacher());

CREATE POLICY "Users can insert own profile or admin insert"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_teacher());

CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin_or_teacher());

-- ==============================================================================
-- 4. دعم تحديد طلاب معينين في الحصص التجريبية المجانية (trial_sessions)
-- ==============================================================================
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'grade';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_ids UUID[] DEFAULT '{}';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_names TEXT[] DEFAULT '{}';

-- ==============================================================================
-- 5. إصلاح دالة تصحيح وتسليم الامتحانات (submit_quiz) لدعم أسئلة الصح والخطأ تلقائياً
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_quiz(p_quiz_id UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_total_marks INT := 0;
    v_score INT := 0;
    v_question_id TEXT;
    v_selected_index INT;
    v_correct_index INT;
    v_q_marks INT;
    v_q_type VARCHAR(20);
    v_submission_id UUID;
    v_already_submitted BOOLEAN;
    v_has_essay BOOLEAN := FALSE;
    v_answer_text TEXT;
BEGIN
    v_student_id := auth.uid();
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be logged in.';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.quiz_submissions 
        WHERE quiz_submissions.quiz_id = p_quiz_id 
        AND quiz_submissions.student_id = v_student_id
    ) INTO v_already_submitted;

    IF v_already_submitted THEN
        RAISE EXCEPTION 'لقد قمت بأداء هذا الامتحان مسبقاً.';
    END IF;

    FOR v_question_id, v_q_marks, v_correct_index, v_q_type IN
        SELECT id::TEXT, marks, correct_option_index, question_type 
        FROM public.quiz_questions 
        WHERE public.quiz_questions.quiz_id = p_quiz_id
    LOOP
        v_total_marks := v_total_marks + COALESCE(v_q_marks, 1);
        
        IF v_q_type = 'essay' THEN
            v_has_essay := TRUE;
        ELSIF v_q_type = 'true_false' THEN
            v_answer_text := TRIM(p_answers->>v_question_id);
            IF v_answer_text IS NOT NULL THEN
                IF v_answer_text IN ('0', 'صواب', 'صح', 'true', 'True') THEN
                    v_selected_index := 0;
                ELSIF v_answer_text IN ('1', 'خطأ', 'غلط', 'false', 'False') THEN
                    v_selected_index := 1;
                ELSIF v_answer_text ~ '^[0-9]+$' THEN
                    v_selected_index := v_answer_text::INT;
                ELSE
                    v_selected_index := -1;
                END IF;

                IF v_selected_index = v_correct_index THEN
                    v_score := v_score + COALESCE(v_q_marks, 1);
                END IF;
            END IF;
        ELSE -- multiple_choice or NULL
            v_answer_text := TRIM(p_answers->>v_question_id);
            IF v_answer_text IS NOT NULL AND v_answer_text ~ '^[0-9]+$' THEN
                v_selected_index := v_answer_text::INT;
                IF v_selected_index = v_correct_index THEN
                    v_score := v_score + COALESCE(v_q_marks, 1);
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF v_total_marks = 0 THEN
        RAISE EXCEPTION 'هذا الامتحان لا يحتوي على أسئلة.';
    END IF;

    INSERT INTO public.quiz_submissions (
        quiz_id, 
        student_id, 
        answers, 
        score, 
        total_marks, 
        status
    ) VALUES (
        p_quiz_id, 
        v_student_id, 
        p_answers, 
        v_score, 
        v_total_marks, 
        CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END
    )
    RETURNING id INTO v_submission_id;

    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'score', v_score,
        'total_marks', v_total_marks,
        'status', CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END,
        'percentage', ROUND((v_score::NUMERIC / v_total_marks::NUMERIC) * 100)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz(UUID, JSONB) TO authenticated;

-- تصحيح الامتحانات السابقة المسجلة كمعلقة بالخطأ وهي لا تحتوي على أسئلة مقالية
UPDATE public.quiz_submissions sub
SET status = 'completed'
WHERE sub.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    WHERE qq.quiz_id = sub.quiz_id AND qq.question_type = 'essay'
  );

-- ==============================================================================
-- 6. دعم الحصص الفردية والخاصة للطلاب في المواعيد الأسبوعية (weekly_schedules)
-- ==============================================================================
ALTER TABLE public.weekly_schedules ALTER COLUMN grade_level DROP NOT NULL;
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'grade';
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_student_id UUID;
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_student_name TEXT;

-- ==============================================================================
-- 7. ضبط باقات الحصص الأونلاين للطلاب (live_subscriptions) وقيد فريد لمنع التعارض
-- ==============================================================================
-- حذف أي صفوف مكررة لنفس الطالب إن وُجدت
DELETE FROM public.live_subscriptions a USING public.live_subscriptions b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- إضافة قيد فريد على user_id لتسهيل التحديث التلقائي والخصم
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_subscriptions_user_id_key'
    ) THEN
        ALTER TABLE public.live_subscriptions ADD CONSTRAINT live_subscriptions_user_id_key UNIQUE (user_id);
    END IF;
END $$;
