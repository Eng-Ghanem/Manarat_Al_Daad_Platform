import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, X, Send, Sparkles, User, GraduationCap, MessageSquare, Loader, CheckCircle2, Edit3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { GRADE_OPTIONS, formatGradeName } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AddReviewModal({ isOpen, onClose, onReviewSaved, editingReview = null }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [studentName, setStudentName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('sec_3');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = Boolean(editingReview);

  // Pre-fill user data or editing review data
  useEffect(() => {
    if (isOpen) {
      if (editingReview) {
        // Edit mode
        setRating(editingReview.rating || 5);
        setStudentName(editingReview.student_name || '');
        setGradeLevel(editingReview.grade_level || 'sec_3');
        setComment(editingReview.comment || '');
      } else {
        // Create mode
        if (profile) {
          setStudentName(profile.full_name || '');
          setGradeLevel(profile.grade_level || 'sec_3');
        } else if (user) {
          setStudentName(user.user_metadata?.full_name || '');
          setGradeLevel('sec_3');
        } else {
          setStudentName('');
          setGradeLevel('sec_3');
        }
        setRating(5);
        setComment('');
      }
    }
  }, [isOpen, editingReview, profile, user]);

  if (!isOpen) return null;

  const ratingDescriptions = {
    5: 'ممتاز جداً - تجربة استثنائية 🌟🌟🌟🌟🌟',
    4: 'جيد جداً - منصة رائعة ومفيدة ⭐⭐⭐⭐',
    3: 'جيد - تجربة مقبولة ومفيدة ⭐⭐⭐',
    2: 'مقبول - يحتاج لبعض التحسينات ⭐⭐',
    1: 'ضعيف ⭐'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!studentName.trim()) {
      return toast.error('يرجى كتابة الاسم الكريم');
    }
    if (!comment.trim() || comment.trim().length < 5) {
      return toast.error('يرجى كتابة رأيك بالتفصيل (5 أحرف على الأقل)');
    }

    setSubmitting(true);

    try {
      if (isEditMode) {
        // ================= EDIT MODE =================
        const reviewId = editingReview.id;
        const updatedFields = {
          student_name: studentName.trim(),
          grade_level: gradeLevel,
          rating: Number(rating),
          comment: comment.trim(),
        };

        // 1. If it's a local storage review
        if (String(reviewId).startsWith('local_')) {
          const localReviews = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');
          const updated = localReviews.map((r) =>
            r.id === reviewId ? { ...r, ...updatedFields } : r
          );
          localStorage.setItem('manarat_local_reviews', JSON.stringify(updated));
          const updatedObj = { ...editingReview, ...updatedFields };
          toast.success('تم تحديث رأيك بنجاح! ⭐');
          if (onReviewSaved) onReviewSaved(updatedObj);
          onClose();
          return;
        }

        // 2. Update in Supabase
        const { data, error } = await supabase
          .from('student_reviews')
          .update(updatedFields)
          .eq('id', reviewId)
          .select();

        if (error) throw error;

        const updatedObj = (data && data[0]) ? data[0] : { ...editingReview, ...updatedFields };
        toast.success('تم تحديث تقييمك بنجاح! شكراً لك ⭐');
        if (onReviewSaved) onReviewSaved(updatedObj);
        onClose();

      } else {
        // ================= CREATE MODE =================
        // Double check: if user is logged in, check if they already have an existing review in Supabase
        if (user) {
          const { data: existingRows } = await supabase
            .from('student_reviews')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);

          if (existingRows && existingRows.length > 0) {
            // Already reviewed! Update existing instead of creating a duplicate
            const existingId = existingRows[0].id;
            const updatedFields = {
              student_name: studentName.trim(),
              grade_level: gradeLevel,
              rating: Number(rating),
              comment: comment.trim(),
            };
            const { data: updatedData, error: updateErr } = await supabase
              .from('student_reviews')
              .update(updatedFields)
              .eq('id', existingId)
              .select();

            if (updateErr) throw updateErr;

            toast.success(t('review_msg_updated'));
            if (onReviewSaved) onReviewSaved((updatedData && updatedData[0]) || updatedFields);
            onClose();
            return;
          }
        }

        const newReview = {
          user_id: user ? user.id : null,
          student_name: studentName.trim(),
          grade_level: gradeLevel,
          rating: Number(rating),
          comment: comment.trim(),
          avatar_url: profile?.avatar_url || null,
          is_approved: true,
          created_at: new Date().toISOString()
        };

        // Insert to Supabase
        const { data, error } = await supabase
          .from('student_reviews')
          .insert([newReview])
          .select();

        if (error) {
          console.warn('Supabase insert warning:', error);
          // Fallback to local storage
          const existingLocal = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');
          const filtered = user ? existingLocal.filter(r => r.user_id !== user.id) : existingLocal;
          const localReview = { ...newReview, id: 'local_' + Date.now() };
          localStorage.setItem('manarat_local_reviews', JSON.stringify([localReview, ...filtered]));

          toast.success(t('review_msg_saved'));
          if (onReviewSaved) onReviewSaved(localReview);
          onClose();
          return;
        }

        const savedReview = (data && data[0]) ? data[0] : newReview;
        toast.success(t('review_msg_saved'));
        if (onReviewSaved) onReviewSaved(savedReview);
        onClose();
      }
    } catch (err) {
      console.error('Error in review submission:', err);
      toast.error('حدث خطأ أثناء حفظ التقييم، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden font-arabic transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center shadow-inner">
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEditMode ? t('review_modal_edit_title') : t('review_modal_add_title')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditMode 
                  ? t('review_modal_edit_desc')
                  : t('review_modal_add_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Star Rating Selection */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-800/30 text-center">
            <label className="block text-sm font-bold text-gray-800 dark:text-amber-200 mb-2">
              {t('review_your_rating')}
            </label>
            <div className="flex items-center justify-center gap-2 mb-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transform hover:scale-125 transition-transform duration-200 focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]'
                          : 'text-gray-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 transition-all">
              {ratingDescriptions[hoverRating || rating]}
            </p>
          </div>

          {/* Student Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              {t('review_name_label')}
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder={t('review_name_ph')}
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
          </div>

          {/* Grade Level */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              {t('review_grade_label')}
            </label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            >
              {GRADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`grade_${opt.value}`, opt.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Review Message */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              {t('review_share_title')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={t('review_comment_ph')}
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 transition-all duration-300 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>{t('common_loading')}</span>
                </>
              ) : isEditMode ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t('review_update_btn')}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 rtl:rotate-180" />
                  <span>{t('review_submit_btn')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-3.5 px-5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold transition-all cursor-pointer"
            >
              {t('common_cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
