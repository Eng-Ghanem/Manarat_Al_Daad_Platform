import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Quote, Plus, Trash2, Edit3, Sparkles, MessageSquareHeart, Loader } from 'lucide-react';
import FadeIn from '../FadeIn';
import ConfirmModal from '../ConfirmModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useReview } from '../../context/ReviewContext';
import { formatGradeName } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function TestimonialsSection() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';
  const { openReviewModal, hasUserReviewed, userReview, notifyReviewDeleted } = useReview();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, review: null });

  useEffect(() => {
    fetchReviews();

    // Setup Supabase Realtime listener
    const channel = supabase
      .channel('student_reviews_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_reviews' },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    // Listen to local app events for instant UI update
    const handleSaved = (e) => {
      const saved = e.detail;
      setReviews((prev) => {
        const exists = prev.some((r) => r.id === saved.id || (saved.user_id && r.user_id === saved.user_id));
        if (exists) {
          return prev.map((r) =>
            r.id === saved.id || (saved.user_id && r.user_id === saved.user_id) ? { ...r, ...saved } : r
          );
        }
        return [saved, ...prev];
      });
    };

    const handleDeleted = (e) => {
      const delId = e.detail;
      setReviews((prev) => prev.filter((r) => r.id !== delId));
    };

    window.addEventListener('student_review_saved', handleSaved);
    window.addEventListener('student_review_deleted', handleDeleted);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('student_review_saved', handleSaved);
      window.removeEventListener('student_review_deleted', handleDeleted);
    };
  }, [user]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('student_reviews')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      const localReviews = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');

      if (error) {
        setReviews(localReviews);
      } else {
        // Merge Supabase reviews with any local-only reviews
        const combined = [...(data || [])];
        for (const lr of localReviews) {
          if (!combined.some((r) => r.id === lr.id || (lr.user_id && r.user_id === lr.user_id))) {
            combined.unshift(lr);
          }
        }
        setReviews(combined);
      }
    } catch (err) {
      console.error('Error fetching student reviews:', err);
      const localReviews = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');
      setReviews(localReviews);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (review) => {
    setDeleteModal({ isOpen: true, review });
  };

  const confirmDeleteReview = async () => {
    const review = deleteModal.review;
    if (!review) return;

    setDeleteModal({ isOpen: false, review: null });
    setDeletingId(review.id);

    try {
      // 1. If it's a local storage review
      if (String(review.id).startsWith('local_')) {
        const localReviews = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');
        const updated = localReviews.filter((r) => r.id !== review.id);
        localStorage.setItem('manarat_local_reviews', JSON.stringify(updated));
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        notifyReviewDeleted(review.id);
        toast.success('تم حذف الرأي بنجاح');
        return;
      }

      // 2. Delete from Supabase
      const { error } = await supabase
        .from('student_reviews')
        .delete()
        .eq('id', review.id);

      if (error) throw error;

      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      notifyReviewDeleted(review.id);
      toast.success('تم حذف الرأي بنجاح من قاعدة البيانات والمنصة');
    } catch (err) {
      console.error('Error deleting review:', err);
      toast.error('حدث خطأ أثناء محاولة حذف الرأي');
    } finally {
      setDeletingId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'ط';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]} ${parts[1][0]}`;
    }
    return parts[0].slice(0, 2);
  };

  const getAvatarGradient = (name) => {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-amber-500 to-orange-600',
      'from-emerald-500 to-teal-600',
      'from-purple-600 to-pink-600',
      'from-cyan-600 to-blue-700',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = (hash + name.charCodeAt(i)) % gradients.length;
    }
    return gradients[hash];
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return '';
    }
  };

  return (
    <section id="testimonials" className="py-20 bg-gray-50 dark:bg-slate-900 relative overflow-hidden font-arabic">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.02] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/5 dark:bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm mb-4 border border-blue-100 dark:border-blue-800/50 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('testimonials_badge')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-4">
              {t('testimonials_title_prefix')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-amber-500">{t('testimonials_title_highlight')}</span>{t('testimonials_title_suffix')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-lg mb-6">
              {t('testimonials_subtitle')}
            </p>

            {/* Subtle, High-End CTA: Only shown if a non-admin student has NOT submitted a review yet */}
            {!isAdmin && !hasUserReviewed && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => openReviewModal()}
                  className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-slate-800/90 hover:bg-blue-50 dark:hover:bg-slate-700/80 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-slate-700/80 text-sm font-bold shadow-sm hover:shadow-md transition-all duration-300 hover:border-amber-400/60 dark:hover:border-amber-400/40 cursor-pointer"
                >
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                  <span>{t('testimonials_btn_add')}</span>
                  <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </button>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Reviews Content */}
        {loading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800/60 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-[2rem] border border-gray-100 dark:border-slate-800 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-28"></div>
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-4/5"></div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          /* Empty State: No Reviews Yet */
          <FadeIn>
            <div className="max-w-xl mx-auto text-center py-16 px-6 bg-white dark:bg-slate-800/80 rounded-[2.5rem] border border-gray-100 dark:border-slate-700/60 shadow-lg shadow-blue-500/5">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center shadow-inner border border-amber-200 dark:border-amber-800/40">
                <MessageSquareHeart className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {isAdmin ? 'لا توجد آراء طلاب مسجلة بعد' : 'كن أول من يشارك تجربته! 🌟'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                {isAdmin 
                  ? 'ستظهر هنا آراء وتقييمات الطلاب بمجرد مشاركتها على المنصة، مع إمكانية إدارتها وحذفها.'
                  : 'لم يتم تسجيل آراء بعد. يسعدنا أن تكون أول طالب يترك تقييمه ورأيه الصادق حول شرح الأستاذ سيد غريب والمنصة ليظهر هنا لجميع الطلاب.'}
              </p>
              {!isAdmin && (
                <button
                  onClick={() => openReviewModal()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>أضف تقييمك الآن</span>
                </button>
              )}
            </div>
          </FadeIn>
        ) : (
          /* Reviews Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-10">
            {reviews.map((review, index) => {
              const isMyReview = !isAdmin && ((user && review.user_id && user.id === review.user_id) || (userReview && userReview.id === review.id));
              const canDelete = isAdmin || isMyReview;
              const avatarGrad = getAvatarGradient(review.student_name);

              return (
                <FadeIn key={review.id || index} delay={index * 80}>
                  <div className={`bg-white dark:bg-slate-800 p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-[2rem] shadow-sm border transition-all duration-300 flex flex-col justify-between relative group hover:shadow-xl overflow-hidden ${
                    isMyReview 
                      ? 'border-blue-300 dark:border-blue-700/80 ring-2 ring-blue-500/20' 
                      : 'border-gray-100 dark:border-slate-700/60 hover:border-blue-200 dark:hover:border-blue-800/50'
                  }`}>
                    <Quote className="absolute top-6 right-8 w-12 h-12 text-blue-100 dark:text-slate-700/40 -z-10 transform rotate-180 group-hover:scale-110 group-hover:text-blue-200 dark:group-hover:text-slate-600 transition-all duration-500 pointer-events-none" />

                    <div>
                      {/* Card Header: Avatar, Name, Badges & Actions */}
                      <div className="flex items-start justify-between gap-2.5 sm:gap-4 mb-4 sm:mb-5">
                        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                          {review.avatar_url ? (
                            <img
                              src={review.avatar_url}
                              alt={review.student_name}
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-md shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${avatarGrad} text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md border-2 border-white dark:border-slate-700 shrink-0`}
                            >
                              {getInitials(review.student_name)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">
                                {review.student_name}
                              </h3>
                              {isMyReview && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                  رأيك الشخصي
                                </span>
                              )}
                              {review.user_id && !isMyReview && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  طالب موثق ✓
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium flex-wrap">
                              <span>{formatGradeName(review.grade_level)}</span>
                              {review.created_at && (
                                <>
                                  <span>•</span>
                                  <span className="shrink-0">{formatDate(review.created_at)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Actions (Edit/Delete) */}
                        {(isMyReview || canDelete) && (
                          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-start mt-0.5">
                            {/* Edit button: only for the author of this review */}
                            {isMyReview && (
                              <button
                                onClick={() => openReviewModal(review)}
                                title="تعديل رأيك"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 bg-blue-50 dark:bg-blue-950/60 rounded-lg transition-all cursor-pointer border border-blue-200 dark:border-blue-800 shadow-2xs active:scale-95 shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                            )}

                            {/* Delete button: for author or admin */}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteClick(review)}
                                disabled={deletingId === review.id}
                                title={isMyReview ? "حذف رأيك" : "حذف هذا الرأي (إدارة)"}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 bg-rose-50 dark:bg-rose-950/60 rounded-lg transition-all cursor-pointer border border-rose-200 dark:border-rose-800 shadow-2xs active:scale-95 shrink-0"
                              >
                                {deletingId === review.id ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>حذف</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Star Rating */}
                      <div className="flex items-center gap-1.5 mb-4" dir="ltr">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= review.rating
                                ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                                : 'text-gray-200 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Review Comment Text */}
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base italic break-words">
                        "{review.comment}"
                      </p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        )}
      </div>

      {/* Professional Centered Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, review: null })}
        onConfirm={confirmDeleteReview}
        title={deleteModal.review?.student_name ? `${t('review_delete_title')} "${deleteModal.review.student_name}"` : t('review_delete_title')}
        message={t('review_delete_msg')}
        confirmText={t('common_delete')}
        cancelText={t('common_cancel')}
        isDanger={true}
      />
    </section>
  );
}
