-- إضافة الحقول الجديدة لجدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- تحديث دالة إنشاء البروفايل لتشمل البريد ورقم الهاتف والنوع
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number, gender)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Student'), 
    'student',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
