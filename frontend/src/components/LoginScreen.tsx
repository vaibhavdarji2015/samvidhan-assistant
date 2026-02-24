/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    sendEmailVerification
} from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getAuthErrorMessage } from '../lib/firebaseErrors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, Phone, KeyRound, ArrowRight, Landmark } from 'lucide-react';

export const LoginScreen: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Phone States
    const [phoneNumber, setPhoneNumber] = useState('+91'); // Default to India
    const [otp, setOtp] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    // 1. Google Auth
    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Error signing in with Google:", error);
            setError(getAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Email & Password Auth
    const handleEmailAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        if (isSignUp) {
            try {
                // 1. Create the account
                await createUserWithEmailAndPassword(auth, email, password);
                // 2. Send the verification email immediately
                if (auth.currentUser) {
                    await sendEmailVerification(auth.currentUser);
                    // Tell the user to check their inbox!
                    setError("Account created! Please check your email inbox to verify your account.");
                }
            } catch (error: any) {
                console.error("Error signing up:", error);
                setError(getAuthErrorMessage(error));
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error: any) {
                console.error("Error signing in:", error);
                setError(getAuthErrorMessage(error));
            }
        }
        setIsLoading(false);
    };

    // 3. Setup Recaptcha for Phone Auth
    const setupRecaptcha = () => {
        // If it exists but the DOM node is somehow missing/recreated, clear it
        if ((window as any).recaptchaVerifier && !document.getElementById('recaptcha-container')?.innerHTML) {
            try {
                (window as any).recaptchaVerifier.clear();
            } catch (err) { console.debug(err); }
            (window as any).recaptchaVerifier = null;
        }

        if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            });
        }
    };

    // 4. Send OTP
    const handleSendOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            setupRecaptcha();
            const appVerifier = (window as any).recaptchaVerifier;

            if (!appVerifier) {
                throw new Error("Recaptcha not initialized");
            }

            const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            setConfirmationResult(result);
            setError("OTP sent successfully!");
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            setError(getAuthErrorMessage(error));
            // Reset the verifier if there's an app-credential or token error so it can recreate cleanly
            if ((window as any).recaptchaVerifier) {
                try { (window as any).recaptchaVerifier.clear(); } catch (err) { console.debug(err); }
                (window as any).recaptchaVerifier = null;
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Verify OTP
    const handleVerifyOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (!confirmationResult) {
                throw new Error("No OTP sent. Please request OTP first.");
            }
            await confirmationResult.confirm(otp);
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            setError(getAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <Landmark className="w-8 h-8 text-white" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
                    Samvidhan Assistant
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                    Civic Rights & Issue Resolution Platform
                </p>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl border border-slate-100">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    <Tabs defaultValue="email" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="email" className="flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Email
                            </TabsTrigger>
                            <TabsTrigger value="phone" className="flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Phone
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="email">
                            <form onSubmit={handleEmailAuth} className="space-y-4">
                                <div className="space-y-2 text-left">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 text-left">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    {isSignUp ? "Create account" : "Sign In"}
                                </Button>
                                <div className="flex justify-center items-center gap-1 mt-4 text-sm text-slate-500">
                                    <span>{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="text-blue-600 hover:text-blue-700 font-semibold p-0 h-auto"
                                        onClick={() => setIsSignUp(!isSignUp)}
                                    >
                                        {isSignUp ? "Sign In" : "Sign Up"}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>

                        <TabsContent value="phone">
                            {!confirmationResult ? (
                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    <div className="space-y-2 text-left">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="+91 9876543210"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            disabled={isLoading}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                        Send OTP
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                    <div className="space-y-2 text-left">
                                        <Label htmlFor="otp">Enter OTP</Label>
                                        <Input
                                            id="otp"
                                            type="text"
                                            placeholder="123456"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            disabled={isLoading}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                                        Verify OTP
                                    </Button>
                                    <div className="text-center mt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setConfirmationResult(null); setOtp(''); }}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            Change Phone Number
                                        </button>
                                    </div>
                                </form>
                            )}
                        </TabsContent>
                    </Tabs>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-white text-slate-500 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        variant="outline"
                        className="w-full flex justify-center py-6 px-4 hover:bg-slate-50 font-medium text-slate-700 h-11"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 mr-3 animate-spin text-slate-500" />
                        ) : (
                            <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                    <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                    <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                    <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                    <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                </g>
                            </svg>
                        )}
                        Sign in with Google
                    </Button>
                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-500">
                            By continuing, you are securely authenticating via Google Cloud Identity.
                        </p>
                    </div>
                </div>
            </div>
            {/* INVISIBLE RECAPTCHA CONTAINER (Placed OUTSIDE conditional tabs so it is never unmounted) */}
            <div id="recaptcha-container"></div>
        </div>
    );
}