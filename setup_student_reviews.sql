-- ========================================================
-- جدول آراء وتقييمات الطلاب الحقيقية (Student Reviews)
-- لمنصة منارة الضاد التعليمية
-- ========================================================

-- 1. إنشاء جدول التقييمات
CREATE TABLE IF NOT EXISTS public.student_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    grade_level TEXT,
    rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    avatar_url TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_student_user UNIQUE (user_id)
);

-- 2. في حالة كان الجدول منشأ مسبقاً، إضافة قيد منع التكرار (رأي واحد فقط لكل طالب)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_student_user'
  ) THEN
    -- حذف التكرارات القديمة إن وجدت والإبقاء على الأحدث
    DELETE FROM public.student_reviews a USING public.student_reviews b
    WHERE a.user_id IS NOT NULL 
      AND a.user_id = b.user_id 
      AND a.created_at < b.created_at;

    ALTER TABLE public.student_reviews ADD CONSTRAINT unique_student_user UNIQUE (user_id);
  END IF;
END $$;

-- 3. فهرس لتحسين سرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_student_reviews_created_at ON public.student_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_reviews_approved ON public.student_reviews (is_approved);

-- 4. تفعيل أمان مستوى الصفوف (RLS)
ALTER TABLE public.student_reviews ENABLE ROW LEVEL SECURITY;

-- 5. إزالة أي سياسات سابقة لتجنب التكرار
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.student_reviews;
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.student_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.student_reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.student_reviews;
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.student_reviews;

-- 6. السماح للجميع (الزوار والطلاب) بقراءة التقييمات المعتمدة
CREATE POLICY "Public can view approved reviews" ON public.student_reviews
    FOR SELECT USING (is_approved = true);

-- 7. السماح للطلاب والزوار بإضافة تقييم جديد
CREATE POLICY "Anyone can insert reviews" ON public.student_reviews
    FOR INSERT WITH CHECK (true);

-- 8. السماح للمستخدم بتعديل تقييمه الخاص
CREATE POLICY "Users can update their own reviews" ON public.student_reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- 9. السماح للمستخدم بحذف تقييمه الخاص
CREATE POLICY "Users can delete their own reviews" ON public.student_reviews
    FOR DELETE USING (auth.uid() = user_id);

-- 10. السماح للإدارة (Admin و Teacher) بكافة الصلاحيات (حذف أو تعديل أي تقييم)
CREATE POLICY "Admins can manage all reviews" ON public.student_reviews
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'teacher')
        )
    );
