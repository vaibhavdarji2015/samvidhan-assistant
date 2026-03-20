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
            <DialogContent className="sm:max-w-[425px] glass-card border-white/20 shadow-2xl rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold premium-gradient-text">App Preferences</DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium pt-1">
                        Tailor your consultation experience.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-6">

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-100"><Bell className="w-5 h-5 text-primary" /></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Status Notifications</p>
                                <p className="text-[11px] text-slate-500 font-medium">Real-time case updates.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setNotifications(!notifications)}
                            className={`w-12 h-6.5 rounded-full transition-all relative shadow-inner ${notifications ? 'bg-secondary' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${notifications ? 'left-6.5' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100"><Mail className="w-5 h-5 text-secondary" /></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Email Reports</p>
                                <p className="text-[11px] text-slate-500 font-medium">Weekly legal summaries.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setEmails(!emails)}
                            className={`w-12 h-6.5 rounded-full transition-all relative shadow-inner ${emails ? 'bg-secondary' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${emails ? 'left-6.5' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200"><Moon className="w-5 h-5 text-slate-600" /></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Focus Mode (Dark)</p>
                                <p className="text-[11px] text-slate-500 font-medium">Coming soon.</p>
                            </div>
                        </div>
                        <button disabled className="w-12 h-6.5 rounded-full bg-slate-200 relative">
                            <div className="w-4.5 h-4.5 rounded-full bg-white absolute top-1 left-1" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-50 p-2.5 rounded-xl border border-green-100"><ShieldCheck className="w-5 h-5 text-green-600" /></div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Case Privacy</p>
                                <p className="text-[11px] text-slate-500 font-medium">Enhanced data encryption.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-tighter">
                            Verified
                        </div>
                    </div>

                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold w-full h-11 transition-all">
                        Complete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
