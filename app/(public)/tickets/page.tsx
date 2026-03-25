'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/error-debug-toast';
import {
    MessageSquare, Plus, Send, Clock, Check,
    AlertCircle, User, ArrowLeft
} from 'lucide-react';

interface Ticket {
    id: string;
    user_id: string;
    title: string;
    status: 'open' | 'in-progress' | 'resolved' | 'closed';
    assigned_to?: string;
    created_at: string;
    updated_at: string;
    messages?: TicketMessage[];
}

interface TicketMessage {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    sender_name?: string;
}

export default function TicketsPage() {
    const { user, isHelper, isAdmin } = useAuth();
    const addToast = useToast(s => s.addToast);

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    const [showCreate, setShowCreate] = useState(false);
    const [newTicketTitle, setNewTicketTitle] = useState('');
    const [creating, setCreating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            loadMessages(selectedTicket.id);
        }
    }, [selectedTicket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tickets');
            if (res.ok) setTickets(await res.json());
        } catch { } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch { }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicketTitle.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTicketTitle }),
            });
            if (!res.ok) throw new Error('Failed to create ticket');
            addToast({ type: 'success', title: 'Created', message: 'Ticket created!' });
            setShowCreate(false);
            setNewTicketTitle('');
            loadTickets();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setCreating(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedTicket) return;
        setSending(true);
        try {
            const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage }),
            });
            if (!res.ok) throw new Error('Failed to send message');
            setNewMessage('');
            loadMessages(selectedTicket.id);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSending(false);
        }
    };

    const updateTicketStatus = async (ticketId: string, status: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error('Failed to update');
            addToast({ type: 'success', title: 'Updated', message: `Ticket ${status}.` });
            loadTickets();
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket({ ...selectedTicket, status: status as any });
            }
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
        open: 'success',
        'in-progress': 'warning',
        resolved: 'default',
        closed: 'default',
    };

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <MessageSquare className="size-7 text-emerald-400" />
                            Support Tickets
                        </h1>
                        <p className="text-white/40 mt-1">Get help from our support team</p>
                    </div>
                    <Button icon={<Plus className="size-4" />} onClick={() => setShowCreate(true)}>
                        New Ticket
                    </Button>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Ticket List */}
                    <div className="lg:col-span-1">
                        <Card variant="glass" padding="sm">
                            <div className="p-4 border-b border-white/[0.06]">
                                <h3 className="font-bold text-white">Your Tickets</h3>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="p-4 border-b border-white/[0.04]">
                                            <div className="h-4 bg-white/[0.06] rounded w-2/3 animate-pulse" />
                                            <div className="h-3 bg-white/[0.06] rounded w-1/3 mt-2 animate-pulse" />
                                        </div>
                                    ))
                                ) : tickets.length === 0 ? (
                                    <div className="text-center py-12 text-white/30 text-sm">
                                        No tickets yet
                                    </div>
                                ) : (
                                    tickets.map(ticket => (
                                        <button
                                            key={ticket.id}
                                            onClick={() => setSelectedTicket(ticket)}
                                            className={`w-full text-left p-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${selectedTicket?.id === ticket.id ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-sm font-medium text-white truncate pr-2">{ticket.title}</h4>
                                                <Badge variant={statusColors[ticket.status]} size="sm">{ticket.status}</Badge>
                                            </div>
                                            <p className="text-xs text-white/30">
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </p>
                                        </button>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Ticket Detail */}
                    <div className="lg:col-span-2">
                        {selectedTicket ? (
                            <Card variant="glass" padding="none" className="h-[600px] flex flex-col">
                                {/* Header */}
                                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/40">
                                            <ArrowLeft className="size-4" />
                                        </button>
                                        <div>
                                            <h3 className="font-bold text-white">{selectedTicket.title}</h3>
                                            <p className="text-xs text-white/30">
                                                #{selectedTicket.id?.slice(0, 8)} • {new Date(selectedTicket.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={statusColors[selectedTicket.status]}>{selectedTicket.status}</Badge>
                                        {(isHelper || isAdmin) && selectedTicket.status === 'open' && (
                                            <Button variant="secondary" size="sm" onClick={() => updateTicketStatus(selectedTicket.id, 'in-progress')}>
                                                Assign
                                            </Button>
                                        )}
                                        {(isHelper || isAdmin) && selectedTicket.status === 'in-progress' && (
                                            <Button variant="secondary" size="sm" onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}>
                                                Resolve
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {messages.map((msg, i) => {
                                        const isOwn = msg.sender_id === user?.id;
                                        return (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.02 }}
                                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[80%] ${isOwn ? 'order-2' : ''}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {!isOwn && <Avatar name={msg.sender_name || 'Support'} size="sm" />}
                                                        <span className="text-xs text-white/30">{msg.sender_name || 'You'}</span>
                                                    </div>
                                                    <div className={`p-3 rounded-2xl ${isOwn
                                                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-white'
                                                            : 'bg-white/[0.03] border border-white/[0.06] text-white/80'
                                                        }`}>
                                                        {msg.message}
                                                    </div>
                                                    <div className="text-[10px] text-white/20 mt-1 px-1">
                                                        {new Date(msg.created_at).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                                    <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.06] flex gap-3">
                                        <Input
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            placeholder="Type your message..."
                                            className="flex-1"
                                        />
                                        <Button type="submit" loading={sending} disabled={!newMessage.trim()} icon={<Send className="size-4" />} />
                                    </form>
                                )}
                            </Card>
                        ) : (
                            <Card variant="glass" padding="lg" className="h-[600px] flex items-center justify-center">
                                <div className="text-center text-white/30">
                                    <MessageSquare className="size-12 mx-auto mb-3 opacity-30" />
                                    <p>Select a ticket to view messages</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Create Modal */}
                <Modal
                    open={showCreate}
                    onClose={() => setShowCreate(false)}
                    title="Create Support Ticket"
                    description="Describe your issue and we'll help you"
                >
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input
                            label="Title"
                            value={newTicketTitle}
                            onChange={e => setNewTicketTitle(e.target.value)}
                            placeholder="Brief description of your issue"
                            required
                        />
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button type="submit" loading={creating}>Create Ticket</Button>
                        </div>
                    </form>
                </Modal>
            </div>
        </AppShell>
    );
}
