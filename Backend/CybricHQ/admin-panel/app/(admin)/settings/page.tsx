'use client';

import { useEffect, useState } from 'react';
import { telephonyApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Settings as SettingsIcon,
    Key,
    Shield,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    Loader2,
    Save,
    Bot,
    Phone as PhoneIcon,
    Cpu
} from 'lucide-react';

interface ProviderConfig {
    id?: string;
    provider: string;
    api_key: string;
    api_secret?: string;
    is_active: boolean;
    last_tested?: string;
}

const providers = [
    {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        description: 'AI Voice Synthesis & Conversational AI',
        icon: Bot,
        color: 'purple',
        fields: [
            { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk_...' },
            { name: 'agent_id_outbound', label: 'Outbound Agent ID', type: 'text', placeholder: 'agent_xxxx' },
            { name: 'agent_id_inbound', label: 'Inbound Agent ID', type: 'text', placeholder: 'agent_xxxx' },
        ]
    },
    {
        id: 'smartflo',
        name: 'Smartflo (Tata)',
        description: 'Cloud Telephony & Call Management',
        icon: PhoneIcon,
        color: 'blue',
        fields: [
            { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Smartflo API Key' },
            { name: 'caller_id', label: 'Caller ID (DID)', type: 'text', placeholder: '+91xxxxxxxxxx' },
            { name: 'voicebot_api_key', label: 'Voicebot API Key', type: 'password', placeholder: 'Voicebot Key' },
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT Models for AI Assistance',
        icon: Cpu,
        color: 'green',
        fields: [
            { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
            { name: 'model', label: 'Default Model', type: 'text', placeholder: 'gpt-4o-mini' },
        ]
    }
];

export default function SettingsPage() {
    const [configs, setConfigs] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const data = await telephonyApi.getConfigs();
            // Transform array to object by provider
            const configMap: Record<string, any> = {};
            if (Array.isArray(data)) {
                data.forEach((cfg: any) => {
                    configMap[cfg.provider] = cfg;
                });
            }
            setConfigs(configMap);
        } catch (err) {
            console.error('Failed to load configs', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (provider: string, field: string, value: string) => {
        setConfigs(prev => ({
            ...prev,
            [provider]: {
                ...(prev[provider] || {}),
                provider,
                [field]: value
            }
        }));
    };

    const handleSave = async (providerId: string) => {
        setSaving(providerId);
        try {
            const config = configs[providerId];
            if (config?.id) {
                await telephonyApi.updateConfig(config.id, config);
            } else {
                await telephonyApi.createConfig({ ...config, provider: providerId, is_active: true });
            }
            setTestResults(prev => ({ ...prev, [providerId]: 'success' }));
            fetchConfigs(); // Refresh
        } catch (err) {
            console.error('Save failed', err);
            setTestResults(prev => ({ ...prev, [providerId]: 'error' }));
        } finally {
            setSaving(null);
        }
    };

    const toggleShowSecret = (field: string) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
                    <p className="text-slate-500">Manage API keys and provider configurations</p>
                </div>
            </div>

            {/* Security Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="font-medium text-amber-900">Secure Storage</h4>
                    <p className="text-sm text-amber-700 mt-1">
                        All API keys are encrypted at rest using AES-256 encryption. Keys are only decrypted when needed for API calls.
                    </p>
                </div>
            </div>

            {/* Provider Cards */}
            <div className="grid gap-6">
                {providers.map(provider => {
                    const Icon = provider.icon;
                    const config = configs[provider.id] || {};
                    const isSaving = saving === provider.id;
                    const testResult = testResults[provider.id];

                    return (
                        <Card key={provider.id} className="border-slate-200 overflow-hidden">
                            <CardHeader className={`bg-${provider.color}-50 border-b border-slate-100`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 bg-${provider.color}-100 rounded-lg`}>
                                            <Icon className={`h-5 w-5 text-${provider.color}-600`} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{provider.name}</CardTitle>
                                            <p className="text-sm text-slate-500">{provider.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {testResult === 'success' && (
                                            <span className="flex items-center text-sm text-green-600">
                                                <CheckCircle className="h-4 w-4 mr-1" /> Saved
                                            </span>
                                        )}
                                        {testResult === 'error' && (
                                            <span className="flex items-center text-sm text-red-600">
                                                <AlertCircle className="h-4 w-4 mr-1" /> Error
                                            </span>
                                        )}
                                        {config.is_active && (
                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid gap-4">
                                    {provider.fields.map(field => (
                                        <div key={field.name} className="grid gap-2">
                                            <Label htmlFor={`${provider.id}-${field.name}`} className="text-sm font-medium text-slate-700">
                                                {field.label}
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id={`${provider.id}-${field.name}`}
                                                    type={field.type === 'password' && !showSecrets[`${provider.id}-${field.name}`] ? 'password' : 'text'}
                                                    placeholder={field.placeholder}
                                                    value={config[field.name] || ''}
                                                    onChange={(e) => handleFieldChange(provider.id, field.name, e.target.value)}
                                                    className="pr-10"
                                                />
                                                {field.type === 'password' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleShowSecret(`${provider.id}-${field.name}`)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                    >
                                                        {showSecrets[`${provider.id}-${field.name}`] ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
                                    <Button
                                        onClick={() => handleSave(provider.id)}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-2" />
                                        )}
                                        Save Configuration
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
