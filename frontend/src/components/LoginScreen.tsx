import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const emailSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

const phoneSchema = z.object({
    phoneNumber: z.string().min(10, "Invalid phone number"),
});

const otpSchema = z.object({
    otp: z.string().length(6, "OTP must be 6 digits"),
});

export const LoginScreen: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    const emailForm = useForm<z.infer<typeof emailSchema>>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: '', password: '' }
    });

    const phoneForm = useForm<z.infer<typeof phoneSchema>>({
        resolver: zodResolver(phoneSchema),
        defaultValues: { phoneNumber: '+91' }
    });

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
        defaultValues: { otp: '' }
    });

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
    const onEmailSubmit = async (data: z.infer<typeof emailSchema>) => {
        setIsLoading(true);
        setError(null);

        if (isSignUp) {
            try {
                await createUserWithEmailAndPassword(auth, data.email, data.password);
                if (auth.currentUser) {
                    await sendEmailVerification(auth.currentUser);
                    setError("Account created! Please check your email inbox to verify your account.");
                }
            } catch (error: any) {
                console.error("Error signing up:", error);
                setError(getAuthErrorMessage(error));
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, data.email, data.password);
            } catch (error: any) {
                console.error("Error signing in:", error);
                setError(getAuthErrorMessage(error));
            }
        }
        setIsLoading(false);
    };

    // 4. Send OTP
    const onPhoneSubmit = async (data: z.infer<typeof phoneSchema>) => {
        setIsLoading(true);
        setError(null);

        try {
            setupRecaptcha();
            const appVerifier = (window as any).recaptchaVerifier;
            if (!appVerifier) throw new Error("Recaptcha not initialized");

            const result = await signInWithPhoneNumber(auth, data.phoneNumber, appVerifier);
            setConfirmationResult(result);
            setError("OTP sent successfully!");
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            setError(getAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Verify OTP
    const onOtpSubmit = async (data: z.infer<typeof otpSchema>) => {
        setIsLoading(true);
        setError(null);

        try {
            if (!confirmationResult) throw new Error("No OTP sent.");
            await confirmationResult.confirm(data.otp);
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            setError(getAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const setupRecaptcha = () => {
        if ((window as any).recaptchaVerifier && !document.getElementById('recaptcha-container')?.innerHTML) {
            try { (window as any).recaptchaVerifier.clear(); } catch (err) { }
            (window as any).recaptchaVerifier = null;
        }
        if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto h-20 w-20 bg-primary rounded-3xl flex items-center justify-center shadow-xl shadow-orange-900/20 rotate-3 transform transition-transform hover:rotate-0">
                    <Landmark className="w-10 h-10 text-primary-foreground" />
                </div>
                <h2 className="mt-8 text-center text-4xl font-bold premium-gradient-text tracking-tight">
                    Samvidhan Assistant
                </h2>
                <p className="mt-2 text-center text-sm font-semibold text-slate-500 uppercase tracking-widest opacity-80">
                    Civic Rights & Issue Resolution
                </p>
            </div>
            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="glass-card py-10 px-8 shadow-2xl sm:rounded-3xl mx-4 sm:mx-0">
                    {error && (
                        <div className="mb-8 bg-red-50/50 backdrop-blur-sm border border-red-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-1">
                            <p className="text-sm text-red-600 font-bold">{error}</p>
                        </div>
                    )}

                    <Tabs defaultValue="email" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100/50 p-1 rounded-xl">
                            <TabsTrigger value="email" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Mail className="w-4 h-4" /> Email
                            </TabsTrigger>
                            <TabsTrigger value="phone" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Phone className="w-4 h-4" /> Phone
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="email">
                            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                                <div className="space-y-2 text-left">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        placeholder="Enter your email"
                                        {...emailForm.register('email')}
                                        aria-invalid={!!emailForm.formState.errors.email}
                                        className="bg-white/50 border-slate-200 rounded-xl h-12"
                                    />
                                    {emailForm.formState.errors.email && (
                                        <p className="text-xs font-bold text-destructive mt-1 ml-1">{emailForm.formState.errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2 text-left">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        {...emailForm.register('password')}
                                        aria-invalid={!!emailForm.formState.errors.password}
                                        className="bg-white/50 border-slate-200 rounded-xl h-12"
                                    />
                                    {emailForm.formState.errors.password && (
                                        <p className="text-xs font-bold text-destructive mt-1 ml-1">{emailForm.formState.errors.password.message}</p>
                                    )}
                                </div>
                                <Button type="submit" className="w-full h-12 bg-primary hover:bg-orange-800 text-white shadow-lg shadow-orange-900/10 rounded-xl font-bold mt-2" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    {isSignUp ? "Create account" : "Sign In"}
                                </Button>
                                <div className="flex justify-center items-center gap-1 mt-6 text-sm text-slate-500">
                                    <span>{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="text-secondary hover:text-teal-700 font-bold p-0 h-auto"
                                        onClick={() => setIsSignUp(!isSignUp)}
                                    >
                                        {isSignUp ? "Sign In" : "Sign Up"}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>

                        <TabsContent value="phone">
                            {!confirmationResult ? (
                                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                                    <div className="space-y-2 text-left">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            placeholder="+91 9876543210"
                                            {...phoneForm.register('phoneNumber')}
                                            aria-invalid={!!phoneForm.formState.errors.phoneNumber}
                                            className="bg-white/50 border-slate-200 rounded-xl h-12"
                                        />
                                        {phoneForm.formState.errors.phoneNumber && (
                                            <p className="text-xs font-bold text-destructive mt-1 ml-1">{phoneForm.formState.errors.phoneNumber.message}</p>
                                        )}
                                    </div>
                                    <Button type="submit" className="w-full h-12 bg-primary hover:bg-orange-800 text-white shadow-lg shadow-orange-900/10 rounded-xl font-bold mt-2" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                        Send OTP
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                                    <div className="space-y-2 text-left">
                                        <Label htmlFor="otp">Enter OTP</Label>
                                        <Input
                                            id="otp"
                                            placeholder="123456"
                                            {...otpForm.register('otp')}
                                            aria-invalid={!!otpForm.formState.errors.otp}
                                            className="bg-white/50 border-slate-200 rounded-xl h-12"
                                        />
                                        {otpForm.formState.errors.otp && (
                                            <p className="text-xs font-bold text-destructive mt-1 ml-1">{otpForm.formState.errors.otp.message}</p>
                                        )}
                                    </div>
                                    <Button type="submit" className="w-full h-12 bg-primary hover:bg-orange-800 text-white shadow-lg shadow-orange-900/10 rounded-xl font-bold mt-2" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                                        Verify OTP
                                    </Button>
                                    <div className="text-center mt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setConfirmationResult(null); otpForm.reset(); }}
                                            className="text-xs font-bold text-secondary hover:underline"
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