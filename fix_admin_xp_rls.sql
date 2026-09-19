-- ==============================================================================
-- تمكين صلاحيات الأدمن لتحديث نقاط الـ XP وملفات الطلاب في جدول profiles
-- قم بتشغيل هذا الملف في Supabase SQL Editor
-- ==============================================================================

-- 1. التأكد من وجود عمود xp_points في جدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0;

-- 2. دالة آمنة للتحقق من دور الأدمن بدون حدوث تعارض (Recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. تفعيل الـ RLS على جدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. إزالة سياسات التحديث القديمة
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile or Admins can update all" ON public.profiles;

-- 5. السماح للمستخدم بتحديث حسابه الشخصي، والسماح للأدمن بتحديث كل الحسابات (النقاط والبيانات)
CREATE POLICY "Users can update their own profile or Admins can update all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin()
)
WITH CHECK (
  auth.uid() = id OR public.is_admin()
);
