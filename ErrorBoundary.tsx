import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Language } from '../../types/fieldshift';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  language?: Language;
  onResetHome?: () => void;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering failure.',
    };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isAr = this.props.language === 'ar';
    return (
      <div
        role="alert"
        className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-red-200 p-6 sm:p-8 text-center space-y-4 shadow-sm"
      >
        <div className="w-11 h-11 rounded-xl bg-red-50 text-[#E45C67] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-[#0B2A5B]">
          {isAr ? 'حدث خطأ غير متوقع في عرض هذه الشاشة' : 'This view encountered an unexpected error'}
        </h2>
        <p className="text-xs text-[#66758A] leading-relaxed">
          {this.state.errorMessage}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'إعادة المحاولة' : 'Retry View'}</span>
          </button>
          {this.props.onResetHome && (
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onResetHome?.();
              }}
              className="px-4 py-2 rounded-xl border border-[#DCE7F5] text-xs font-semibold text-[#12233F] hover:border-[#1769E0] cursor-pointer"
            >
              {isAr ? 'العودة للرئيسية' : 'Return Home'}
            </button>
          )}
        </div>
      </div>
    );
  }
}
