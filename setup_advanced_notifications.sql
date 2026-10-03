-- =========================================================================
-- نظام الإشعارات والتنبيهات المتقدم والشامل لمنصة منارة الضاد
-- Advanced Notifications System & Event Triggers
-- =========================================================================

-- 1. التأكد من وجود جدول notifications بكامل الأعمدة المطلوبة
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس لتحسين سرعة الاستعلامات
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 2. ضبط سياسات الحماية RLS (Row Level Security) الشاملة
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert chat mentions" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- السماح للمستخدمين بإدراج الإشعارات المناسبة (المعلم للجميع، الطالب لنفسه وللمعلمين)
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
    -- 1. المشرفون والمعلمون يمكنهم إرسال إشعارات لأي مستخدم
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    -- 2. المستخدم يمكنه إنشاء تذكيرات لنفسه (كتذكيرات الحصص قبل 5 دقائق)
    OR user_id = auth.uid()
    -- 3. الطالب يمكنه إرسال إشعار للإدارة/المعلم (كتسليم امتحان، طلب تجديد، حجز حصة تجريبية)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = notifications.user_id AND profiles.role = 'admin')
    -- 4. إشعارات المحادثة والمنشن
    OR type IN ('chat_mention', 'quiz_submission', 'package_renewal', 'trial_booking', 'live_session')
);

-- 3. تحديث دالة تسليم الامتحان submit_quiz لإرسال إشعار تلقائي للمعلم مع صوت الجرس
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
    v_student_name TEXT := 'طالب';
    v_quiz_title TEXT := 'امتحان';
BEGIN
    v_student_id := auth.uid();
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be logged in.';
    END IF;

    -- التحقق من عدم التكرار
    SELECT EXISTS(
        SELECT 1 FROM public.quiz_submissions 
        WHERE quiz_submissions.quiz_id = p_quiz_id 
        AND quiz_submissions.student_id = v_student_id
    ) INTO v_already_submitted;

    IF v_already_submitted THEN
        RAISE EXCEPTION 'لقد قمت بأداء هذا الامتحان مسبقاً.';
    END IF;

    -- قراءة اسم الطالب وعنوان الامتحان
    SELECT COALESCE(full_name, 'طالب') INTO v_student_name FROM public.profiles WHERE id = v_student_id;
    SELECT COALESCE(title, 'امتحان') INTO v_quiz_title FROM public.quizzes WHERE id = p_quiz_id;

    -- حساب درجات الأسئلة
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
        ELSE -- multiple_choice
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

    -- إدراج التسليم
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

    -- إرسال إشعار فوري لجميع الإداريين والمعلمين مع رابط مباشر لمراجعة التسليم
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
        p.id,
        '📝 تسليم امتحان جديد',
        'قام الطالب (' || v_student_name || ') بحل وتسليم: ' || v_quiz_title,
        'quiz_submission',
        '/admin-dashboard/quizzes/' || p_quiz_id || '/submissions'
    FROM public.profiles p
    WHERE p.role = 'admin';

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
