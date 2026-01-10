'use client';

import { useEffect, useState } from 'react';
import { telephonyApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Need to create Tabs or just use state
import { Plus, Bot, Phone } from 'lucide-react';

// Simple Tabs implementation since I didn't create the component file
function SimpleTabs({ tabs }: { tabs: { label: string; value: string; content: React.ReactNode }[] }) {
    const [active, setActive] = useState(tabs[0].value);
    return (
        <div className="space-y-4">
            <div className="flex border-b border-gray-200">
                {tabs.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setActive(tab.value)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active === tab.value
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {tabs.find(t => t.value === active)?.content}
        </div>
    );
}

export default function TelephonyPage() {
    const [agents, setAgents] = useState<any[]>([]);
    const [numbers, setNumbers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            telephonyApi.getVoiceAgents(),
            telephonyApi.getPhoneNumbers()
        ]).then(([aData, nData]) => {
            setAgents(Array.isArray(aData) ? aData : []);
            setNumbers(Array.isArray(nData) ? nData : []);
        }).finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Telephony</h1>
                <p className="text-gray-500">Manage Voice Agents and Phone Numbers.</p>
            </div>

            <SimpleTabs tabs={[
                {
                    label: 'Voice Agents',
                    value: 'agents',
                    content: (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Agent</Button>
                            </div>
                            <div className="grid gap-4">
                                {agents.map(agent => (
                                    <div key={agent.id} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 rounded-full"><Bot className="w-5 h-5 text-purple-600" /></div>
                                            <div>
                                                <h3 className="font-medium">{agent.name}</h3>
                                                <p className="text-sm text-gray-500">{agent.type} • {agent.provider}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500 font-mono">{agent.provider_agent_id}</div>
                                    </div>
                                ))}
                                {agents.length === 0 && <p className="text-center text-gray-500 py-8">No voice agents found.</p>}
                            </div>
                        </div>
                    )
                },
                {
                    label: 'Phone Numbers',
                    value: 'numbers',
                    content: (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Number</Button>
                            </div>
                            <div className="grid gap-4">
                                {numbers.map(num => (
                                    <div key={num.id} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-100 rounded-full"><Phone className="w-5 h-5 text-green-600" /></div>
                                            <div>
                                                <h3 className="font-medium">{num.number}</h3>
                                                <p className="text-sm text-gray-500">{num.provider}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm">
                                            {num.inbound_agent ? (
                                                <span className="text-blue-600">Routed to: {num.inbound_agent.name}</span>
                                            ) : (
                                                <span className="text-gray-400">Unassigned</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {numbers.length === 0 && <p className="text-center text-gray-500 py-8">No phone numbers found.</p>}
                            </div>
                        </div>
                    )
                }
            ]} />
        </div>
    );
}
