-- ==============================================================================
-- مَنَارَةُ الضَّادِ - سكريبت الإصلاح الشامل للمنصة (قواعد البيانات والصلاحيات)
-- قم بنسخ هذا الكود بالكامل ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New Query ثم اضغط Run
-- ==============================================================================

-- ==============================================================================
-- 0. إصلاح حاسم: إزالة التكرار اللانهائي (Infinite Recursion) واستعادة ظهور الأسماء والبيانات فوراً في profiles
-- يحل مشكلة اختفاء الاسم ورقم الهاتف والصف وظهور البريد الإلكتروني فقط في الحساب
-- ==============================================================================

-- 1. دالة التحقق من رتبة الإدارة أو المعلمين كـ SECURITY DEFINER (تمنع الاستدعاء الذاتي تماماً)
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

-- 2. تفعيل RLS على جدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. حذف السياسة المسببة للمشكلة "Admins full access on profiles" وجميع السياسات المتعارضة
DROP POLICY IF EXISTS "Admins full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile or Admins can update all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin update all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admin insert" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- 4. سياسات RLS الجديدة السليمة والخالية من التكرار 100%:
-- أ. القراءة: متاحة للجميع (المصادقين والزوار) لعرض أسماء الطلاب ولوحة الشرف والإعدادات
CREATE POLICY "Public profiles viewable by everyone"
ON public.profiles FOR SELECT
TO authenticated, anon
USING (true);

-- ب. التعديل: الطالب يعدل بياناته، والإدارة تعدل أي حساب
CREATE POLICY "Users can update own profile or admin update all"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_admin_or_teacher())
WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_teacher());

-- ج. الإضافة: الطالب يضيف حسابه أو الإدارة
CREATE POLICY "Users can insert own profile or admin insert"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_teacher());

-- د. الحذف: المشرفون فقط
CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin_or_teacher());

-- 5. تحديث دالة تريجر إنشاء البروفايل لتسجيل وحفظ كافة البيانات تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, gender, grade_level)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Student'), 
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'phone_number', new.raw_user_meta_data->>'phone', new.phone),
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'grade_level'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
    grade_level = COALESCE(public.profiles.grade_level, EXCLUDED.grade_level);
  RETURN new;
END;
$$;


-- ==============================================================================
-- 1. إصلاح صلاحيات جدول أسئلة الامتحانات (quiz_questions)
-- يتيح للطلاب عرض أسئلة الامتحانات المنشورة ويحمي التعديل للإدارة فقط
-- ==============================================================================
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Admins and teachers view full quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Anyone can view questions of published quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Students can view published quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Admins and teachers full access on quiz_questions" ON public.quiz_questions;

-- الإدارة والمعلمون لهم كامل الصلاحيات
CREATE POLICY "Admins and teachers full access on quiz_questions" 
ON public.quiz_questions 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- الطلاب يمكنهم قراءة أسئلة الامتحانات المنشورة
CREATE POLICY "Students can view published quiz questions" 
ON public.quiz_questions 
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = quiz_questions.quiz_id 
        AND quizzes.is_published = TRUE
    )
);

-- ==============================================================================
-- 2. تحديث View أسئلة الطلاب (student_quiz_questions) بدون عمود الإجابة الصحيحة
-- تفعيل security_invoker = true لحل تنبيه الأمان الحرج (Security Definer View) في Supabase
-- ==============================================================================
CREATE OR REPLACE VIEW public.student_quiz_questions
WITH (security_invoker = true) AS
SELECT id, quiz_id, question_type, text, options, marks, created_at
FROM public.quiz_questions;

ALTER VIEW IF EXISTS public.student_quiz_questions SET (security_invoker = true);

GRANT SELECT ON public.student_quiz_questions TO authenticated;
GRANT SELECT ON public.student_quiz_questions TO anon;

-- ==============================================================================
-- 3. دالة آمنة ومباشرة لجلب أسئلة الامتحان للطالب (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_student_quiz_questions(p_quiz_id UUID)
RETURNS TABLE (
    id UUID,
    quiz_id UUID,
    question_type TEXT,
    text TEXT,
    options JSONB,
    marks INT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = p_quiz_id 
        AND (quizzes.is_published = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')))
    ) THEN
        RAISE EXCEPTION 'هذا الامتحان غير متاح حالياً.';
    END IF;

    RETURN QUERY
    SELECT 
        q.id,
        q.quiz_id,
        COALESCE(q.question_type, 'multiple_choice')::TEXT,
        q.text,
        q.options,
        COALESCE(q.marks, 1)::INT,
        q.created_at
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_quiz_questions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_quiz_questions(UUID) TO anon;

-- ==============================================================================
-- 4. إصلاح صلاحيات جدول الاشتراكات (subscriptions)
-- حل مشكلة عدم القدرة على تغيير حالة الاشتراك أو تمديده أو حذفه
-- ==============================================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- إضافة عمود تاريخ الانتهاء إذا لم يكن موجوداً
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- تحديث قيد التحقق للحالات ليشمل: pending, active, rejected, expired
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('pending', 'active', 'rejected', 'expired'));

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins full access on subscriptions" ON public.subscriptions;

-- الإدارة لها كامل الصلاحيات (قراءة، تعديل، حذف، إضافة)
CREATE POLICY "Admins full access on subscriptions" 
ON public.subscriptions 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- المستخدم العادي يرى اشتراكاته فقط
CREATE POLICY "Users can view their own subscriptions" 
ON public.subscriptions 
FOR SELECT 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- المستخدم العادي يرسل طلب اشتراك لنفسه فقط
CREATE POLICY "Users can insert their own subscriptions" 
ON public.subscriptions 
FOR INSERT 
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- ==============================================================================
-- 5. إصلاح صلاحيات جدول حصص الأونلاين (online_sessions)
-- ==============================================================================
ALTER TABLE public.online_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage online sessions." ON public.online_sessions;
DROP POLICY IF EXISTS "Students can view sessions for their grade or global sessions." ON public.online_sessions;
DROP POLICY IF EXISTS "Admins can manage online sessions" ON public.online_sessions;
DROP POLICY IF EXISTS "Students and users can view published sessions" ON public.online_sessions;

-- الإدارة لها كامل الصلاحيات على الحصص
CREATE POLICY "Admins can manage online sessions" 
ON public.online_sessions 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- الطلاب والمستخدمون يشاهدون الحصص المتاحة
CREATE POLICY "Students and users can view published sessions" 
ON public.online_sessions 
FOR SELECT 
TO authenticated
USING (
    grade_level IS NULL 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND (profiles.grade_level = online_sessions.grade_level OR profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- ==============================================================================
-- 6. دالة آمنة لمراجعة إجابات الامتحان بعد التسليم (SECURITY DEFINER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_student_quiz_review(p_quiz_id UUID)
RETURNS TABLE (
    id UUID,
    quiz_id UUID,
    question_type TEXT,
    text TEXT,
    options JSONB,
    correct_option_index INT,
    marks INT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.quiz_submissions 
        WHERE quiz_submissions.quiz_id = p_quiz_id 
        AND quiz_submissions.student_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    ) THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك مراجعة الأسئلة قبل تسليم الامتحان.';
    END IF;

    RETURN QUERY
    SELECT 
        q.id,
        q.quiz_id,
        COALESCE(q.question_type, 'multiple_choice')::TEXT,
        q.text,
        q.options,
        q.correct_option_index,
        COALESCE(q.marks, 1)::INT,
        q.created_at
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_quiz_review(UUID) TO authenticated;

-- ==============================================================================
-- 7. دالة تسليم الامتحان المحسنة (submit_quiz) تدعم المقالي والاختياري
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

-- ==============================================================================
-- 9. جدول المواعيد الأسبوعية الثابتة لكل صف (weekly_schedules)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level TEXT,
    days TEXT[] NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    zoom_link TEXT NOT NULL,
    title TEXT DEFAULT 'الحصة الأسبوعية الثابتة',
    target_type TEXT DEFAULT 'grade',
    target_student_id UUID,
    target_student_name TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.weekly_schedules ALTER COLUMN grade_level DROP NOT NULL;
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'grade';
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_student_id UUID;
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS target_student_name TEXT;


ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active weekly schedules" ON public.weekly_schedules;
CREATE POLICY "Anyone can view active weekly schedules"
ON public.weekly_schedules FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Admins full control on weekly_schedules" ON public.weekly_schedules;
CREATE POLICY "Admins full control on weekly_schedules"
ON public.weekly_schedules FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- ==============================================================================
-- 10. جدول باقات الحصص الأونلاين للطلاب (live_subscriptions - 8 حصص مقدماً)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.live_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grade_level TEXT,
    total_sessions INT DEFAULT 8,
    remaining_sessions INT DEFAULT 8,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
    payment_method TEXT,
    wallet_number TEXT,
    receipt_url TEXT,
    price NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    activated_at TIMESTAMPTZ
);

ALTER TABLE public.live_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own live subscriptions" ON public.live_subscriptions;
CREATE POLICY "Students can view their own live subscriptions"
ON public.live_subscriptions FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students can insert their own live subscriptions" ON public.live_subscriptions;
CREATE POLICY "Students can insert their own live subscriptions"
ON public.live_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins full control on live_subscriptions" ON public.live_subscriptions;
CREATE POLICY "Admins full control on live_subscriptions"
ON public.live_subscriptions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- ==============================================================================
-- 11. جدول الحصص التجريبية المجانية (trial_sessions - 30 دقيقة)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trial_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'حصة تجريبية مجانية',
    description TEXT,
    grade_level TEXT NOT NULL,
    target_type TEXT DEFAULT 'grade',
    target_student_ids UUID[] DEFAULT '{}',
    target_student_names TEXT[] DEFAULT '{}',
    start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    zoom_link TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'canceled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'grade';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_ids UUID[] DEFAULT '{}';
ALTER TABLE public.trial_sessions ADD COLUMN IF NOT EXISTS target_student_names TEXT[] DEFAULT '{}';

ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view trial sessions" ON public.trial_sessions;
CREATE POLICY "Anyone can view trial sessions"
ON public.trial_sessions FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Admins full control on trial_sessions" ON public.trial_sessions;
CREATE POLICY "Admins full control on trial_sessions"
ON public.trial_sessions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- ==============================================================================
-- 12. جدول طلبات ومشاركات الطلاب في الحصص التجريبية (trial_requests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trial_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trial_session_id UUID REFERENCES public.trial_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,
    student_phone TEXT,
    grade_level TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'attended', 'enrolled', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view and insert their trial requests" ON public.trial_requests;
CREATE POLICY "Students can view and insert their trial requests"
ON public.trial_requests FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins full control on trial_requests" ON public.trial_requests;
CREATE POLICY "Admins full control on trial_requests"
ON public.trial_requests FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- ==============================================================================
-- 13. جدول الحصص المكتملة وسجل حضور الطلاب (completed_live_sessions)
-- يسجل الحصص المنتهية والمخصومة من باقة الـ 8 حصص مع التاريخ والتفاصيل
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.completed_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    session_title TEXT NOT NULL DEFAULT 'حصة أونلاين مباشرة',
    session_type TEXT DEFAULT 'package',
    completed_at TIMESTAMPTZ DEFAULT now(),
    teacher_notes TEXT DEFAULT 'تم حضور الحصة واكتمالها بنجاح',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.completed_live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own completed sessions" ON public.completed_live_sessions;
CREATE POLICY "Students can view their own completed sessions"
ON public.completed_live_sessions FOR SELECT
TO authenticated
USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins full control on completed_live_sessions" ON public.completed_live_sessions;
CREATE POLICY "Admins full control on completed_live_sessions"
ON public.completed_live_sessions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- ==============================================================================
-- 14. تفعيل التزامن اللحظي المباشر لباقات واشتراكات وحضور الطلاب عبر Supabase Realtime
-- وقيد فريد لمنع تكرار سجل اشتراك الطالب الواحد
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_subscriptions_user_id_key'
    ) THEN
        ALTER TABLE public.live_subscriptions ADD CONSTRAINT live_subscriptions_user_id_key UNIQUE (user_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_subscriptions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.completed_live_sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_schedules;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trial_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 15. السماح للطلاب بتحديث اشتراكهم في باقة الـ 8 حصص (للتجديد وإعادة إرسال الطلبات)
-- وتصريح RLS كامل لـ live_subscriptions لضمان قبول عمليات upsert و update
-- ==============================================================================
DROP POLICY IF EXISTS "Students can update their own live subscriptions" ON public.live_subscriptions;
CREATE POLICY "Students can update their own live subscriptions"
ON public.live_subscriptions FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));



