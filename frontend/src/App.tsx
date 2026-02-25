/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { useSamvidhanChat } from './hooks/useSamvidhanChat';
import { ChatContext } from './context/ChatContext';
import { useAuth } from './context/AuthContext';
import { ChatInput } from './components/ChatInput';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { auth } from './lib/firebase';
import { getAuthErrorMessage } from './lib/firebaseErrors';
export default function App() {
  const [language, setLanguage] = useState('en-IN');
  const chatState = useSamvidhanChat(language);
  const { currentUser } = useAuth();

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleResendEmail = async () => {
    if (!currentUser) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      await sendEmailVerification(currentUser);
      setResendStatus({ type: 'success', message: "Verification email sent! Please check your inbox." });
    } catch (error: any) {
      console.error("Error resending verification email:", error);
      setResendStatus({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyCheck = async () => {
    if (!currentUser) return;
    setIsChecking(true);
    setResendStatus(null);
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        // Trigger a hard reload to ensure Firebase auth state propagates cleanly through the app context
        window.location.reload();
      } else {
        setResendStatus({ type: 'error', message: "Email is not verified yet. Please check your inbox and click the link." });
      }
    } catch (error: any) {
      console.error("Error checking verification status:", error);
      setResendStatus({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setIsChecking(false);
    }
  };


  // 1. If no one is logged in, show the login screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  // If they logged in with Email/Password but haven't clicked the link
  const isEmailAuth = currentUser.providerData.some(p => p.providerId === 'password');

  if (isEmailAuth && !currentUser.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-100 text-center">
          <div className="mx-auto h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify Your Email</h2>
          <p className="text-slate-600 mb-6">
            We sent a verification link to <span className="font-semibold text-slate-900">{currentUser.email}</span>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Please check your inbox (and spam folder) and click the link to verify your account before continuing.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleVerifyCheck}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...
                </>
              ) : (
                "I've Verified My Email"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResendEmail}
              className="w-full h-11"
              disabled={isResending || resendStatus?.type === 'success'}
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => auth.signOut()}
              className="w-full h-11 text-slate-500 hover:text-slate-900"
            >
              Sign out
            </Button>
          </div>
          {resendStatus && (
            <div className={`mt-4 text-sm font-medium ${resendStatus.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {resendStatus.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white flex font-sans overflow-hidden">
      <ChatContext.Provider value={chatState}>
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
          <ChatHeader language={language} setLanguage={setLanguage} />
          <div className="flex-1 w-full mx-auto flex flex-col overflow-hidden px-4 md:px-0 relative pt-2">
            <MessageList />
            <ChatInput />
          </div>
        </div>
      </ChatContext.Provider>
    </div>
  );
}