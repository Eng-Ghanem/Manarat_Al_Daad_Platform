import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';

export default function MainLayout() {
  return (
    <>
      <Navbar />
      <main className="w-full flex-grow">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
