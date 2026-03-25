'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { AppShell } from '@/components/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/error-debug-toast';
import {
  MessageSquare, Send, ArrowLeft, Clock, Check,
  AlertCircle, User
} from 'lucide-react';

interface Ticket {
  id: string;
  user_id: string;
  title: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isHelper, isAdmin } = useAuth();
  const addToast = useToast(s => s.addToast);

  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticketId) loadTicket();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
        setMessages(data.messages || []);
      } else if (res.status === 404) {
        addToast({ type: 'error', title: 'Not Found', message: 'Ticket not found' });
        router.push('/tickets');
      } else if (res.status === 403) {
        addToast({ type: 'error', title: 'Forbidden', message: 'You do not have access to this ticket' });
        router.push('/tickets');
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load ticket' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      setNewMessage('');
      loadTicket();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (status: string) => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      addToast({ type: 'success', title: 'Updated', message: `Ticket ${status}.` });
      loadTicket();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    open: 'success',
    'in-progress': 'warning',
    resolved: 'default',
    closed: 'default',
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell>
        <div className="text-center text-white/30 py-12">
          Ticket not found
        </div>
      </AppShell>
    );
  }

  const isStaff = isHelper || isAdmin;

  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/tickets')}
              icon={<ArrowLeft className="size-4" />}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <MessageSquare className="size-7 text-emerald-400" />
                {ticket.title}
              </h1>
              <p className="text-white/40 mt-1">
                #{ticket.id?.slice(0, 8)} • Created {new Date(ticket.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColors[ticket.status]}>{ticket.status}</Badge>
            {isStaff && ticket.status === 'open' && (
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoading}
                onClick={() => updateTicketStatus('in-progress')}
              >
                Assign
              </Button>
            )}
            {isStaff && ticket.status === 'in-progress' && (
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoading}
                onClick={() => updateTicketStatus('resolved')}
              >
                Resolve
              </Button>
            )}
          </div>
        </motion.div>

        <Card variant="glass" padding="none" className="h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-white/30 py-12">
                <MessageSquare className="size-12 mx-auto mb-3 opacity-30" />
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map((msg, i) => {
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.06] flex gap-3">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button
                type="submit"
                loading={sending}
                disabled={!newMessage.trim()}
                icon={<Send className="size-4" />}
              />
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
