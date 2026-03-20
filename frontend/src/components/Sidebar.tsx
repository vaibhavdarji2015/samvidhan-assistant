import { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, Timestamp, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatHistoryItem {
    chatId: string;
    title: string;
    updatedAt: Timestamp | null;
}

export function Sidebar() {
    const { activeChatId, loadChat, createNewChat } = useChat();
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (!auth.currentUser) return;

        const chatsRef = collection(db, 'users', auth.currentUser.uid, 'chats');
        const q = query(chatsRef, orderBy('updatedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedChats: ChatHistoryItem[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                loadedChats.push({
                    chatId: doc.id,
                    title: data.title || 'New Complaint',
                    updatedAt: data.updatedAt
                });
            });
            setHistory(loadedChats);
        }, (error) => {
            console.error("Failed to load chat history:", error);
        });

        return () => unsubscribe();
    }, []);

    const handleRename = async (chatId: string) => {
        if (!auth.currentUser || !editTitle.trim()) {
            setEditingChatId(null);
            return;
        }
        try {
            const chatRef = doc(db, 'users', auth.currentUser.uid, 'chats', chatId);
            await updateDoc(chatRef, { title: editTitle.trim() });
        } catch (error) {
            console.error("Failed to rename chat:", error);
        }
        setEditingChatId(null);
    };

    const handleDeleteConfirm = async () => {
        if (!auth.currentUser || !chatToDelete) return;

        try {
            const chatRef = doc(db, 'users', auth.currentUser.uid, 'chats', chatToDelete);
            await deleteDoc(chatRef);
            if (activeChatId === chatToDelete) {
                createNewChat();
            }
        } catch (error) {
            console.error("Failed to delete chat:", error);
        }
        setChatToDelete(null);
    };

    return (
        <>
            <div className="w-[280px] glass-sidebar flex flex-col h-screen text-slate-900 shrink-0 hidden md:flex">
                <div className="p-4 mt-2">
                    <button
                        onClick={createNewChat}
                        className="w-full h-12 bg-primary hover:bg-orange-800 text-white shadow-lg shadow-orange-900/20 rounded-2xl transition-all active:scale-95 flex items-center px-5 font-semibold"
                    >
                        <Plus className="w-5 h-5 mr-3" />
                        New Consultation
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-3 mt-6 transition-all">Recent Conversations</div>
                    <div className="space-y-1">
                        {history.length === 0 ? (
                            <p className="text-sm text-slate-400 px-3 py-4 italic">No history yet</p>
                        ) : (
                            history.map((chat) => (
                                <div
                                    key={chat.chatId}
                                    className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center justify-between group relative ${activeChatId === chat.chatId
                                        ? 'bg-white/80 shadow-sm text-slate-900 font-semibold ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:bg-white/40 hover:text-slate-900'
                                        }`}
                                >
                                    {editingChatId === chat.chatId ? (
                                        <div className="flex items-center gap-2 w-full px-1">
                                            <input
                                                autoFocus
                                                className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 text-sm outline-none shadow-sm font-normal"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRename(chat.chatId);
                                                    if (e.key === 'Escape') setEditingChatId(null);
                                                }}
                                                onBlur={() => handleRename(chat.chatId)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => loadChat(chat.chatId)}
                                                className="flex items-center gap-3 flex-1 overflow-hidden"
                                            >
                                                <MessageSquare className={`w-4 h-4 shrink-0 transition-colors ${activeChatId === chat.chatId ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                                                <span className="text-sm truncate">
                                                    {chat.title}
                                                </span>
                                            </button>

                                            <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="p-1 hover:bg-slate-300/50 rounded-md transition-colors text-slate-500 hover:text-slate-700 focus:opacity-100 data-[state=open]:opacity-100">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-40 bg-white shadow-xl border-slate-200">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditTitle(chat.title);
                                                                setEditingChatId(chat.chatId);
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Rename
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setChatToDelete(chat.chatId);
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Chat</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this chat? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setChatToDelete(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
