import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { Loader2, User, Mail, Phone } from 'lucide-react';

const profileSchema = z.object({
    displayName: z.string().min(2, "Name must be at least 2 characters").max(50, "Name too long"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileSettingsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
    const { currentUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: currentUser?.displayName || ''
        }
    });

    const onSave = async (data: ProfileFormValues) => {
        if (!currentUser) return;
        setIsSaving(true);
        setMessage(null);
        try {
            await updateProfile(currentUser, { displayName: data.displayName });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] glass-card border-white/20 shadow-2xl rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold premium-gradient-text">Profile Settings</DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium pt-1">
                        Update your identity. These details appear on generated legal reports.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSave)}>
                    <div className="grid gap-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                                <User className="w-4 h-4 text-primary" /> Full Name
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g. Rahul Sharma"
                                {...register('displayName')}
                                className={`bg-white/50 border-slate-200 rounded-xl focus-visible:ring-primary/20 h-11 transition-all ${errors.displayName ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                            />
                            {errors.displayName && (
                                <p className="text-xs font-bold text-destructive ml-1">{errors.displayName.message}</p>
                            )}
                        </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email" className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                            <Mail className="w-4 h-4 text-secondary" /> Email Address
                        </Label>
                        <div className="relative">
                            <Input
                                id="email"
                                value={currentUser?.email || ''}
                                disabled
                                className="bg-slate-50/50 text-slate-500 border-slate-200 rounded-xl h-11 cursor-not-allowed font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone" className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                            <Phone className="w-4 h-4 text-secondary" /> Phone Number
                        </Label>
                        <Input
                            id="phone"
                            value={currentUser?.phoneNumber || 'Not Linked'}
                            disabled
                            className="bg-slate-50/50 text-slate-500 border-slate-200 rounded-xl h-11 cursor-not-allowed font-medium"
                        />
                    </div>
                    </div>

                    {message && (
                        <div className={`text-sm font-bold p-3 rounded-xl mb-4 animate-in zoom-in-95 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {message.text}
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 sm:gap-0 mt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-slate-500">Cancel</Button>
                        <Button type="submit" disabled={isSaving || !isDirty} className="bg-primary hover:bg-orange-800 text-white shadow-md shadow-orange-900/10 rounded-xl font-bold px-6 h-11 transition-all">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
