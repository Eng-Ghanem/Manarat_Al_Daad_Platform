import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, XCircle, Search, Eye, Filter, Loader, AlertTriangle, 
  ShieldCheck, FileText, X, ArrowRight, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';
import { getDirectImageUrl } from '../../utils/helpers';

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          courses(title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles manually to avoid foreign key relation errors
      const userIds = [...new Set(data.map(req => req.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = {};
      if (profilesData) {
        profilesData.forEach(p => profilesMap[p.id] = p.full_name);
      }

      // Transform data for easier mapping
      const formattedRequests = data.map(req => ({
        id: req.id,
        studentName: profilesMap[req.user_id] || 'غير معروف',
        courseTitle: req.courses?.title || 'غير معروف',
        paymentMethod: req.payment_method,
        walletNumber: req.wallet_number || '-',
        receiptUrl: req.receipt_url,
        status: req.status,
        date: req.created_at
      }));

      setRequests(formattedRequests);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    if (action === 'reject') {
      if (!window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    }
    
    setActionLoading(true);
    try {
      const newStatus = action === 'accept' ? 'active' : 'rejected';
      
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRequests(requests.map(req => 
        req.id === id ? { ...req, status: newStatus } : req
      ));
    } catch (err) {
      console.error(`Error updating subscription ${action}:`, err);
      alert('حدث خطأ أثناء تحديث حالة الطلب.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => req.status === filter);
  const pendingCount = requests.filter(req => req.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
          <Link to="/admin-dashboard" className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md font-bold text-sm">
            <ArrowRight className="w-4 h-4" />
            العودة للوحة التحكم
          </Link>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                <FileText className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-4">
                إدارة طلبات الاشتراك
              </h1>
              <p className="text-blue-200/80 font-medium text-lg max-w-2xl">
                مراجعة وتفعيل اشتراكات الطلاب التي تمت عبر المحافظ الإلكترونية أو إنستاباي.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            
            {/* Elegant Tabs */}
            <div className="flex justify-center border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center gap-2 bg-gray-200/50 dark:bg-slate-900/50 p-1 rounded-2xl">
                <button
                  onClick={() => setFilter('pending')}
                  className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all duration-300 ${filter === 'pending' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  قيد المراجعة
                  {pendingCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${filter === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200'}`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${filter === 'active' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  المفعلة
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${filter === 'rejected' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  المرفوضة
                </button>
              </div>
            </div>

            {/* List */}
            <div className="p-6">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">لا توجد طلبات في هذه الفئة</h3>
                  <p className="text-gray-500 dark:text-gray-400">جميع الطلبات تمت مراجعتها بنجاح.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredRequests.map((req, index) => (
                    <FadeIn key={req.id} delay={index * 50}>
                      <div className="flex flex-col lg:flex-row items-center justify-between p-5 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-slate-600 transition-all group">
                        
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full lg:w-auto text-center sm:text-right">
                          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          
                          <div className="space-y-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{req.studentName}</h3>
                            <p className="text-gray-600 dark:text-gray-300 font-medium">كورس: <span className="text-blue-600 dark:text-blue-400">{req.courseTitle}</span></p>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-500 dark:text-gray-400 mt-2">
                              <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm">
                                {req.paymentMethod === 'vodafone' ? 'فودافون كاش' : 'إنستاباي'}
                              </span>
                              <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm" dir="ltr">
                                {req.walletNumber}
                              </span>
                              <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm">
                                {new Date(req.date).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-6 lg:mt-0 w-full lg:w-auto justify-center lg:justify-end border-t lg:border-t-0 border-gray-200 dark:border-slate-700 pt-4 lg:pt-0">
                          {req.receiptUrl ? (
                            <button
                              onClick={() => setSelectedReceipt(getDirectImageUrl(req.receiptUrl))}
                              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold transition-colors"
                            >
                              <Eye className="w-5 h-5" />
                              <span className="hidden sm:inline">عرض الإيصال</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm px-4">لا يوجد إيصال</span>
                          )}

                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAction(req.id, 'accept')}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-green-500/20 disabled:opacity-50"
                              >
                                <CheckCircle className="w-5 h-5" />
                                <span>قبول</span>
                              </button>
                              <button
                                onClick={() => handleAction(req.id, 'reject')}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-5 h-5" />
                                <span className="hidden sm:inline">رفض</span>
                              </button>
                            </div>
                          )}
                          
                          {req.status === 'active' && (
                            <span className="flex items-center gap-2 px-5 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold rounded-xl border border-green-200 dark:border-green-800/50">
                              <CheckCircle className="w-5 h-5" />
                              تم التفعيل
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl border border-red-200 dark:border-red-800/50">
                              <XCircle className="w-5 h-5" />
                              مرفوض
                            </span>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              )}
            </div>

          </div>
        </FadeIn>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}>
          <div className="relative max-w-4xl w-full h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            {/* Modal Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-50 bg-black/50 p-2 rounded-2xl backdrop-blur-md">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                title="تكبير"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                title="تصغير"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                title="إعادة الضبط"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button 
                onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}
                className="w-10 h-10 bg-red-500/20 hover:bg-red-500/40 text-red-100 rounded-xl flex items-center justify-center transition-colors"
                title="إغلاق"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Image Container with Scroll for Zoom */}
            <div className="w-full h-full overflow-auto flex items-center justify-center rounded-2xl p-4">
              <img 
                src={selectedReceipt} 
                alt="صورة الإيصال" 
                className="max-w-full max-h-full object-contain transition-transform duration-300 origin-center"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
