/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { Loader2, User, Mail, Phone } from 'lucide-react';

interface ProfileSettingsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
    const { currentUser } = useAuth();

    const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSave = async () => {
        if (!currentUser) return;
        setIsSaving(true);
        setMessage(null);
        try {
            await updateProfile(currentUser, { displayName });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                        Update your personal details. Changes will be saved across the platform.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="flex items-center gap-2 text-slate-600">
                            <User className="w-4 h-4" /> Full Name
                        </Label>
                        <Input
                            id="name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="bg-slate-50"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email" className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-4 h-4" /> Email Address
                        </Label>
                        <Input
                            id="email"
                            value={currentUser?.email || ''}
                            disabled
                            className="bg-slate-100 text-slate-500 cursor-not-allowed"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone" className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-4 h-4" /> Phone Number
                        </Label>
                        <Input
                            id="phone"
                            value={currentUser?.phoneNumber || 'Not Linked'}
                            disabled
                            className="bg-slate-100 text-slate-500 cursor-not-allowed"
                        />
                    </div>
                </div>

                {message && (
                    <div className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                        {message.text}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || displayName === currentUser?.displayName} className="bg-blue-600 hover:bg-blue-700">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
