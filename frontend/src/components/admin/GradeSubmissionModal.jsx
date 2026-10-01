import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function GradeSubmissionModal({ isOpen, onClose, submission, onGradeSaved }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [essayGrades, setEssayGrades] = useState({});

  useEffect(() => {
    if (isOpen && submission) {
      fetchQuestions();
      // Initialize essay grades from existing graded_marks if available
      if (submission.graded_marks) {
        setEssayGrades(submission.graded_marks);
      } else {
        setEssayGrades({});
      }
    }
  }, [isOpen, submission]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', submission.quiz_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error fetching questions:', err);
      toast.error('حدث خطأ أثناء تحميل الأسئلة');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (questionId, value, maxMarks) => {
    let numValue = parseInt(value) || 0;
    if (numValue < 0) numValue = 0;
    if (numValue > maxMarks) numValue = maxMarks;

    setEssayGrades(prev => ({
      ...prev,
      [questionId]: numValue
    }));
  };

  const handleSaveGrades = async () => {
    try {
      setSaving(true);

      // Calculate total essay score
      let totalEssayScore = 0;
      Object.values(essayGrades).forEach(mark => {
        totalEssayScore += mark;
      });

      // The previous score is just MCQ score (as calculated by submit_quiz)
      // If we are grading again, we should recalculate the MCQ score to be safe, 
      // but for simplicity, let's recalculate the entire score based on answers.
      
      let mcqScore = 0;
      questions.forEach(q => {
        if (!q.question_type || q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
          const studentAnswer = submission.answers[q.id];
          // Try to cast to int safely like in SQL
          if (studentAnswer !== undefined && studentAnswer !== null) {
            const intAnswer = parseInt(studentAnswer);
            if (!isNaN(intAnswer) && intAnswer === q.correct_option_index) {
              mcqScore += q.marks;
            }
          }
        }
      });

      const finalScore = mcqScore + totalEssayScore;

      const { error: updateError } = await supabase
        .from('quiz_submissions')
        .update({
          score: finalScore,
          status: 'completed',
          graded_marks: essayGrades
        })
        .eq('id', submission.id);

      if (updateError) throw updateError;

      // إرسال إشعار للطالب
      await supabase.from('notifications').insert([{
        user_id: submission.student_id,
        title: 'تم تصحيح امتحانك!',
        message: `قام المعلم بتصحيح امتحانك. نتيجتك النهائية هي: ${finalScore} من ${submission.total_marks}.`,
        type: 'quiz_graded',
        link: `/quizzes/${submission.quiz_id}/result`
      }]);

      toast.success('تم اعتماد الدرجة بنجاح');
      onGradeSaved();
      onClose();

    } catch (err) {
      console.error('Error saving grades:', err);
      toast.error('حدث خطأ أثناء حفظ الدرجات');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !submission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm font-arabic">
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              تصحيح إجابات الطالب
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {submission.student?.full_name}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            questions.map((q, idx) => {
              const studentAnswer = submission.answers[q.id];
              const isEssay = q.question_type === 'essay';

              return (
                <div key={q.id} className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-700">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                      <span className="text-blue-600 dark:text-blue-400 ml-2">{idx + 1}.</span>
                      {q.text}
                    </h4>
                    <span className="shrink-0 px-3 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold">
                      {q.marks} درجات
                    </span>
                  </div>

                  {isEssay ? (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-600">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">إجابة الطالب:</p>
                        <p className="text-gray-900 dark:text-white whitespace-pre-wrap font-medium">
                          {studentAnswer || <span className="text-red-500 italic">لم يقم الطالب بالإجابة</span>}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                        <label className="font-bold text-blue-800 dark:text-blue-300">تقييم المعلم للسؤال:</label>
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
                          <input 
                            type="number" 
                            min="0" 
                            max={q.marks}
                            value={essayGrades[q.id] !== undefined ? essayGrades[q.id] : ''}
                            onChange={(e) => handleGradeChange(q.id, e.target.value, q.marks)}
                            className="w-20 px-3 py-2 text-center border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="0"
                          />
                            <span className="text-gray-500 dark:text-gray-400 font-bold">من {q.marks}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">نوع السؤال: اختياري (يُصحح تلقائياً)</p>
                      {q.options?.map((opt, optIdx) => {
                        const isStudentChoice = parseInt(studentAnswer) === optIdx;
                        const isCorrectAnswer = q.correct_option_index === optIdx;
                        
                        let optClass = "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500";
                        if (isCorrectAnswer && isStudentChoice) {
                          optClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold border-2";
                        } else if (isCorrectAnswer) {
                          optClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-2";
                        } else if (isStudentChoice) {
                          optClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-bold border-2";
                        }

                        return (
                          <div key={optIdx} className={`p-3 rounded-xl flex items-center gap-3 ${optClass}`}>
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                              {(isCorrectAnswer && isStudentChoice) && <CheckCircle className="w-5 h-5 text-green-500" />}
                              {(!isCorrectAnswer && isStudentChoice) && <AlertCircle className="w-5 h-5 text-red-500" />}
                              {(isCorrectAnswer && !isStudentChoice) && <CheckCircle className="w-5 h-5 text-green-500 opacity-50" />}
                            </div>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            إغلاق
          </button>
          <button 
            onClick={handleSaveGrades}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
            اعتماد وحفظ النتيجة
          </button>
        </div>

      </div>
    </div>
  );
}
