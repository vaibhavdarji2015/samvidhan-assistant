import { FirebaseError } from 'firebase/app';

export const getAuthErrorMessage = (error: unknown): string => {
    if (error instanceof FirebaseError) {
        switch (error.code) {
            // Email/Password Auth Errors
            case 'auth/email-already-in-use':
                return 'An account already exists with this email address. Please sign in instead.';
            case 'auth/invalid-email':
                return 'The email address provided is invalid. Please check and try again.';
            case 'auth/user-not-found':
                return 'No account found with this email. Please check your email or sign up.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/weak-password':
                return 'Your password is too weak. Please use at least 6 characters.';
            case 'auth/invalid-credential':
                return 'Invalid credentials provided. Please double check your email and password.';

            // Phone Auth Errors
            case 'auth/invalid-phone-number':
                return 'The phone number provided is invalid. Please enter a valid number including country code (e.g., +91).';
            case 'auth/too-many-requests':
                return 'Too many requests. We have temporarily blocked this device due to unusual activity. Try again later.';
            case 'auth/quota-exceeded':
                return 'SMS quota exceeded. Please try again later or use another sign in method.';
            case 'auth/code-expired':
                return 'The verification code has expired. Please request a new OTP.';
            case 'auth/invalid-verification-code':
                return 'The OTP entered is incorrect. Please double check and try again.';

            // General Auth Errors
            case 'auth/user-disabled':
                return 'This account has been disabled by an administrator. Please contact support.';
            case 'auth/operation-not-allowed':
                return 'This sign-in method is currently disabled. Please contact support.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection and try again.';

            default:
                // Fallback for unknown Firebase errors
                return `Authentication failed: ${error.message.replace('Firebase: ', '')}`;
        }
    }

    // For non-Firebase errors (e.g., standard JS Errors)
    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred. Please try again later.';
};
