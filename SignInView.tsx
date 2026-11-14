import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useFieldShift } from '../../context/FieldShiftContext';
import { validateEmailFormat, validateSignInInput } from '../../lib/validators';
import { AuthShell } from './AuthShell';
import { PasswordField } from './PasswordField';

function GoogleColorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

export function SignInView() {
  const {
    language,
    setActiveSection,
    handleEmailSignIn,
    handleGoogleSignIn,
    handlePasswordReset,
    authError,
    clearAuthError,
  } = useFieldShift();

  const isAr = language === 'ar';
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  const activeError = localError || authError;

  const onSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSuccessMsg(null);
    clearAuthError();

    if (forgotMode) {
      if (!validateEmailFormat(email)) {
        setLocalError(
          isAr ? 'يرجى إدخال بريد إلكتروني صحيح لاستعادة كلمة المرور.' : 'Please enter a valid email address for reset.'
        );
        return;
      }
      setSubmitting(true);
      const ok = await handlePasswordReset(email);
      setSubmitting(false);
      if (ok) {
        setResetSuccessMsg(
          isAr
            ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.'
            : 'Password reset link sent if an account matches that email.'
        );
      }
      return;
    }

    const validationMsg = validateSignInInput(email, password, language);
    if (validationMsg) {
      setLocalError(validationMsg);
      return;
    }

    setSubmitting(true);
    await handleEmailSignIn(email, password);
    setSubmitting(false);
  };

  const onGoogleClick = async () => {
    setLocalError(null);
    setResetSuccessMsg(null);
    setSubmitting(true);
    await handleGoogleSignIn('capture');
    setSubmitting(false);
  };

  return (
    <AuthShell
      title={forgotMode ? (isAr ? 'استعادة كلمة المرور' : 'Reset Password') : isAr ? 'تسجيل الدخول' : 'Log In'}
      subtitle={
        forgotMode
          ? isAr
            ? 'أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.'
            : 'Enter your email to receive a password reset link.'
          : isAr
          ? 'ادخل لمزامنة حقولك وبيانات المزرعة والتقارير.'
          : 'Access your saved fields, environmental baseline, and reports.'
      }
      footerSlot={
        <div className="text-center space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              setActiveSection('capture');
            }}
            className="text-xs font-medium text-white/70 hover:text-white underline underline-offset-4 cursor-pointer transition-colors duration-200"
          >
            {isAr
              ? 'المتابعة بدون حساب ←'
              : 'Continue without account →'}
          </button>
        </div>
      }
    >
      <form onSubmit={onSubmitLogin} noValidate className="space-y-3.5" dir={isAr ? 'rtl' : 'ltr'}>
        {activeError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-red-500/20 border border-red-400/50 px-3.5 py-2.5 text-xs text-white fs-fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
            <span>{activeError}</span>
          </div>
        )}

        {resetSuccessMsg && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-2xl bg-green-500/20 border border-green-400/50 px-3.5 py-2.5 text-xs text-white fs-fade-in"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-300" />
            <span>{resetSuccessMsg}</span>
          </div>
        )}

        {/* Email input — glass rounded pill matching design */}
        <div>
          <label htmlFor={emailId} className="sr-only">
            {isAr ? 'البريد الإلكتروني' : 'Email Address'}
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isAr ? 'البريد الإلكتروني' : 'Email Address'}
            autoComplete="email"
            disabled={submitting}
            className="w-full rounded-full bg-white/18 border border-white/30 px-5 py-3 text-sm font-medium text-white placeholder:text-white/65 outline-none focus:bg-white/25 focus:border-white/60 transition-all duration-300 disabled:opacity-50"
            style={{ backdropFilter: 'blur(8px)' }}
          />
        </div>

        {!forgotMode && (
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder={isAr ? 'كلمة المرور' : 'Password'}
            label={isAr ? 'كلمة المرور' : 'Password'}
            autoComplete="current-password"
            disabled={submitting}
            variant="glass"
            isRtl={isAr}
          />
        )}

        <div className={`flex ${isAr ? 'justify-start' : 'justify-end'} px-1`}>
          <button
            type="button"
            onClick={() => {
              setForgotMode((prev) => !prev);
              setLocalError(null);
              setResetSuccessMsg(null);
              clearAuthError();
            }}
            className="text-xs font-medium text-white/70 hover:text-white underline underline-offset-4 cursor-pointer transition-colors duration-200"
          >
            {forgotMode
              ? isAr
                ? 'العودة لتسجيل الدخول'
                : 'Back to Log In'
              : isAr
              ? 'نسيت كلمة المرور؟'
              : 'Forgot password?'}
          </button>
        </div>

        {/* Primary Login Button — white pill */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-white text-[#0B2A5B] hover:bg-white/90 font-bold text-sm py-3 px-6 shadow-lg transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {forgotMode
              ? isAr
                ? 'إرسال رابط الاستعادة'
                : 'Send Reset Link'
              : isAr
              ? 'تسجيل الدخول'
              : 'Log In'}
          </span>
        </button>

        {/* Divider + Google */}
        <div className="pt-1 space-y-3 text-center">
          <p className="text-xs font-semibold tracking-wide text-white/70">
            {isAr ? 'أو تسجيل الدخول عبر' : 'Log In With'}
          </p>

          <button
            type="button"
            onClick={onGoogleClick}
            disabled={submitting}
            aria-label={isAr ? 'تسجيل الدخول عبر جوجل' : 'Continue with Google'}
            className="mx-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-white hover:bg-white/90 text-[#12233F] px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-md transition-all duration-300 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
          >
            <GoogleColorIcon />
            <span>{isAr ? 'المتابعة بجوجل' : 'Continue with Google'}</span>
          </button>

          <div className="pt-2 border-t border-white/15">
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setActiveSection('sign_up');
              }}
              className="text-sm font-semibold text-white hover:text-white/80 transition-colors duration-200 cursor-pointer"
            >
              {isAr ? 'إنشاء حساب جديد' : 'Create an Account'}
            </button>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
