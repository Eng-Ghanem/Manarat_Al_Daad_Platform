import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'تأكيد', 
  cancelText = 'إلغاء', 
  isDanger = false 
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl p-8 overflow-hidden z-10 border border-gray-100 dark:border-slate-700"
          >
            {/* Decorative background circle */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${isDanger ? 'bg-red-500' : 'bg-blue-500'}`} />
            
            <div className="flex flex-col items-center text-center relative z-10">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", bounce: 0.5 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${
                  isDanger 
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' 
                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }`}
              >
                {isDanger ? <Trash2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
              </motion.div>
              
              <h3 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-3">
                {title}
              </h3>
              
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-arabic text-lg">
                {message}
              </p>
              
              <div className="flex gap-4 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-2xl font-bold font-arabic text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors shadow-sm"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-6 py-3.5 rounded-2xl font-bold font-arabic text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${
                    isDanger 
                      ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/30' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-blue-500/30'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
