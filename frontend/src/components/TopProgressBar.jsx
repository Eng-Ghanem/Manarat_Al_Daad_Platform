import React, { useEffect, useState } from 'react';

export default function TopProgressBar() {
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(65), 100);
    const t2 = setTimeout(() => setProgress(88), 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-[3px] bg-transparent pointer-events-none overflow-hidden">
      {/* Background track blur */}
      <div 
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 transition-all duration-300 ease-out relative"
        style={{ width: `${progress}%` }}
      >
        {/* Glowing Head of the bar */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-white/60 blur-[3px] shadow-[0_0_15px_rgba(59,130,246,0.9)]" />
      </div>
    </div>
  );
}
