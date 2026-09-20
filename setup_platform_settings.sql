-- ==============================================================================
-- إعداد جدول إعدادات المنصة (platform_settings) لقواعد نقاط الـ XP والإعدادات العامة
-- قم بتشغيل هذا الملف في Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تفعيل الـ RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- السماح للجميع (زوار وطلاب ومسجلين) بقراءة الإعدادات العامة مثل معايير النقاط
DROP POLICY IF EXISTS "Allow public read access to platform_settings" ON public.platform_settings;
CREATE POLICY "Allow public read access to platform_settings"
ON public.platform_settings FOR SELECT
TO public
USING (true);

-- السماح للمشرفين (Admins) فقط بإضافة وتعديل وحذف الإعدادات
DROP POLICY IF EXISTS "Allow admin write access to platform_settings" ON public.platform_settings;
CREATE POLICY "Allow admin write access to platform_settings"
ON public.platform_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- إدراج القيم الافتراضية لقواعد النقاط في حال عدم وجودها
INSERT INTO public.platform_settings (key, value)
VALUES (
  'gamification_rules',
  '{"lesson_completed": 15, "quiz_passed": 20, "quiz_full_score": 50, "course_completed": 100, "notes_saved": 5}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
