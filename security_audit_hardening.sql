-- ======================================================================================
-- مَنَارَةُ الضَّادِ - الحزمة الأمنية الشاملة والموحدة لقواعد البيانات (Supabase Master Security Hardening)
-- تشمل الحزمة: تأمين الصلاحيات (RLS)، منع ترقية الرتب الذاتية، منع التلاعب بالنقاط،
-- وتأمين سرية الامتحانات والإيصالات البنكية وغرف البث المباشر.
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- 1. حماية الملفات الشخصية (Profiles Table Protection & Anti-Tampering)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- دالة آمنة للتحقق من رتبة الأدمن بدون حدوث استدعاء ذاتي (Recursion Loop)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف السياسات المتعارضة السابقة
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile or Admins can update all" ON public.profiles;

-- سياسة القراءة: تُمكّن الطلاب والمشرفين المسجلين من رؤية الملفات الشخصية (الأسماء، الرتب، الشارات)
CREATE POLICY "Public profiles viewable by authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- سياسة التعديل: تُمكّن المستخدم من تعديل بياناته، وتُمكّن الإدارة من تعديل أي ملف
CREATE POLICY "Users can update their own profile or Admins can update all"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- زناد أمني فوري (Trigger): يمنع أي طالب أو مستخدم عادي من تغيير رتبته (role) أو رصيد نقاطه (xp_points) يدوياً عبر العميل
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا كان التحديث قادماً من المستخدم نفسه وهو ليس أدمن
    IF (auth.uid() = OLD.id) AND (OLD.role != 'admin') THEN
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            RAISE EXCEPTION 'أمني: غير مصرح لك بتغيير الصلاحيات أو الرتبة نهائياً!';
        END IF;
        IF (NEW.xp_points IS DISTINCT FROM OLD.xp_points) THEN
            RAISE EXCEPTION 'أمني: غير مصرح لك بتعديل رصيد النقاط يدوياً! يتم منح النقاط تلقائياً من الخادم.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- --------------------------------------------------------------------------------------
-- 2. دالة آمنة لمنح نقاط التميز (Secure RPC Function for XP Awarding)
-- تضمن حساب النقاط وإرسال الإشعار تحت حماية SECURITY DEFINER
-- --------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_student_xp(
    p_user_id UUID,
    p_amount INT,
    p_reason TEXT DEFAULT ''
)
RETURNS INT AS $$
DECLARE
    v_caller_id UUID;
    v_current_xp INT := 0;
    v_new_xp INT := 0;
    v_user_role TEXT;
BEGIN
    v_caller_id := auth.uid();

    -- التحقق من تسجيل الدخول
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً.';
    END IF;

    -- لا يسمح للطالب بمنح نقاط لمستخدم آخر
    IF v_caller_id != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك منح نقاط لمستخدم آخر.';
    END IF;

    -- التحقق من معقولية النقاط الممنوحة في العملية الواحدة لمنع التلاعب
    IF p_amount <= 0 OR (p_amount > 150 AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'قيمة النقاط غير صالحة أو تجاوزت الحد الأقصى المسموح به.';
    END IF;

    -- فحص رتبة المستلم
    SELECT role, COALESCE(xp_points, 0) INTO v_user_role, v_current_xp
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_role IN ('admin', 'teacher') THEN
        RETURN 0; -- لا يتم احتساب نقاط للمشرفين والمعلمين
    END IF;

    v_new_xp := v_current_xp + p_amount;

    -- تحديث النقاط
    UPDATE public.profiles
    SET xp_points = v_new_xp
    WHERE id = p_user_id;

    -- إرسال إشعار في لوحة الإشعارات
    INSERT INTO public.notifications (user_id, title, message, type, link, is_read, created_at)
    VALUES (
        p_user_id,
        '🎉 نقاط تميز جديدة!',
        'مبروك! حصلت على +' || p_amount || ' نقطة XP ' || CASE WHEN p_reason != '' THEN 'مقابل ' || p_reason ELSE '' END || '. إجمالي رصيدك الآن ' || v_new_xp || ' نقطة!',
        'xp_reward',
        '/dashboard',
        false,
        NOW()
    );

    RETURN v_new_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.award_student_xp(UUID, INT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------------------
-- 3. حماية المحادثات العامة والخاصة (Chat Messages Protection)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only send as themselves" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can update any chat message" ON public.chat_messages;

-- القراءة للمستخدمين المسجلين
CREATE POLICY "Authenticated users can read chat messages" 
ON public.chat_messages FOR SELECT 
TO authenticated 
USING (true);

-- الإرسال باسم المستخدم الحقيقي فقط (منع انتحال الشخصيات)
CREATE POLICY "Users can only send as themselves" 
ON public.chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = sender_id);

-- التعديل والحذف لصاحب الرسالة
CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages FOR UPDATE 
TO authenticated 
USING (auth.uid() = sender_id);

-- صلاحية الإدارة للتحكم في أي رسالة وحذف المخالف منها
CREATE POLICY "Admins can update any chat message" 
ON public.chat_messages FOR UPDATE 
TO authenticated 
USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));

-- --------------------------------------------------------------------------------------
-- 4. حماية الاشتراكات (Subscriptions Protection)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;

-- منع التفعيل الذاتي: أي اشتراك يرفعه الطالب يجب أن تكون حالته قيد المراجعة (pending)
CREATE POLICY "Users can insert their own subscriptions" 
ON public.subscriptions FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    AND (status = 'pending' OR status IS NULL)
);

-- التفعيل والإلغاء والتعديل مخصص للإدارة فقط
CREATE POLICY "Admins can update subscriptions" 
ON public.subscriptions FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- --------------------------------------------------------------------------------------
-- 5. حماية سرية الامتحانات ومكافحة الغش (Exam Anti-Cheat Protection)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Admins and teachers view full quiz questions" ON public.quiz_questions;

-- حجب الإجابات الصحيحة عن الطلاب؛ لا يمكن قراءة الجدول الكامل إلا للإدارة والمعلمين
CREATE POLICY "Admins and teachers view full quiz questions" 
ON public.quiz_questions FOR SELECT 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);

-- View آمن للطلاب بدون عمود الإجابة الصحيحة (correct_option_index)
CREATE OR REPLACE VIEW public.student_quiz_questions AS
SELECT id, quiz_id, question_type, text, options, marks, created_at
FROM public.quiz_questions;

GRANT SELECT ON public.student_quiz_questions TO authenticated;

-- --------------------------------------------------------------------------------------
-- 6. حماية غرف البث المباشر (Online Live Sessions Protection)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.online_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view sessions for their grade or global sessions." ON public.online_sessions;
DROP POLICY IF EXISTS "Admins can manage online sessions." ON public.online_sessions;

CREATE POLICY "Admins can manage online sessions." 
ON public.online_sessions FOR ALL 
TO authenticated 
USING (public.is_admin());

CREATE POLICY "Students can view sessions for their grade or global sessions." 
ON public.online_sessions FOR SELECT 
TO authenticated 
USING (
    grade_level IS NULL OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND grade_level = online_sessions.grade_level
    )
);

-- --------------------------------------------------------------------------------------
-- 7. حماية إيصالات التحويل البنكية (Receipts Storage Bucket Protection)
-- --------------------------------------------------------------------------------------

-- تحويل حاوية إيصالات الدفع إلى خاصة (غير معروضة للعامة لحماية الخصوصية)
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- التأكد من وجود فهارس الأداء السريع (Performance Indices)
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student ON public.quiz_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz ON public.quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
