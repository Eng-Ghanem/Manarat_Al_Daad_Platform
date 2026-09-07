-- ==========================================
-- نظام الامتحانات (Quizzes / Exams System)
-- ==========================================

-- 1. جدول الامتحانات
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    grade_level VARCHAR(50),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    duration_minutes INT, -- إذا كان NULL يعني بدون وقت
    is_published BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. جدول أسئلة الامتحان
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_type VARCHAR(20) DEFAULT 'multiple_choice', -- 'multiple_choice' or 'essay'
    text TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb, -- مصفوفة من الإجابات للاختياري
    correct_option_index INT, -- رقم الإجابة الصحيحة (فقط للاختياري)
    marks INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. جدول نتائج الطلاب (تسليم الامتحانات)
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score INT NOT NULL,
    total_marks INT NOT NULL,
    answers JSONB NOT NULL, -- ما اختاره الطالب
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(quiz_id, student_id) -- لا يسمح للطالب بامتحان نفس الامتحان أكثر من مرة حالياً
);

-- 4. تفعيل سياسات الأمان (RLS)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- مسح السياسات القديمة (لتفادي تكرار الإنشاء)
DROP POLICY IF EXISTS "Admins can do everything on quizzes" ON quizzes;
DROP POLICY IF EXISTS "Students can view published quizzes" ON quizzes;
DROP POLICY IF EXISTS "Admins can do everything on questions" ON quiz_questions;
DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON quiz_questions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON quiz_submissions;
DROP POLICY IF EXISTS "Students can view their own submissions" ON quiz_submissions;

-- سياسات quizzes
CREATE POLICY "Admins can do everything on quizzes" ON quizzes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
CREATE POLICY "Students can view published quizzes" ON quizzes FOR SELECT USING (
    is_published = TRUE
);

-- سياسات quiz_questions
CREATE POLICY "Admins can do everything on questions" ON quiz_questions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
CREATE POLICY "Students can view questions of published quizzes" ON quiz_questions FOR SELECT USING (
    EXISTS (SELECT 1 FROM quizzes WHERE id = quiz_questions.quiz_id AND is_published = TRUE)
);

-- سياسات quiz_submissions
CREATE POLICY "Admins can view all submissions" ON quiz_submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
CREATE POLICY "Students can view their own submissions" ON quiz_submissions FOR SELECT USING (
    student_id = auth.uid()
);
-- ملاحظة: الإدخال سيتم عبر الدالة (Function) لتجاوز الـ RLS وتجنب الغش.

-- 5. دالة تصحيح الامتحان (Secure Auto-Grading Function)
CREATE OR REPLACE FUNCTION submit_quiz(
    p_quiz_id UUID,
    p_answers JSONB -- مثال: {"question_id_1": 0, "question_id_2": 2}
) RETURNS JSONB AS $$
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
            -- استخراج إجابة الطالب لهذا السؤال
            v_selected_index := (p_answers->>v_question_id)::INT;
            
            IF v_selected_index IS NOT NULL AND v_selected_index = v_correct_index THEN
                v_score := v_score + v_q_marks;
            END IF;
        ELSE
            -- إذا كان سؤال مقالي، ستكون درجته صفر مبدئياً لحين التصحيح اليدوي
            -- يمكن تطويره لاحقاً
        END IF;
    END LOOP;

    -- إذا لم تكن هناك أسئلة
    IF v_total_marks = 0 THEN
        RAISE EXCEPTION 'هذا الامتحان لا يحتوي على أسئلة.';
    END IF;

    -- تسجيل النتيجة
    INSERT INTO quiz_submissions (quiz_id, student_id, score, total_marks, answers)
    VALUES (p_quiz_id, v_student_id, v_score, v_total_marks, p_answers)
    RETURNING id INTO v_submission_id;

    -- إرجاع النتيجة
    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'score', v_score,
        'total_marks', v_total_marks,
        'percentage', (v_score::FLOAT / v_total_marks::FLOAT) * 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
