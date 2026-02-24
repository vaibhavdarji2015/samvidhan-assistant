import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Moon, ShieldCheck, Mail } from 'lucide-react';

interface PreferencesProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function Preferences({ open, onOpenChange }: PreferencesProps) {
    const [notifications, setNotifications] = useState(true);
    const [emails, setEmails] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Preferences</DialogTitle>
                    <DialogDescription>
                        Manage your app experience and notifications.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-lg"><Bell className="w-5 h-5 text-blue-600" /></div>
                            <div>
                                <p className="font-medium text-slate-800 text-sm">Push Notifications</p>
                                <p className="text-xs text-slate-500">Get updates on your active complaints.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setNotifications(!notifications)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${notifications ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifications ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-50 p-2 rounded-lg"><Mail className="w-5 h-5 text-yellow-600" /></div>
                            <div>
                                <p className="font-medium text-slate-800 text-sm">Email Alerts</p>
                                <p className="text-xs text-slate-500">Receive weekly summaries and tips.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setEmails(!emails)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${emails ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${emails ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-lg"><Moon className="w-5 h-5 text-slate-600" /></div>
                            <div>
                                <p className="font-medium text-slate-800 text-sm">Dark Mode</p>
                                <p className="text-xs text-slate-500">Coming soon.</p>
                            </div>
                        </div>
                        <button disabled className="w-11 h-6 rounded-full bg-slate-200 relative">
                            <div className="w-4 h-4 rounded-full bg-white absolute top-1 left-1" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-50 p-2 rounded-lg"><ShieldCheck className="w-5 h-5 text-green-600" /></div>
                            <div>
                                <p className="font-medium text-slate-800 text-sm">Data Privacy</p>
                                <p className="text-xs text-slate-500">Opt-in to anonymous analytics.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { }}
                            className="w-11 h-6 rounded-full bg-blue-600 relative transition-colors"
                        >
                            <div className="w-4 h-4 rounded-full bg-white absolute top-1 left-6 transition-transform" />
                        </button>
                    </div>

                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
