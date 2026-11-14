import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useFieldShift } from '../../context/FieldShiftContext';
import { validateSignUpInput } from '../../lib/validators';
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

export function SignUpView() {
  const {
    language,
    setActiveSection,
    handleEmailSignUp,
    handleGoogleSignIn,
    authError,
    clearAuthError,
  } = useFieldShift();

  const isAr = language === 'ar';
  const firstId = useId();
  const lastId = useId();
  const emailId = useId();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  const activeError = localError || authError;

  const onSubmitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const validationMsg = validateSignUpInput(firstName, lastName, email, password, language);
    if (validationMsg) {
      setLocalError(validationMsg);
      return;
    }

    setSubmitting(true);
    await handleEmailSignUp(firstName, lastName, email, password);
    setSubmitting(false);
  };

  const onGoogleClick = async () => {
    setLocalError(null);
    setSubmitting(true);
    await handleGoogleSignIn('capture');
    setSubmitting(false);
  };

  /* Glass input style shared */
  const glassInput =
    'w-full rounded-full bg-white/90 border border-white/60 px-4 py-3 text-sm font-medium text-[#12233F] placeholder:text-[#66758A] outline-none focus:border-[#1769E0] focus:bg-white transition-all duration-300 shadow-sm';

  return (
    <AuthShell
      title={isAr ? 'إنشاء حساب' : 'Create an account'}
      subtitle={
        isAr
          ? 'احفظ حقولك ودوراتك الزراعية وبيانات المزرعة عبر المواسم.'
          : 'Save your fields, seasonal crop rotations, and satellite snapshots.'
      }
      footerSlot={
        <div className="space-y-3">
          {/* "Have an account?" pill — white card matching design */}
          <div
            className="rounded-full shadow-lg px-5 py-3 text-center text-xs sm:text-sm"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span className="text-[#12233F]">{isAr ? 'لديك حساب بالفعل؟ ' : 'Have an account? '}</span>
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setActiveSection('sign_in');
              }}
              className="font-semibold text-[#1769E0] hover:text-[#062B61] underline underline-offset-2 cursor-pointer transition-colors duration-200"
            >
              {isAr ? 'سجِّل الدخول هنا' : 'Log in here'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setActiveSection('capture');
              }}
              className="text-xs font-medium text-white/70 hover:text-white underline underline-offset-4 cursor-pointer transition-colors duration-200"
            >
              {isAr
                ? 'أو ابدأ تسجيل المزرعة بدون حساب ←'
                : 'Or skip to Farm Capture without an account →'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Google button — white pill with Google icon */}
        <button
          type="button"
          onClick={onGoogleClick}
          disabled={submitting}
          className="w-full rounded-full bg-white hover:bg-white/90 text-[#12233F] py-3 px-5 text-sm font-semibold shadow-md transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer active:scale-[0.98] border border-white/50"
        >
          <GoogleColorIcon />
          <span>{isAr ? 'التسجيل باستخدام جوجل' : 'Sign in with Google'}</span>
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/55">
          <span className="flex-1 h-px bg-white/20" />
          <span>{isAr ? 'أو بالبريد الإلكتروني' : 'or use email'}</span>
          <span className="flex-1 h-px bg-white/20" />
        </div>

        <form onSubmit={onSubmitSignUp} noValidate className="space-y-3">
          {activeError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl bg-red-500/20 border border-red-400/50 px-3.5 py-2.5 text-xs text-white fs-fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
              <span>{activeError}</span>
            </div>
          )}

          {/* First + Last name grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={firstId} className="sr-only">
                {isAr ? 'الاسم الأول' : 'First Name'}
              </label>
              <input
                id={firstId}
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={isAr ? 'الاسم الأول' : 'First Name'}
                autoComplete="given-name"
                disabled={submitting}
                className={glassInput}
              />
            </div>
            <div>
              <label htmlFor={lastId} className="sr-only">
                {isAr ? 'اسم العائلة' : 'Last Name'}
              </label>
              <input
                id={lastId}
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={isAr ? 'اسم العائلة' : 'Last Name'}
                autoComplete="family-name"
                disabled={submitting}
                className={glassInput}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor={emailId} className="sr-only">
              {isAr ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isAr ? 'البريد الإلكتروني' : 'Email'}
              autoComplete="email"
              disabled={submitting}
              className={glassInput}
            />
          </div>

          {/* Password */}
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder={isAr ? 'كلمة المرور' : 'Password'}
            label={isAr ? 'كلمة المرور' : 'Password'}
            autoComplete="new-password"
            disabled={submitting}
            variant="solid"
            isRtl={isAr}
            hint={
              isAr
                ? '8 أحرف على الأقل.'
                : 'At least 8 characters.'
            }
          />

          {/* Submit button — dark pill matching design */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#0B2A5B] hover:bg-[#062B61] text-white font-bold text-sm py-3 px-6 shadow-lg transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isAr ? 'إنشاء الحساب' : 'Create account'}</span>
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
