import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, Search, Eye, Filter, Loader, AlertTriangle, 
  ShieldCheck, FileText, X, ArrowRight, ZoomIn, ZoomOut, RotateCcw, Trash2,
  Clock, PlusCircle, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { getDirectImageUrl, calculateSubscriptionStatus } from '../../utils/helpers';
import toast from 'react-hot-toast';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [extendModalConfig, setExtendModalConfig] = useState({ isOpen: false, requestId: null, studentName: '', currentDays: 30 });
  const [customDays, setCustomDays] = useState(30);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      // Trigger background sync for expired subscriptions on server
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${apiUrl}/api/admin/subscriptions/sync-expired`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          }).catch(() => {});
        }
      } catch (e) {}

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          courses (
            id,
            title,
            access_duration_days
          )
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

      // Transform data with calculated status
      const formattedRequests = data.map(req => {
        const duration = req.courses?.access_duration_days;
        const statusObj = calculateSubscriptionStatus(req, duration);
        
        let computedStatus = req.status;
        if (req.status === 'active' && statusObj.isExpired) {
          computedStatus = 'expired';
        }

        return {
          id: req.id,
          studentName: profilesMap[req.user_id] || 'غير معروف',
          courseTitle: req.courses?.title || 'غير معروف',
          courseDuration: duration,
          paymentMethod: req.payment_method,
          walletNumber: req.wallet_number || '-',
          receiptUrl: req.receipt_url,
          status: computedStatus,
          rawStatus: req.status,
          date: req.created_at,
          statusObj
        };
      });

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
      // 1. Direct Supabase deletion
      const { error: dbError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id);

      if (dbError) {
        // Fallback to backend API if direct DB deletion fails
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });
        if (!res.ok) throw new Error('Failed to delete');
      }

      toast.success(t('admin_subs_msg_deleted'));
    } catch (err) {
      console.error('Error deleting subscription:', err);
      toast.error(t('admin_subs_msg_error'));
      setRequests(previousRequests);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    // Optimistic UI Update: Change instantly
    const previousRequests = [...requests];
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: newStatus, rawStatus: newStatus } : req
    ));

    try {
      const targetReq = requests.find(r => r.id === id);
      let updatePayload = { status: newStatus };

      if (newStatus === 'active') {
        updatePayload.created_at = new Date().toISOString();
        if (targetReq?.courseDuration) {
          const expiresAt = new Date(Date.now() + targetReq.courseDuration * 24 * 60 * 60 * 1000).toISOString();
          updatePayload.expires_at = expiresAt;
        }
      }

      // Try with expires_at first, fallback without it if column doesn't exist
      let { error: dbError } = await supabase
        .from('subscriptions')
        .update(updatePayload)
        .eq('id', id);

      if (dbError && updatePayload.expires_at) {
        const { expires_at, ...cleanPayload } = updatePayload;
        const retry = await supabase
          .from('subscriptions')
          .update(cleanPayload)
          .eq('id', id);
        dbError = retry.error;
      }

      if (dbError) {
        // Fallback to backend API
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
      }

      toast.success(t('admin_subs_msg_updated'));
      fetchRequests(); // Refresh to recalculate validity
    } catch (err) {
      console.error('Error updating subscription:', err);
      toast.error(t('admin_subs_msg_error'));
      setRequests(previousRequests);
    }
  };

  const openExtendModal = (req) => {
    const defaultDays = req.courseDuration || 30;
    setCustomDays(defaultDays);
    setExtendModalConfig({
      isOpen: true,
      requestId: req.id,
      studentName: req.studentName,
      currentDays: defaultDays
    });
  };

  const confirmExtend = async () => {
    const id = extendModalConfig.requestId;
    const daysToAdd = Number(customDays) || 30;
    setExtendModalConfig({ isOpen: false, requestId: null, studentName: '', currentDays: 30 });

    try {
      const newExpiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
      const updateData = {
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: newExpiresAt
      };

      let { error: dbError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', id);

      if (dbError) {
        // Retry without expires_at if column not present
        const retry = await supabase
          .from('subscriptions')
          .update({ status: 'active', created_at: new Date().toISOString() })
          .eq('id', id);
        dbError = retry.error;
      }

      if (dbError) {
        // Fallback to backend API
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}/extend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ days: daysToAdd })
        });
        if (!res.ok) throw new Error('Failed to extend');
      }

      toast.success(t('admin_subs_msg_extended'));
      fetchRequests();
    } catch (err) {
      console.error('Error extending subscription:', err);
      toast.error(t('admin_subs_msg_error'));
    }
  };

  const filteredRequests = requests.filter(req => req.status === filter);
  const pendingCount = requests.filter(req => req.status === 'pending').length;
  const activeCount = requests.filter(req => req.status === 'active').length;
  const expiredCount = requests.filter(req => req.status === 'expired').length;
  const rejectedCount = requests.filter(req => req.status === 'rejected').length;

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
            {t('admin_back_to_dashboard')}
          </Link>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                <FileText className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-4">{t('admin_subs_title')}</h1>
              <p className="text-blue-200/80 font-medium text-lg max-w-2xl">
                {t('admin_subs_desc')}
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
              <div className="flex flex-wrap items-center justify-center gap-2 bg-gray-200/50 dark:bg-slate-900/50 p-1.5 rounded-2xl">
                <button
                  onClick={() => setFilter('pending')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${filter === 'pending' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_subs_tab_pending')}
                  {pendingCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${filter === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200'}`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${filter === 'active' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_subs_tab_all_active')}
                  {activeCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${filter === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200'}`}>
                      {activeCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilter('expired')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${filter === 'expired' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_subs_tab_all_expired')}
                  {expiredCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${filter === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200'}`}>
                      {expiredCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${filter === 'rejected' ? 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 shadow-sm transform scale-105' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_subs_tab_all_rejected')}
                  {rejectedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200">
                      {rejectedCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full rtl:text-right ltr:text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300">
                    <th className="py-4 px-6 font-bold font-arabic rtl:rounded-tr-2xl ltr:rounded-tl-2xl">{t('admin_subs_th_student')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('admin_subs_th_course')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('admin_subs_th_validity')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('admin_quizzes_th_status')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('admin_subs_th_method')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('checkout_sender_number_label')}</th>
                    <th className="py-4 px-6 font-bold font-arabic">{t('admin_subs_th_date')}</th>
                    <th className="py-4 px-6 font-bold font-arabic text-center">{t('admin_subs_th_receipt')}</th>
                    <th className="py-4 px-6 font-bold font-arabic rtl:rounded-tl-2xl ltr:rounded-tr-2xl text-center">{t('admin_subs_th_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => (
                    <tr key={req.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 dark:text-white whitespace-nowrap">{req.studentName}</td>
                      <td className="py-4 px-6 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{req.courseTitle}</td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                          {req.courseDuration ? `${req.courseDuration} ${t('admin_subs_status_days')}` : t('admin_subs_lifetime')}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {req.status === 'active' ? (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 w-fit ${
                            req.statusObj?.isExpiringSoon 
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' 
                              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            {req.statusObj?.statusText || t('admin_subs_status_active')}
                          </span>
                        ) : req.status === 'expired' ? (
                          <span className="text-xs font-bold px-3 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 flex items-center gap-1.5 w-fit">
                            <Clock className="w-3.5 h-3.5" />
                            {t('admin_subs_status_expired_badge')}
                          </span>
                        ) : req.status === 'pending' ? (
                          <span className="text-xs font-bold px-3 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1.5 w-fit">
                            <Clock className="w-3.5 h-3.5" />
                            {t('admin_subs_status_reviewing')}
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-3 py-1 rounded-full border bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700 flex items-center gap-1.5 w-fit">
                            {t('admin_subs_status_rejected')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap inline-block">
                          {req.paymentMethod === 'vodafone' ? 'Vodafone Cash' : req.paymentMethod === 'instapay' ? 'InstaPay' : (t('checkout_method_wallet') || 'E-Wallet')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap" dir="ltr">{req.walletNumber}</td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <span className="text-gray-400 font-bold">{t('admin_start_time') || 'بدأ:'}</span>
                            <span>{new Date(req.date).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 font-bold">{t('admin_end_time') || 'انتهى:'}</span>
                            {req.statusObj?.expiryDate ? (
                              <span className={req.status === 'expired' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                {new Date(req.statusObj.expiryDate).toLocaleDateString('ar-EG')}
                              </span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">{t('course_lifetime_access') || 'مدى الحياة'}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {req.receiptUrl ? (
                          <button
                            onClick={() => setSelectedReceipt(getDirectImageUrl(req.receiptUrl))}
                            className="mx-auto flex items-center justify-center w-10 h-10 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors shadow-sm"
                            title={t('admin_subs_preview_receipt')}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs block text-center">{t('admin_subs_no_receipt')}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center items-center gap-2 flex-wrap">
                          {/* Extend button for expired or active */}
                          {(req.status === 'expired' || req.status === 'active') && (
                            <button
                              onClick={() => openExtendModal(req)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
                              title={t('admin_subs_extend_title')}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              تمديد
                            </button>
                          )}

                          <select
                            value={req.status}
                            onChange={(e) => handleStatusChange(req.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all outline-none cursor-pointer text-center appearance-none shadow-sm ${
                              req.status === 'active' ? 'bg-green-500 text-white hover:bg-green-600' :
                              req.status === 'expired' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                              req.status === 'rejected' ? 'bg-red-500 text-white hover:bg-red-600' :
                              'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            <option value="pending" className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold">{t('admin_subs_tab_pending')} ⏱️</option>
                            <option value="active" className="bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 font-bold">{t('admin_subs_tab_active')} ✅</option>
                            <option value="expired" className="bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 font-bold">{t('admin_subs_status_expired_badge')} ⏱️</option>
                            <option value="rejected" className="bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold">{t('admin_subs_tab_rejected')} ❌</option>
                          </select>

                          <button
                            onClick={() => handleDeleteRequest(req.id)}
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors shadow-sm"
                            title={t('admin_subs_btn_delete')}
                          >
                            <Trash2 className="w-4 h-4" />
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
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-arabic">{t('admin_subs_no_records')}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{t('admin_no_sessions_desc') || 'القائمة فارغة حالياً'}</p>
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

      {/* Extend Subscription Modal */}
      {extendModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white font-arabic text-center mb-2">
              {t('admin_subs_extend_title')}
            </h3>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              تمديد صلاحية كورس الطالب <span className="font-bold text-gray-900 dark:text-white">({extendModalConfig.studentName})</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t('admin_subs_extend_desc')}
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="1" 
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-center text-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
                <span className="text-gray-500 font-bold whitespace-nowrap">{t('admin_subs_status_days')}</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[2, 7, 15, 30, 60].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCustomDays(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${customDays === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-200'}`}
                  >
                    {d} {t('admin_subs_status_days')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmExtend}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md"
              >
                {t('admin_subs_extend_btn')}
              </button>
              <button
                onClick={() => setExtendModalConfig({ isOpen: false, requestId: null, studentName: '', currentDays: 30 })}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig({ isOpen: false, requestId: null })}
        onConfirm={confirmDelete}
        title={t('admin_subs_delete_title')}
        message={t('admin_subs_delete_msg')}
        confirmText={t('admin_subs_btn_delete')}
        cancelText={t('common_cancel')}
        isDanger={true}
      />

    </div>
  );
}
