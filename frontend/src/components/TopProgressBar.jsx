import React, { useEffect, useState } from 'react';

export default function TopProgressBar() {
  const [progress, setProgress] = useState(30);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(70), 100);
    const timer2 = setTimeout(() => setProgress(90), 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent pointer-events-none overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
