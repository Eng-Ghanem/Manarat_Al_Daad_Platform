-- ==========================================
-- 1. إضافة عمود الحالة و عمود درجات التصحيح اليدوي لجدول التسليمات
-- ==========================================
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS graded_marks JSONB DEFAULT '{}'::jsonb;

-- ==========================================
-- 2. تحديث دالة التصحيح (لتدعم الأسئلة المقالية وتمنع خطأ التحويل)
-- ==========================================

-- حذف الدالة القديمة لتجنب خطأ تعارض نوع الإرجاع (Return Type)
DROP FUNCTION IF EXISTS submit_quiz(UUID, JSONB);

CREATE OR REPLACE FUNCTION submit_quiz(p_quiz_id UUID, p_answers JSONB)
RETURNS JSONB AS $$
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
    -- الحصول على معرف الطالب من التوكن (Auth)
    v_student_id := auth.uid();
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be logged in.';
    END IF;

    -- التأكد من أن الطالب لم يمتحن هذا الامتحان من قبل
    SELECT EXISTS(
        SELECT 1 FROM quiz_submissions WHERE quiz_id = p_quiz_id AND student_id = v_student_id
    ) INTO v_already_submitted;

    IF v_already_submitted THEN
        RAISE EXCEPTION 'لقد قمت بأداء هذا الامتحان مسبقاً.';
    END IF;

    -- حساب الدرجات بالمرور على أسئلة الامتحان
    FOR v_question_id, v_q_marks, v_correct_index, v_q_type IN
        SELECT id::TEXT, marks, correct_option_index, question_type FROM quiz_questions WHERE quiz_id = p_quiz_id
    LOOP
        v_total_marks := v_total_marks + v_q_marks;
        
        IF v_q_type = 'multiple_choice' THEN
            -- استخراج إجابة الطالب لهذا السؤال بأمان
            v_answer_text := p_answers->>v_question_id;
            
            -- التأكد من أن الإجابة تحتوي على أرقام فقط قبل تحويلها (لتجنب خطأ invalid syntax)
            IF v_answer_text IS NOT NULL AND v_answer_text ~ '^[0-9]+$' THEN
                v_selected_index := v_answer_text::INT;
                IF v_selected_index = v_correct_index THEN
                    v_score := v_score + v_q_marks;
                END IF;
            END IF;
        ELSE
            -- إذا كان سؤال مقالي، نرفع راية وجود سؤال مقالي
            v_has_essay := TRUE;
            -- درجته صفر مبدئياً لحين التصحيح اليدوي
        END IF;
    END LOOP;

    -- إذا لم تكن هناك أسئلة
    IF v_total_marks = 0 THEN
        RAISE EXCEPTION 'هذا الامتحان لا يحتوي على أسئلة.';
    END IF;

    -- إدخال النتيجة في جدول quiz_submissions مع تحديد حالة الامتحان
    INSERT INTO quiz_submissions (quiz_id, student_id, answers, score, total_marks, status)
    VALUES (
        p_quiz_id, 
        v_student_id, 
        p_answers, 
        v_score, 
        v_total_marks, 
        CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END
    )
    RETURNING id INTO v_submission_id;

    -- إرجاع النتيجة بصيغة JSONB كما كانت تعمل الدالة القديمة
    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'score', v_score,
        'total_marks', v_total_marks,
        'status', CASE WHEN v_has_essay THEN 'pending' ELSE 'completed' END,
        'percentage', ROUND((v_score::NUMERIC / v_total_marks::NUMERIC) * 100)
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. إضافة صلاحية (Policy) للمسؤولين لتحديث درجات الامتحانات (التصحيح اليدوي)
-- ==========================================
DROP POLICY IF EXISTS "Admins can update submissions" ON quiz_submissions;

CREATE POLICY "Admins can update submissions" ON quiz_submissions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);
