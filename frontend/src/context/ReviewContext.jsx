import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ReviewContext = createContext();

export function ReviewProvider({ children }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [userReview, setUserReview] = useState(null);
  const [loadingUserReview, setLoadingUserReview] = useState(false);

  // Fetch the logged-in student's review (if any)
  const fetchUserReview = async () => {
    if (!user) {
      setUserReview(null);
      return;
    }

    try {
      setLoadingUserReview(true);
      // 1. Check Supabase
      const { data, error } = await supabase
        .from('student_reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setUserReview(data[0]);
        return;
      }

      // 2. Check local storage fallback
      const local = JSON.parse(localStorage.getItem('manarat_local_reviews') || '[]');
      const found = local.find((r) => r.user_id === user.id);
      if (found) {
        setUserReview(found);
      } else {
        setUserReview(null);
      }
    } catch (err) {
      console.warn('Error fetching user review:', err);
    } finally {
      setLoadingUserReview(false);
    }
  };

  useEffect(() => {
    fetchUserReview();
  }, [user]);

  const openReviewModal = (reviewToEdit = null) => {
    // If specific review is passed, edit that review.
    // If no review passed, but user already has a review, edit their existing review.
    // Otherwise open in create mode.
    if (reviewToEdit) {
      setEditingReview(reviewToEdit);
    } else if (userReview) {
      setEditingReview(userReview);
    } else {
      setEditingReview(null);
    }
    setIsOpen(true);
  };

  const closeReviewModal = () => {
    setIsOpen(false);
    setEditingReview(null);
  };

  const notifyReviewSaved = (savedReview) => {
    setUserReview(savedReview);
    window.dispatchEvent(new CustomEvent('student_review_saved', { detail: savedReview }));
  };

  const notifyReviewDeleted = (deletedId) => {
    if (userReview && userReview.id === deletedId) {
      setUserReview(null);
    }
    window.dispatchEvent(new CustomEvent('student_review_deleted', { detail: deletedId }));
  };

  return (
    <ReviewContext.Provider
      value={{
        isReviewModalOpen: isOpen,
        editingReview,
        userReview,
        hasUserReviewed: !!userReview,
        loadingUserReview,
        openReviewModal,
        closeReviewModal,
        notifyReviewSaved,
        notifyReviewDeleted,
        refreshUserReview: fetchUserReview,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}
