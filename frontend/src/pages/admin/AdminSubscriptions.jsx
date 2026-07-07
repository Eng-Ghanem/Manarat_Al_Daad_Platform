import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Search, Eye, Filter, Loader, AlertTriangle, ShieldCheck } from 'lucide-react';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <FadeIn>
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-3xl p-8 mb-8 text-white flex flex-col md:flex-row items-center justify-between shadow-xl gap-6">
            <div>
              <h1 className="text-3xl font-extrabold font-arabic mb-2 flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-blue-400" />
                إدارة طلبات الاشتراك
              </h1>
              <p className="text-blue-200">مراجعة وتفعيل اشتراكات الطلاب التي تمت عبر المحافظ الإلكترونية وإنستاباي.</p>
            </div>
            
            <div className="flex bg-slate-800/50 p-1 rounded-xl">
              <button 
                onClick={() => setFilter('pending')}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${filter === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                قيد المراجعة
                <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              </button>
              <button 
                onClick={() => setFilter('active')}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${filter === 'active' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                المفعلة
              </button>
              <button 
                onClick={() => setFilter('rejected')}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${filter === 'rejected' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                المرفوضة
              </button>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                  <Filter className="w-8 h-8" />
                </div>
                <p className="text-lg font-bold">لا توجد طلبات {filter === 'pending' ? 'جديدة قيد المراجعة' : 'بهذه الحالة'}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                      <th className="px-6 py-4 font-bold text-sm">تاريخ الطلب</th>
                      <th className="px-6 py-4 font-bold text-sm">الطالب</th>
                      <th className="px-6 py-4 font-bold text-sm">الكورس</th>
                      <th className="px-6 py-4 font-bold text-sm">طريقة الدفع</th>
                      <th className="px-6 py-4 font-bold text-sm">رقم المحفظة</th>
                      <th className="px-6 py-4 font-bold text-sm text-center">الإيصال</th>
                      {filter === 'pending' && <th className="px-6 py-4 font-bold text-sm text-center">الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(req.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          {req.studentName}
                        </td>
                        <td className="px-6 py-4 text-sm text-blue-600 dark:text-blue-400 font-bold">
                          {req.courseTitle}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            req.paymentMethod === 'instapay' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            {req.paymentMethod === 'instapay' ? 'إنستاباي' : 'محفظة إلكترونية'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-500 dark:text-gray-400" dir="ltr">
                          {req.walletNumber}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {req.receiptUrl ? (
                            <button 
                              onClick={() => setSelectedReceipt(req.receiptUrl)}
                              className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title="عرض الإيصال"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">بدون إيصال</span>
                          )}
                        </td>
                        {filter === 'pending' && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleAction(req.id, 'accept')}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                                تفعيل
                              </button>
                              <button 
                                onClick={() => handleAction(req.id, 'reject')}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                رفض
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Receipt Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">إيصال التحويل المرفق</h3>
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <img src={selectedReceipt} alt="Receipt" className="max-w-full h-auto rounded-lg shadow-sm" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
