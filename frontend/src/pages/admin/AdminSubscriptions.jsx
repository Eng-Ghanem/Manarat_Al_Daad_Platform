import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, Search, Eye, Filter, Loader, AlertTriangle, 
  ShieldCheck, FileText, X, ArrowRight, ZoomIn, ZoomOut, RotateCcw, Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { getDirectImageUrl } from '../../utils/helpers';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, requestId: null });

  const handleDeleteRequest = (id) => {
    setDeleteConfig({ isOpen: true, requestId: id });
  };

  const confirmDelete = async () => {
    const id = deleteConfig.requestId;
    setDeleteConfig({ isOpen: false, requestId: null });

    const previousRequests = [...requests];
    setRequests(requests.filter(req => req.id !== id));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete');
    } catch (err) {
      console.error('Error deleting subscription:', err);
      alert('حدث خطأ أثناء الحذف.');
      setRequests(previousRequests);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    // Optimistic UI Update: Change instantly, sync in background
    const previousRequests = [...requests];
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: newStatus } : req
    ));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');
    } catch (err) {
      console.error('Error updating subscription:', err);
      alert('حدث خطأ أثناء تحديث حالة الطلب.');
      // Revert if it fails
      setRequests(previousRequests);
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

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300">
                    <th className="py-4 px-6 font-bold font-arabic rounded-tr-2xl">اسم الطالب</th>
                    <th className="py-4 px-6 font-bold font-arabic">الكورس</th>
                    <th className="py-4 px-6 font-bold font-arabic">وسيلة الدفع</th>
                    <th className="py-4 px-6 font-bold font-arabic">الرقم/المحفظة</th>
                    <th className="py-4 px-6 font-bold font-arabic">تاريخ الدفع</th>
                    <th className="py-4 px-6 font-bold font-arabic text-center">الإيصال</th>
                    <th className="py-4 px-6 font-bold font-arabic rounded-tl-2xl text-center">تحديث الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 dark:text-white whitespace-nowrap">{req.studentName}</td>
                      <td className="py-4 px-6 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{req.courseTitle}</td>
                      <td className="py-4 px-6">
                        <span className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap inline-block">
                          {req.paymentMethod === 'vodafone' ? 'فودافون كاش' : 'إنستاباي'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap" dir="ltr">{req.walletNumber}</td>
                      <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                        {new Date(req.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-4 px-6">
                        {req.receiptUrl ? (
                          <button
                            onClick={() => setSelectedReceipt(getDirectImageUrl(req.receiptUrl))}
                            className="mx-auto flex items-center justify-center w-10 h-10 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors shadow-sm"
                            title="عرض الإيصال"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs block text-center">لا يوجد</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center items-center gap-2">
                          <select
                            value={req.status}
                            onChange={(e) => handleStatusChange(req.id, e.target.value)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all outline-none cursor-pointer text-center appearance-none shadow-md min-w-[120px] ${
                              req.status === 'active' ? 'bg-green-500 text-white hover:bg-green-600' :
                              req.status === 'rejected' ? 'bg-red-500 text-white hover:bg-red-600' :
                              'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            <option value="pending" className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold">قيد المراجعة ⏱️</option>
                            <option value="active" className="bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 font-bold">مفعل (نشط) ✅</option>
                            <option value="rejected" className="bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold">مرفوض ❌</option>
                          </select>
                          <button
                            onClick={() => handleDeleteRequest(req.id)}
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors shadow-sm"
                            title="حذف الطلب نهائياً"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRequests.length === 0 && (
                <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-900/30">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-arabic">لا توجد طلبات في هذه الفئة</h3>
                  <p className="text-gray-500 dark:text-gray-400">جميع الطلبات تمت مراجعتها أو القائمة فارغة حالياً.</p>
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

      <ConfirmModal 
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig({ isOpen: false, requestId: null })}
        onConfirm={confirmDelete}
        title="حذف الطلب"
        message="هل أنت متأكد من حذف هذا الطلب نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="نعم، احذف الطلب"
        cancelText="إلغاء"
        isDanger={true}
      />

    </div>
  );
}
