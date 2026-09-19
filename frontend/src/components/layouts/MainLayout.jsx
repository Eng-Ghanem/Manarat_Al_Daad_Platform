import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';
import TopProgressBar from '../TopProgressBar';
import AddReviewModal from '../home/AddReviewModal';
import { useReview } from '../../context/ReviewContext';

import MobileBottomNav from '../MobileBottomNav';

export default function MainLayout() {
  const location = useLocation();
  const isChatPage = location.pathname === '/chat' || location.pathname.startsWith('/admin-dashboard/chat');
  const { isReviewModalOpen, closeReviewModal, editingReview, notifyReviewSaved } = useReview();

  return (
    <>
      <Navbar />
      <main className="w-full flex-grow pb-16 md:pb-0">
        <Suspense fallback={<TopProgressBar />}>
          <Outlet />
        </Suspense>
      </main>
      {!isChatPage && <Footer />}
      <MobileBottomNav />

      <AddReviewModal
        isOpen={isReviewModalOpen}
        onClose={closeReviewModal}
        editingReview={editingReview}
        onReviewSaved={notifyReviewSaved}
      />
    </>
  );
}
