-- ==========================================
-- تحديث جدول الأسئلة لدعم الأسئلة المقالية
-- ==========================================

-- 1. إضافة عمود نوع السؤال إذا لم يكن موجوداً
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'multiple_choice';

-- 2. جعل عمود الإجابة الصحيحة اختيارياً (لأنه غير مطلوب في السؤال المقالي)
ALTER TABLE quiz_questions ALTER COLUMN correct_option_index DROP NOT NULL;

-- 3. جعل عمود الخيارات اختيارياً مع قيمة افتراضية
ALTER TABLE quiz_questions ALTER COLUMN options DROP NOT NULL;
ALTER TABLE quiz_questions ALTER COLUMN options SET DEFAULT '[]'::jsonb;
