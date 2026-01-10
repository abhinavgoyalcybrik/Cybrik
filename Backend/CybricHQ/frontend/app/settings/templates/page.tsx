"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import apiFetch from "@/lib/api";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/ui/Loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FileText,
    Plus,
    Edit2,
    Trash2,
    Eye,
    Send,
    Check,
    X,
    MessageSquare,
    Phone,
    File,
    Clock,
} from "lucide-react";

interface Template {
    id: number;
    name: string;
    trigger: string;
    trigger_display: string;
    channel: string;
    channel_display: string;
    content: string;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

interface Variable {
    key: string;
    description: string;
}

const TRIGGER_ICONS: Record<string, any> = {
    post_call: Phone,
    document_reminder: File,
    welcome: MessageSquare,
    follow_up: Clock,
    custom: FileText,
};

export default function MessageTemplatesPage() {
    const { user } = useUser();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [variables, setVariables] = useState<Variable[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [previewContent, setPreviewContent] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        trigger: "post_call",
        channel: "whatsapp",
        content: "",
        is_active: true,
        is_default: false,
    });

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/templates/");
            setTemplates(res.templates || []);
            setVariables(res.available_variables || []);
        } catch (e) {
            console.error("Failed to load templates", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setFormData({
            name: "",
            trigger: "post_call",
            channel: "whatsapp",
            content: "",
            is_active: true,
            is_default: false,
        });
        setIsCreating(true);
        setEditingTemplate(null);
    };

    const handleEdit = (template: Template) => {
        setFormData({
            name: template.name,
            trigger: template.trigger,
            channel: template.channel,
            content: template.content,
            is_active: template.is_active,
            is_default: template.is_default,
        });
        setEditingTemplate(template);
        setIsCreating(false);
    };

    const handleSave = async () => {
        try {
            if (editingTemplate) {
                await apiFetch(`/api/templates/${editingTemplate.id}/`, {
                    method: "PUT",
                    body: JSON.stringify(formData),
                });
            } else {
                await apiFetch("/api/templates/", {
                    method: "POST",
                    body: JSON.stringify(formData),
                });
            }
            setEditingTemplate(null);
            setIsCreating(false);
            loadTemplates();
        } catch (e) {
            console.error("Failed to save template", e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            await apiFetch(`/api/templates/${id}/`, { method: "DELETE" });
            loadTemplates();
        } catch (e) {
            console.error("Failed to delete template", e);
        }
    };

    const handlePreview = async () => {
        try {
            const res = await apiFetch("/api/templates/preview/", {
                method: "POST",
                body: JSON.stringify({ content: formData.content }),
            });
            setPreviewContent(res.rendered);
            setShowPreview(true);
        } catch (e) {
            console.error("Preview failed", e);
        }
    };

    const insertVariable = (key: string) => {
        const placeholder = `{${key}}`;
        setFormData({ ...formData, content: formData.content + placeholder });
    };

    const getTriggerIcon = (trigger: string) => {
        const Icon = TRIGGER_ICONS[trigger] || FileText;
        return <Icon className="w-5 h-5" />;
    };

    const isEditing = editingTemplate || isCreating;

    return (
        <DashboardLayout user={user}>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <FileText className="w-10 h-10 text-[var(--cy-lime)]" />
                                Message Templates
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Create and manage templates for post-call messages, reminders, and more.
                            </p>
                        </div>
                        <Button
                            onClick={handleCreate}
                            className="bg-[var(--cy-lime)] text-[var(--cy-navy)] hover:bg-[var(--cy-lime)]/90"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Template
                        </Button>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Template List */}
                    <div className="lg:col-span-2">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-semibold text-slate-800">
                                    Your Templates
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="flex justify-center py-16">
                                        <Loader />
                                    </div>
                                ) : templates.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                            <FileText className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-700 mb-1">No templates yet</h3>
                                        <p className="text-slate-500 text-sm mb-4">
                                            Create your first message template to get started.
                                        </p>
                                        <Button onClick={handleCreate}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Create Template
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {templates.map((template) => (
                                            <div
                                                key={template.id}
                                                className={`p-5 hover:bg-slate-50 transition-colors cursor-pointer ${editingTemplate?.id === template.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                                                    }`}
                                                onClick={() => handleEdit(template)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                                                            {getTriggerIcon(template.trigger)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                                                {template.name}
                                                                {template.is_default && (
                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                                        Default
                                                                    </span>
                                                                )}
                                                                {!template.is_active && (
                                                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                            </h4>
                                                            <p className="text-sm text-slate-500 mt-1">
                                                                {template.trigger_display} • {template.channel_display}
                                                            </p>
                                                            <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                                                {template.content}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(template)}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDelete(template.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Editor Panel */}
                    <div className="lg:col-span-1">
                        <Card className="border-slate-200 shadow-sm sticky top-6">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-semibold text-slate-800">
                                    {isCreating ? "New Template" : editingTemplate ? "Edit Template" : "Template Editor"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                {isEditing ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Post-Call Thank You"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger</label>
                                                <select
                                                    value={formData.trigger}
                                                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="post_call">After Call Ends</option>
                                                    <option value="document_reminder">Document Reminder</option>
                                                    <option value="welcome">Welcome Message</option>
                                                    <option value="follow_up">Follow-up</option>
                                                    <option value="custom">Custom</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
                                                <select
                                                    value={formData.channel}
                                                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="whatsapp">WhatsApp</option>
                                                    <option value="sms">SMS</option>
                                                    <option value="both">Both</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Message Content</label>
                                            <textarea
                                                value={formData.content}
                                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                rows={6}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                placeholder="Hi {name}! Thank you for speaking with us..."
                                            />
                                        </div>

                                        {/* Variables */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Insert Variable</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {variables.map((v) => (
                                                    <button
                                                        key={v.key}
                                                        onClick={() => insertVariable(v.key)}
                                                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full transition-colors"
                                                        title={v.description}
                                                    >
                                                        {`{${v.key}}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_active}
                                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                    className="rounded"
                                                />
                                                Active
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_default}
                                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                                    className="rounded"
                                                />
                                                Default
                                            </label>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handlePreview} variant="outline" className="flex-1">
                                                <Eye className="w-4 h-4 mr-2" />
                                                Preview
                                            </Button>
                                            <Button onClick={handleSave} className="flex-1 bg-[var(--cy-navy)] hover:bg-[var(--cy-navy)]/90">
                                                <Check className="w-4 h-4 mr-2" />
                                                Save
                                            </Button>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            className="w-full text-slate-500"
                                            onClick={() => {
                                                setEditingTemplate(null);
                                                setIsCreating(false);
                                            }}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                                            <Edit2 className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <p className="text-slate-500 text-sm">
                                            Select a template to edit or create a new one.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Preview Modal */}
                {showPreview && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-800">Message Preview</h3>
                                <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 mb-4">
                                <div className="bg-white rounded-lg p-3 shadow-sm">
                                    <p className="text-slate-800 text-sm whitespace-pre-wrap">{previewContent}</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 text-center">
                                This is how your message will appear with sample data.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
