-- 1. أضف حقل الصلاحية (role) لجدول profiles، واجعله 'student' افتراضياً لأي طالب جديد
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';

-- 2. قم بترقية حسابك (أدخل بريدك الإلكتروني بين علامات التنصيص بدلاً من email@example.com)
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = (SELECT id FROM auth.users WHERE email = '41147332a@gmail.com' LIMIT 1);
