import i18n from '../i18n';
import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
            <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 font-arabic">
            {i18n.t('error_boundary_title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            {i18n.t('error_boundary_desc')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
            <button 
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              <RefreshCcw className="w-5 h-5" />
              {i18n.t('error_boundary_reload')}
            </button>
            <a 
              href="/"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-white border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl font-bold transition-all shadow-sm active:scale-95"
            >
              <Home className="w-5 h-5" />
              {i18n.t('error_boundary_home')}
            </a>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-12 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50 text-left overflow-auto max-w-2xl w-full">
              <p className="font-mono text-sm text-red-600 dark:text-red-400 break-words">
                {this.state.error.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
