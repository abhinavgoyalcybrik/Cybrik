'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Users,
    BookOpen,
    PenTool,
    Mic,
    Headphones,
    TrendingUp,
    Award,
    Calendar,
    Search,
    ArrowLeft,
} from 'lucide-react';

interface ModuleScore {
    attempts: number;
    average_band: number | null;
    best_band: number | null;
}

interface StudentReport {
    id: number;
    email: string;
    username: string;
    full_name: string;
    date_joined: string;
    total_attempts: number;
    completed_sessions: number;
    overall_average_band: number | null;
    module_scores: {
        reading: ModuleScore;
        writing: ModuleScore;
        speaking: ModuleScore;
        listening: ModuleScore;
    };
}

const API_URL = '/api/ielts';

export default function AdminReportsPage() {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [students, setStudents] = useState<StudentReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchReports();
        }
    }, [isAdmin]);

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/tests/student_reports/`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch reports');
            const data = await res.json();
            setStudents(data.students || []);
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(
        (s) =>
            s.email.toLowerCase().includes(search.toLowerCase()) ||
            s.full_name.toLowerCase().includes(search.toLowerCase())
    );

    const formatBand = (band: number | null) => {
        if (band === null) return '-';
        return band.toFixed(1);
    };

    const getBandColor = (band: number | null) => {
        if (band === null) return 'text-slate-400';
        if (band >= 7) return 'text-green-600';
        if (band >= 5.5) return 'text-amber-600';
        return 'text-red-600';
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Student Reports"
            subtitle={`${students.length} students with performance data`}
            actions={
                <Link
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
            }
        >
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                            <p className="text-xs text-slate-500">Total Students</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">
                                {students.reduce((acc, s) => acc + s.total_attempts, 0)}
                            </p>
                            <p className="text-xs text-slate-500">Total Attempts</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">
                                {students.filter(s => s.overall_average_band && s.overall_average_band >= 6).length}
                            </p>
                            <p className="text-xs text-slate-500">Band 6+ Students</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">
                                {students.filter(s => s.total_attempts > 0).length}
                            </p>
                            <p className="text-xs text-slate-500">Active Students</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search students by name or email..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all shadow-sm"
                />
            </div>

            {loading && (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A] mx-auto"></div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                    <p className="text-red-600 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Students Table */}
            {!loading && filteredStudents.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1">
                                            <Headphones className="w-3.5 h-3.5" />
                                            Listening
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1">
                                            <BookOpen className="w-3.5 h-3.5" />
                                            Reading
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1">
                                            <PenTool className="w-3.5 h-3.5" />
                                            Writing
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1">
                                            <Mic className="w-3.5 h-3.5" />
                                            Speaking
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Overall
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Attempts
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div>
                                                <p className="font-medium text-slate-900">{student.full_name}</p>
                                                <p className="text-xs text-slate-500">{student.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div>
                                                <span className={`font-bold ${getBandColor(student.module_scores.listening.average_band)}`}>
                                                    {formatBand(student.module_scores.listening.average_band)}
                                                </span>
                                                <p className="text-xs text-slate-400">
                                                    {student.module_scores.listening.attempts} test{student.module_scores.listening.attempts !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div>
                                                <span className={`font-bold ${getBandColor(student.module_scores.reading.average_band)}`}>
                                                    {formatBand(student.module_scores.reading.average_band)}
                                                </span>
                                                <p className="text-xs text-slate-400">
                                                    {student.module_scores.reading.attempts} test{student.module_scores.reading.attempts !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div>
                                                <span className={`font-bold ${getBandColor(student.module_scores.writing.average_band)}`}>
                                                    {formatBand(student.module_scores.writing.average_band)}
                                                </span>
                                                <p className="text-xs text-slate-400">
                                                    {student.module_scores.writing.attempts} test{student.module_scores.writing.attempts !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div>
                                                <span className={`font-bold ${getBandColor(student.module_scores.speaking.average_band)}`}>
                                                    {formatBand(student.module_scores.speaking.average_band)}
                                                </span>
                                                <p className="text-xs text-slate-400">
                                                    {student.module_scores.speaking.attempts} test{student.module_scores.speaking.attempts !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`text-lg font-bold ${getBandColor(student.overall_average_band)}`}>
                                                {formatBand(student.overall_average_band)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-sm font-medium">
                                                {student.total_attempts}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredStudents.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="inline-flex p-4 rounded-full bg-slate-50 mb-4">
                        <Users className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Student Reports Yet</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                        {search
                            ? 'No students found matching your search.'
                            : 'Once students complete tests, their performance data will appear here.'}
                    </p>
                </div>
            )}
        </AdminLayout>
    );
}
