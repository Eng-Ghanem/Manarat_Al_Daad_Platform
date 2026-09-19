-- ========================================================
-- 1. تحديث قيد التحقق (Check Constraint) لجدول الاشتراكات
-- للسماح بالحالة "expired" (منتهي الصلاحية)
-- ========================================================

-- إزالة القيد القديم إذا كان موجوداً
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- إضافة القيد الجديد ليشمل: pending, active, rejected, expired
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('pending', 'active', 'rejected', 'expired'));

-- ========================================================
-- 2. إضافة عمود expires_at لتسجيل تاريخ ووقت انتهاء الصلاحية بدقة
-- ========================================================
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- ========================================================
-- 3. تحديث الاشتراكات السابقة: حساب expires_at وتحديث المنتهية
-- ========================================================
-- حساب expires_at للاشتراكات المفعلة حالياً استناداً لصلاحية الكورس بالأيام
UPDATE public.subscriptions s
SET expires_at = s.created_at + (c.access_duration_days || ' days')::INTERVAL
FROM public.courses c
WHERE s.course_id = c.id 
  AND c.access_duration_days IS NOT NULL 
  AND s.expires_at IS NULL;

-- تحويل الاشتراكات التي تجاوزت مدة الصلاحية إلى expired
UPDATE public.subscriptions
SET status = 'expired'
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();
