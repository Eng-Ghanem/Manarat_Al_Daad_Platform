-- ==============================================================================
-- مَنَارَةُ الضَّادِ - الإصلاح الشامل لنظام الامتحانات وحصص الأونلاين
-- قم بنسخ وتشغيل هذا الكود في Supabase Dashboard -> SQL Editor ثم اضغط Run
-- ==============================================================================

-- 1. تفعيل سياسات الأمان لأسئلة الامتحانات (حل مشكلة عدم ظهور الأسئلة للطلاب)
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
        WHERE profiles.id = auth.uid() 
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

-- 2. تحديث View أسئلة الطلاب (student_quiz_questions) بدون الإجابة الصحيحة
CREATE OR REPLACE VIEW public.student_quiz_questions AS
SELECT id, quiz_id, question_type, text, options, marks, created_at
FROM public.quiz_questions;

GRANT SELECT ON public.student_quiz_questions TO authenticated;
GRANT SELECT ON public.student_quiz_questions TO anon;

-- 3. دالة آمنة ومباشرة لجلب أسئلة الامتحان للطالب (SECURITY DEFINER)
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
    -- التأكد من أن الامتحان موجود ومنشور
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

-- 4. دالة آمنة لمراجعة إجابات الامتحان بعد التسليم (SECURITY DEFINER)
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
DECLARE
    v_is_staff BOOLEAN;
    v_has_submitted BOOLEAN;
BEGIN
    -- فحص صلاحية المعلم أو الأدمن
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    ) INTO v_is_staff;

    -- فحص قيام الطالب بتسليم الامتحان مسبقاً
    SELECT EXISTS (
        SELECT 1 FROM public.quiz_submissions 
        WHERE quiz_submissions.quiz_id = p_quiz_id 
        AND quiz_submissions.student_id = auth.uid()
    ) INTO v_has_submitted;

    IF NOT v_is_staff AND NOT v_has_submitted THEN
        RAISE EXCEPTION 'غير مصرح لك بمراجعة إجابات الامتحان قبل تسليمه.';
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

-- 5. تحديث دالة تسليم وتصحيح الامتحانات (submit_quiz) بحقوق كاملة ومؤمنة
DROP FUNCTION IF EXISTS public.submit_quiz(UUID, JSONB);

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
    v_question RECORD;
    v_selected_index INT;
    v_submission_id UUID;
    v_already_submitted BOOLEAN;
    v_has_essay BOOLEAN := FALSE;
    v_answer_text TEXT;
    v_percentage INT := 0;
BEGIN
    -- الحصول على معرف الطالب
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول لتسليم الامتحان.';
    END IF;

    -- التأكد من عدم تكرار أداء الامتحان
    SELECT EXISTS(
        SELECT 1 FROM public.quiz_submissions 
        WHERE quiz_id = p_quiz_id AND student_id = v_student_id
    ) INTO v_already_submitted;

    IF v_already_submitted THEN
        RAISE EXCEPTION 'لقد قمت بأداء هذا الامتحان مسبقاً.';
    END IF;

    -- حساب الدرجات بالمرور على أسئلة الامتحان
    FOR v_question IN
        SELECT id::TEXT AS q_id, marks, correct_option_index, question_type 
        FROM public.quiz_questions 
        WHERE quiz_id = p_quiz_id
    LOOP
        v_total_marks := v_total_marks + COALESCE(v_question.marks, 1);

        IF v_question.question_type IS NULL OR v_question.question_type = 'multiple_choice' THEN
            v_answer_text := p_answers->>v_question.q_id;
            
            IF v_answer_text IS NOT NULL AND v_answer_text ~ '^[0-9]+$' THEN
                v_selected_index := v_answer_text::INT;
                IF v_selected_index = v_question.correct_option_index THEN
                    v_score := v_score + COALESCE(v_question.marks, 1);
                END IF;
            END IF;
        ELSE
            -- سؤال مقالي يتم تحويل حالته للمراجعة
            v_has_essay := TRUE;
        END IF;
    END LOOP;

    IF v_total_marks = 0 THEN
        RAISE EXCEPTION 'هذا الامتحان لا يحتوي على أسئلة.';
    END IF;

    v_percentage := ROUND((v_score::NUMERIC / v_total_marks::NUMERIC) * 100);

    -- تسجيل النتيجة في جدول التسليمات
    INSERT INTO public.quiz_submissions (
        quiz_id, 
        student_id, 
        answers, 
        score, 
        total_marks, 
        status
    )
    VALUES (
        p_quiz_id, 
        v_student_id, 
        COALESCE(p_answers, '{}'::jsonb), 
        v_score, 
        v_total_marks, 
        CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END
    )
    RETURNING id INTO v_submission_id;

    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'score', v_score,
        'total_marks', v_total_marks,
        'percentage', v_percentage,
        'status', CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz(UUID, JSONB) TO authenticated;

-- 6. سياسات جدول نتائج وتسليمات الامتحانات (quiz_submissions)
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Students can insert their own submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Admins can do everything on submissions" ON public.quiz_submissions;

CREATE POLICY "Admins can do everything on submissions" 
ON public.quiz_submissions 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

CREATE POLICY "Students can view their own submissions" 
ON public.quiz_submissions 
FOR SELECT 
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own submissions" 
ON public.quiz_submissions 
FOR INSERT 
TO authenticated
WITH CHECK (student_id = auth.uid());

-- 7. سياسات جدول حصص الأونلاين (online_sessions)
ALTER TABLE public.online_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage online sessions." ON public.online_sessions;
DROP POLICY IF EXISTS "Students can view sessions for their grade or global sessions." ON public.online_sessions;
DROP POLICY IF EXISTS "Admins can manage online sessions" ON public.online_sessions;
DROP POLICY IF EXISTS "Students and users can view published sessions" ON public.online_sessions;

CREATE POLICY "Admins can manage online sessions" 
ON public.online_sessions 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

CREATE POLICY "Students and users can view published sessions" 
ON public.online_sessions 
FOR SELECT 
TO authenticated
USING (
    grade_level IS NULL 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.grade_level = online_sessions.grade_level OR profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- 8. سياسات جدول الاشتراكات ومجلد إيصالات الدفع (Subscriptions & Receipts Storage)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins and teachers manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;

-- صلاحيات الطلاب
CREATE POLICY "Users can insert their own subscriptions" 
ON public.subscriptions 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions" 
ON public.subscriptions 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- صلاحيات الإدارة والمعلمين (عرض، تعديل، حذف، تمديد)
CREATE POLICY "Admins and teachers manage subscriptions" 
ON public.subscriptions 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('admin', 'teacher') OR profiles.email = '41147332a@gmail.com')
    )
);

-- ضبط مجلد إيصالات الدفع (Receipts Storage Bucket) ليكون متاحاً للعرض وتجنب الصور المكسورة
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated users upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;

CREATE POLICY "Authenticated users upload receipts" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts');

