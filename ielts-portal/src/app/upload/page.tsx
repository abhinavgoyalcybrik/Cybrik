'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle, Shield, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Step = 'identify' | 'verify' | 'upload' | 'success';

export default function DocumentUploadPage() {
    const [step, setStep] = useState<Step>('identify');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State data
    const [applicantId, setApplicantId] = useState('');
    const [tokenId, setTokenId] = useState('');
    const [emailMasked, setEmailMasked] = useState('');
    const [otp, setOtp] = useState('');
    const [applicantName, setApplicantName] = useState('');

    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [docType, setDocType] = useState('other');
    const [uploadNotes, setUploadNotes] = useState('');

    const handleIdentify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/api/upload-portal/initiate/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicant_id: applicantId })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to find applicant');

            setTokenId(data.token_id);
            setEmailMasked(data.email_masked);

            // Auto-request OTP
            await requestOtp(data.token_id);
            setStep('verify');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const requestOtp = async (token: string) => {
        const res = await fetch(`${API_BASE}/api/upload-portal/${token}/request-otp/`, {
            method: 'POST'
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to send OTP');
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/api/upload-portal/${tokenId}/verify-otp/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Invalid OTP');

            if (data.info && data.info.name) {
                setApplicantName(data.info.name);
            }
            setStep('upload');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select a file');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('document_type', docType);
        formData.append('notes', uploadNotes);

        try {
            const res = await fetch(`${API_BASE}/api/upload-portal/${tokenId}/upload/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Upload failed');

            setStep('success');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStep('upload');
        setSelectedFile(null);
        setUploadNotes('');
        setDocType('other');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 p-6 text-white text-center">
                    <div className="mx-auto bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                        <Upload size={24} />
                    </div>
                    <h1 className="text-xl font-bold">Document Portal</h1>
                    <p className="text-blue-100 text-sm mt-1">Secure Applicant Upload</p>
                </div>

                {/* Progress Bar */}
                {step !== 'success' && (
                    <div className="flex border-b">
                        <div className={`flex-1 h-1 ${step === 'identify' ? 'bg-blue-600' : 'bg-blue-200'}`} />
                        <div className={`flex-1 h-1 ${step === 'verify' ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        <div className={`flex-1 h-1 ${step === 'upload' ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    </div>
                )}

                <div className="p-8">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-start">
                            <span className="mr-2">⚠️</span> {error}
                        </div>
                    )}

                    {/* Step 1: Identify */}
                    {step === 'identify' && (
                        <form onSubmit={handleIdentify} className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-lg font-semibold text-gray-800">Identify Yourself</h2>
                                <p className="text-gray-500 text-sm">Enter your Applicant ID to begin</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Applicant ID</label>
                                <input
                                    type="text"
                                    required
                                    value={applicantId}
                                    onChange={e => setApplicantId(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="e.g. 1045"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <>Next <ArrowRight size={16} className="ml-2" /></>}
                            </button>
                        </form>
                    )}

                    {/* Step 2: Verify OTP */}
                    {step === 'verify' && (
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div className="text-center mb-6">
                                <h2 className="text-lg font-semibold text-gray-800">Security Verification</h2>
                                <p className="text-gray-500 text-sm">Use the code sent to {emailMasked}</p>
                            </div>

                            <div className="flex justify-center">
                                <Shield className="text-blue-500 w-12 h-12 mb-4 opacity-20" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="000000"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
                            </button>

                            <div className="text-center">
                                <button type="button" onClick={() => setStep('identify')} className="text-sm text-gray-400 hover:text-gray-600">
                                    Change Applicant ID
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: Upload */}
                    {step === 'upload' && (
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="text-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">Upload Documents</h2>
                                <p className="text-gray-500 text-sm">Welcome back, {applicantName || 'Applicant'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                                <select
                                    value={docType}
                                    onChange={e => setDocType(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                                    style={{ color: '#000' }} // Explicit black color for safety
                                >
                                    <option value="10th_marksheet" className="text-black">10th Marksheet</option>
                                    <option value="12th_marksheet" className="text-black">12th Marksheet</option>
                                    <option value="degree_certificate" className="text-black">Degree Certificate</option>
                                    <option value="passport" className="text-black">Passport</option>
                                    <option value="english_test" className="text-black">English Test Score</option>
                                    <option value="other" className="text-black">Other Document</option>
                                </select>
                            </div>

                            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer">
                                <input
                                    type="file"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {selectedFile ? (
                                    <div className="flex flex-col items-center text-blue-600">
                                        <FileText size={32} className="mb-2" />
                                        <span className="font-medium text-sm truncate max-w-full px-4">{selectedFile.name}</span>
                                        <span className="text-xs text-gray-400 mt-1">Click to change</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400">
                                        <Upload size={32} className="mb-2" />
                                        <span className="font-medium text-sm">Click to Select File</span>
                                        <span className="text-xs mt-1">PDF, JPG, PNG (Max 5MB)</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                                <textarea
                                    value={uploadNotes}
                                    onChange={e => setUploadNotes(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Any details about this document..."
                                    rows={2}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Upload Document'}
                            </button>
                        </form>
                    )}

                    {/* Step 4: Success */}
                    {step === 'success' && (
                        <div className="text-center py-8">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Successful!</h2>
                            <p className="text-gray-500 mb-8">Your document has been securely submitted to your file.</p>

                            <button
                                onClick={handleReset}
                                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                            >
                                <RefreshCw size={16} className="mr-2" />
                                Upload Another Document
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t p-4 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} CybricHQ Secure Portal
                </div>
            </div>
        </div>
    );
}

