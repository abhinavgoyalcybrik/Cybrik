"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import apiFetch from '@/lib/api';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1F3A]"></div>
        </div>
    )
});

interface Task {
    id: number;
    due_at: string;
    channel: string;
    status?: string;
    completed: boolean;
    notes: string;
    assigned_to: number | null;
    application: number | null;
    lead: number | null;
    applicant_name?: string;
    call_record?: any | null;
    call_record_id?: number | null;
}

interface Applicant {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);

    // New Task Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        due_at: '',
        channel: 'ai_call',
        notes: '',
        applicant_id: null as number | null,
    });
    const [processingDue, setProcessingDue] = useState(false);
    const [processResult, setProcessResult] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Edit Task Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editForm, setEditForm] = useState({
        due_at: '',
        channel: '',
        notes: '',
        applicant_id: null as number | null,
        trigger_now: false,
    });
    const [updating, setUpdating] = useState(false);
    const [aiActions, setAiActions] = useState<string[]>([]);
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/api/tasks/');
            setTasks(data.results || data);
        } catch (err: any) {
            setError(err.message || 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const fetchApplicants = async () => {
        if (applicants.length > 0) return;
        try {
            setLoadingApplicants(true);
            const data = await apiFetch('/api/applicants/?limit=100');
            setApplicants(data.results || data);
        } catch (err) {
            console.error('Failed to load applicants', err);
        } finally {
            setLoadingApplicants(false);
        }
    };

    const processDueCalls = async () => {
        try {
            setProcessingDue(true);
            setProcessResult(null);
            const result = await apiFetch('/api/ai-calls/process-due/', {
                method: 'POST',
            });
            setProcessResult(result.message || 'Calls processed');
            fetchTasks();
            setTimeout(() => setProcessResult(null), 5000);
        } catch (err: any) {
            setProcessResult('Error: ' + (err.message || 'Failed to process calls'));
        } finally {
            setProcessingDue(false);
        }
    };

    const toggleComplete = async (task: Task) => {
        try {
            // Optimistic update
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, completed: !t.completed } : t
            );
            setTasks(updatedTasks);

            await apiFetch(`/api/tasks/${task.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ completed: !task.completed })
            });
        } catch (err) {
            console.error("Failed to update task", err);
            fetchTasks(); // Revert on error
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            let response;

            if (newTask.channel === 'ai_call') {
                if (!newTask.applicant_id) {
                    alert('Please select an applicant for AI call scheduling');
                    setCreating(false);
                    return;
                }
                if (!newTask.due_at) {
                    alert('Please select a scheduled time for the AI call');
                    setCreating(false);
                    return;
                }
                response = await apiFetch('/api/ai-calls/schedule/', {
                    method: 'POST',
                    body: JSON.stringify({
                        applicant_id: newTask.applicant_id,
                        scheduled_time: new Date(newTask.due_at).toISOString(),
                        notes: newTask.notes,
                    })
                });
                const newTaskItem: Task = {
                    id: response.task_id,
                    due_at: response.scheduled_time,
                    channel: 'ai_call',
                    status: response.status || 'scheduled',
                    completed: false,
                    notes: newTask.notes,
                    assigned_to: null,
                    application: null,
                    lead: null,
                    applicant_name: response.applicant_name,
                    call_record: response.call_record || null,
                    call_record_id: response.call_record_id || null,
                };
                setTasks([newTaskItem, ...tasks]);
            } else {
                response = await apiFetch('/api/tasks/', {
                    method: 'POST',
                    body: JSON.stringify({
                        notes: newTask.notes,
                        channel: newTask.channel,
                        due_at: newTask.due_at ? new Date(newTask.due_at).toISOString() : null
                    })
                });
                setTasks([response, ...tasks]);
            }

            setIsModalOpen(false);
            setNewTask({ due_at: '', channel: 'email', notes: '', applicant_id: null });
        } catch (err: any) {
            alert(err.message || "Failed to create task");
        } finally {
            setCreating(false);
        }
    };

    const triggerAICallNow = async (taskId: number) => {
        if (!confirm('This will immediately initiate an AI call to the applicant. Continue?')) {
            return;
        }
        try {
            const result = await apiFetch(`/api/tasks/${taskId}/trigger_call/`, {
                method: 'POST'
            });
            if (result.error) {
                alert(result.error);
            } else {
                alert('AI call initiated successfully!');
                fetchTasks();
            }
        } catch (err: any) {
            alert(err.message || 'Failed to trigger AI call');
        }
    };

    const openEditModal = (task: Task) => {
        setEditingTask(task);
        const dueDate = task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '';
        setEditForm({
            due_at: dueDate,
            channel: task.channel,
            notes: task.notes,
            applicant_id: task.lead,
            trigger_now: false,
        });
        setAiActions([]);
        if (task.channel === 'ai_call') {
            fetchApplicants();
        }
        setIsEditModalOpen(true);
    };

    const handleEditTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;

        setUpdating(true);
        setAiActions([]);

        try {
            const response = await apiFetch(`/api/tasks/${editingTask.id}/smart_update/`, {
                method: 'POST',
                body: JSON.stringify({
                    due_at: editForm.due_at ? new Date(editForm.due_at).toISOString() : null,
                    channel: editForm.channel,
                    notes: editForm.notes,
                    applicant_id: editForm.applicant_id,
                    trigger_now: editForm.trigger_now,
                })
            });

            if (response.ok) {
                setAiActions(response.actions_taken || []);

                if (response.updated_task) {
                    setTasks(tasks.map(t =>
                        t.id === editingTask.id
                            ? { ...t, ...response.updated_task }
                            : t
                    ));
                }

                setTimeout(() => {
                    setIsEditModalOpen(false);
                    setEditingTask(null);
                    fetchTasks();
                }, response.actions_taken?.length > 0 ? 2000 : 500);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to update task');
        } finally {
            setUpdating(false);
        }
    };

    const deleteTask = async (taskId: number) => {
        if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            return;
        }
        setDeleting(taskId);
        try {
            await apiFetch(`/api/tasks/${taskId}/`, {
                method: 'DELETE'
            });
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (err: any) {
            alert(err.message || 'Failed to delete task');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Tasks
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Manage your follow-ups and to-dos.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={processDueCalls}
                                disabled={processingDue}
                                className="px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                {processingDue ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        Trigger Due Calls
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
                            >
                                + New Task
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {processResult && (
                    <div className={`p-3 rounded-lg text-sm ${processResult.startsWith('Error')
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-green-50 text-green-600 border border-green-200'
                        }`}>
                        {processResult}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-navy)]"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                        {error}
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-[var(--cy-border)]">
                        <p className="text-[var(--cy-text-muted)]">No tasks found. Create one to get started!</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-[var(--cy-border)] overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-[var(--cy-border)]">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Status</th>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Due Date</th>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Channel</th>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Notes</th>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Related To</th>
                                    <th className="px-6 py-3 font-medium text-[var(--cy-text-secondary)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cy-border)]">
                                {tasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleComplete(task)}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${task.completed
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                    }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${task.completed ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                                {task.completed ? 'Completed' : 'Pending'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--cy-navy)]">
                                            {task.due_at ? new Date(task.due_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`uppercase text-xs font-bold tracking-wider ${task.channel === 'ai_call'
                                                    ? 'text-purple-600'
                                                    : 'text-[var(--cy-text-muted)]'
                                                }`}>
                                                {task.channel === 'ai_call' ? 'AI Call' : task.channel}
                                            </span>
                                            {task.channel === 'ai_call' && task.status && (
                                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${task.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                                        task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                            task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                task.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {task.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-[var(--cy-text-secondary)] max-w-xs truncate">
                                            {task.notes || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {task.application ? (
                                                <Link href={`/applications/${task.application}`} className="text-[var(--cy-lime-hover)] hover:underline">
                                                    Application #{task.application}
                                                </Link>
                                            ) : task.lead ? (
                                                <Link href={`/applicants/${task.lead}`} className="text-[var(--cy-lime-hover)] hover:underline">
                                                    {task.applicant_name || `Applicant #${task.lead}`}
                                                </Link>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(task)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Edit task"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    disabled={deleting === task.id}
                                                    className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    title="Delete task"
                                                >
                                                    {deleting === task.id ? '...' : 'Delete'}
                                                </button>
                                                {task.channel === 'ai_call' && task.status === 'scheduled' && (
                                                    <button
                                                        onClick={() => triggerAICallNow(task.id)}
                                                        className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                                                        title="Trigger AI call now"
                                                    >
                                                        Call Now
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Create Task Modal */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">Create New Task</h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={newTask.due_at}
                                            onChange={e => setNewTask({ ...newTask, due_at: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                                        <select
                                            value={newTask.channel}
                                            onChange={e => {
                                                const channel = e.target.value;
                                                setNewTask({ ...newTask, channel, applicant_id: channel !== 'ai_call' ? null : newTask.applicant_id });
                                                if (channel === 'ai_call') {
                                                    fetchApplicants();
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        >
                                            <option value="email">Email</option>
                                            <option value="phone">Phone</option>
                                            <option value="sms">SMS</option>
                                            <option value="in_app">In App</option>
                                            <option value="ai_call">AI Voice Call</option>
                                        </select>
                                    </div>

                                    {newTask.channel === 'ai_call' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Select Applicant <span className="text-red-500">*</span>
                                            </label>
                                            {loadingApplicants ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--cy-navy)]"></div>
                                                    Loading applicants...
                                                </div>
                                            ) : (
                                                <select
                                                    required
                                                    value={newTask.applicant_id || ''}
                                                    onChange={e => setNewTask({ ...newTask, applicant_id: Number(e.target.value) || null })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                                >
                                                    <option value="">Select an applicant...</option>
                                                    {applicants.filter(a => a.phone).map(applicant => (
                                                        <option key={applicant.id} value={applicant.id}>
                                                            {applicant.first_name} {applicant.last_name} ({applicant.phone})
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                Only applicants with phone numbers are shown
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <textarea
                                            required
                                            value={newTask.notes}
                                            onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none resize-none"
                                            placeholder="What needs to be done?"
                                        />
                                    </div>
                                    <div className="pt-2 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={creating}
                                            className="flex-1 btn btn-primary flex justify-center"
                                        >
                                            {creating ? 'Creating...' : 'Create Task'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Edit Task Modal */}
                <AnimatePresence>
                    {isEditModalOpen && editingTask && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">Edit Task</h3>
                                    <button onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }} className="text-gray-400 hover:text-gray-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <form onSubmit={handleEditTask} className="p-6 space-y-4">
                                    {aiActions.length > 0 && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="text-sm font-medium text-green-800 mb-2">AI Actions Taken:</p>
                                            <ul className="text-sm text-green-700 space-y-1">
                                                {aiActions.map((action, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        {action}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
                                        <input
                                            type="datetime-local"
                                            value={editForm.due_at}
                                            onChange={e => setEditForm({ ...editForm, due_at: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Change the time to reschedule. For AI calls, setting to now or past will trigger immediately.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                                        <select
                                            value={editForm.channel}
                                            onChange={e => {
                                                const channel = e.target.value;
                                                setEditForm({ ...editForm, channel, applicant_id: channel !== 'ai_call' ? null : editForm.applicant_id });
                                                if (channel === 'ai_call') {
                                                    fetchApplicants();
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        >
                                            <option value="email">Email</option>
                                            <option value="phone">Phone</option>
                                            <option value="sms">SMS</option>
                                            <option value="in_app">In App</option>
                                            <option value="ai_call">AI Voice Call</option>
                                        </select>
                                    </div>

                                    {editForm.channel === 'ai_call' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Select Applicant
                                            </label>
                                            {loadingApplicants ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--cy-navy)]"></div>
                                                    Loading applicants...
                                                </div>
                                            ) : (
                                                <select
                                                    value={editForm.applicant_id || ''}
                                                    onChange={e => setEditForm({ ...editForm, applicant_id: Number(e.target.value) || null })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                                >
                                                    <option value="">Select an applicant...</option>
                                                    {applicants.filter(a => a.phone).map(applicant => (
                                                        <option key={applicant.id} value={applicant.id}>
                                                            {applicant.first_name} {applicant.last_name} ({applicant.phone})
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <textarea
                                            value={editForm.notes}
                                            onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none resize-none"
                                            placeholder="Task notes..."
                                        />
                                    </div>

                                    {editForm.channel === 'ai_call' && editingTask.status === 'scheduled' && (
                                        <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                            <input
                                                type="checkbox"
                                                id="trigger_now"
                                                checked={editForm.trigger_now}
                                                onChange={e => setEditForm({ ...editForm, trigger_now: e.target.checked })}
                                                className="w-4 h-4 text-purple-600 rounded"
                                            />
                                            <label htmlFor="trigger_now" className="text-sm text-purple-800">
                                                <span className="font-medium">Trigger AI call immediately</span>
                                                <span className="block text-xs text-purple-600">The system will call the applicant right away</span>
                                            </label>
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updating}
                                            className="flex-1 btn btn-primary flex justify-center"
                                        >
                                            {updating ? 'Updating...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
