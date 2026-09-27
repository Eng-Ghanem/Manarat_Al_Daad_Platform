-- ==============================================================================
-- مَنَارَةُ الضَّادِ - تفعيل الحذف النهائي للطلاب (من المنصة وقاعدة البيانات)
-- قم بنسخ وتشغيل هذا الكود في Supabase SQL Editor
-- ==============================================================================

-- 1. دالة حذف الطالب الشاملة بحقوق المدير (SECURITY DEFINER)
-- تحذف الطالب من نظام المصادقة auth.users وجدول profiles وجميع الجداول التابعة دفعة واحدة
CREATE OR REPLACE FUNCTION public.admin_delete_student(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_email TEXT;
BEGIN
  -- أ. التحقق من صلاحية المستخدم الحالي (يجب أن يكون أدمن)
  SELECT role, email INTO v_caller_role, v_caller_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF (v_caller_role != 'admin' AND v_caller_email != '41147332a@gmail.com') THEN
    RAISE EXCEPTION 'غير مصرح لك بتنفيذ هذه العملية. تقتصر على مديري النظام فقط.';
  END IF;

  -- ب. التحقق من عدم حذف الأدمن لنفسه
  IF p_student_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك حذف حسابك الإداري الحالي.';
  END IF;

  -- ج. تنظيف كل السجلات والجداول التابعة للطالب لتفادي أي قيود مفاتيح أجنبية (Foreign Key Constraints)
  DELETE FROM public.student_reviews WHERE user_id = p_student_id;
  DELETE FROM public.subscriptions WHERE user_id = p_student_id;
  DELETE FROM public.quiz_submissions WHERE student_id = p_student_id;
  DELETE FROM public.lesson_progress WHERE user_id = p_student_id;
  DELETE FROM public.enrollments WHERE user_id = p_student_id;

  -- تنظيف الجداول الاختيارية إن وجدت
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DELETE FROM public.notifications WHERE user_id = p_student_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gamification_logs') THEN
    DELETE FROM public.gamification_logs WHERE user_id = p_student_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    UPDATE public.chat_messages SET deleted_by = NULL WHERE deleted_by = p_student_id;
    DELETE FROM public.chat_messages WHERE sender_id = p_student_id;
  END IF;

  -- د. حذف الملف الشخصي من جدول profiles
  DELETE FROM public.profiles WHERE id = p_student_id;

  -- هـ. حذف حساب الطالب نهائياً من auth.users (يشيل الطالب من المنصة والداتابيز)
  DELETE FROM auth.users WHERE id = p_student_id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حذف حساب الطالب وبياناته بالكامل من المنصة وقاعدة البيانات بنجاح');
END;
$$;

-- 2. منح صلاحية تنفيذ الدالة للمستخدمين المسجلين (التحقق الفعلي يتم بداخل الدالة)
GRANT EXECUTE ON FUNCTION public.admin_delete_student(UUID) TO authenticated;

-- 3. إضافة سياسة أمان تتيح للأدمن حذف السجلات من جدول profiles كإجراء احتياطي إضافي
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR email = '41147332a@gmail.com')
  )
);
