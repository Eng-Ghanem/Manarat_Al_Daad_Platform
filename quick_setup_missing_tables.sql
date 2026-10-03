-- ==============================================================================
-- إعداد الجداول والأعمدة الإضافية للمنصة (منصة منارة الضاد)
-- الصق هذا الكود في Supabase Dashboard -> SQL Editor واضغط RUN
-- ==============================================================================

-- 1. جدول الحصص المكتملة وسجل حضور باقات الـ 8 حصص
CREATE TABLE IF NOT EXISTS public.completed_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    session_title TEXT NOT NULL DEFAULT 'حصة أونلاين مباشرة',
    session_type TEXT DEFAULT 'package',
    completed_at TIMESTAMPTZ DEFAULT now(),
    teacher_notes TEXT DEFAULT 'تم حضور الحصة واكتمالها بنجاح',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل الأمان RLS
ALTER TABLE public.completed_live_sessions ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
DROP POLICY IF EXISTS "Students can view their own completed sessions" ON public.completed_live_sessions;
CREATE POLICY "Students can view their own completed sessions"
ON public.completed_live_sessions FOR SELECT
TO authenticated
USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins full control on completed_live_sessions" ON public.completed_live_sessions;
CREATE POLICY "Admins full control on completed_live_sessions"
ON public.completed_live_sessions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'teacher')
    )
);

-- 2. إضافة عمود الردود الذكية (reply_to) لجدول المحادثات إن لم يكن موجوداً
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to JSONB;

-- 3. تفعيل التزامن اللحظي Realtime للجدول
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.completed_live_sessions;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
