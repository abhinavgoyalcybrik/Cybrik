"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.cybriksolutions.com";

type Step = "loading" | "request-otp" | "verify-otp" | "upload" | "success" | "error";

export default function DocumentUploadPage() {
    const params = useParams();
    const token = params.token as string;

    const [step, setStep] = useState<Step>("loading");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [phoneMasked, setPhoneMasked] = useState("");
    const [otp, setOtp] = useState("");
    const [info, setInfo] = useState<{ name?: string; type?: string }>({});
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState("other");
    const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

    // Check token validity on load
    useEffect(() => {
        checkToken();
    }, [token]);

    const checkToken = async () => {
        try {
            const res = await fetch(`${API_URL}/api/upload-portal/${token}/info/`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Invalid or expired link");
                setStep("error");
                return;
            }

            setPhoneMasked(data.phone_masked);

            if (data.is_verified) {
                setStep("upload");
            } else {
                setStep("request-otp");
            }
        } catch (e) {
            setError("Failed to load. Please check your connection.");
            setStep("error");
        }
    };

    const requestOTP = async () => {
        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${API_URL}/api/upload-portal/${token}/request-otp/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();

            if (res.ok) {
                setPhoneMasked(data.phone_masked);
                setStep("verify-otp");
            } else {
                setError(data.error || "Failed to send OTP");
            }
        } catch (e) {
            setError("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const verifyOTP = async () => {
        if (otp.length !== 6) {
            setError("Please enter 6-digit OTP");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${API_URL}/api/upload-portal/${token}/verify-otp/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ otp })
            });
            const data = await res.json();

            if (res.ok && data.verified) {
                setInfo(data.info || {});
                setStep("upload");
            } else {
                setError(data.error || "Invalid OTP");
            }
        } catch (e) {
            setError("Verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const uploadDocument = async () => {
        if (!selectedFile) {
            setError("Please select a file");
            return;
        }

        setLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("document_type", documentType);

        try {
            const res = await fetch(`${API_URL}/api/upload-portal/${token}/upload/`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setUploadedDocs([...uploadedDocs, data.document_type]);
                setSelectedFile(null);
                setDocumentType("other");
                // Stay on upload page to allow more uploads
            } else {
                setError(data.error || "Upload failed");
            }
        } catch (e) {
            setError("Upload failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const documentTypes = [
        { value: "10th_marksheet", label: "10th Marksheet" },
        { value: "12th_marksheet", label: "12th Marksheet" },
        { value: "degree_certificate", label: "Degree Certificate" },
        { value: "passport", label: "Passport" },
        { value: "english_test", label: "English Test (IELTS/PTE/TOEFL)" },
        { value: "other", label: "Other" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 mb-4 shadow-lg shadow-purple-500/30">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Document Upload</h1>
                    <p className="text-slate-400">Secure document submission portal</p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 shadow-xl">

                    {/* Loading State */}
                    {step === "loading" && (
                        <div className="text-center py-8">
                            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-slate-400">Loading...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {step === "error" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 mx-auto mb-4 flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-red-400 font-medium">{error}</p>
                            <p className="text-slate-500 text-sm mt-2">Please contact support for assistance.</p>
                        </div>
                    )}

                    {/* Request OTP Step */}
                    {step === "request-otp" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-slate-300 mb-1">Verify your phone number</p>
                                <p className="text-slate-500 text-sm">We'll send an OTP to {phoneMasked}</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={requestOTP}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {loading ? "Sending..." : "Send OTP"}
                            </button>
                        </div>
                    )}

                    {/* Verify OTP Step */}
                    {step === "verify-otp" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-slate-300 mb-1">Enter verification code</p>
                                <p className="text-slate-500 text-sm">Sent to {phoneMasked}</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit OTP"
                                className="w-full py-3 px-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-purple-500 transition-colors"
                                maxLength={6}
                            />

                            <button
                                onClick={verifyOTP}
                                disabled={loading || otp.length !== 6}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {loading ? "Verifying..." : "Verify"}
                            </button>

                            <button
                                onClick={requestOTP}
                                disabled={loading}
                                className="w-full py-2 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Resend OTP
                            </button>
                        </div>
                    )}

                    {/* Upload Step */}
                    {step === "upload" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 mx-auto mb-3 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-green-400 font-medium">Phone verified!</p>
                                {info.name && <p className="text-slate-400 text-sm mt-1">Welcome, {info.name}</p>}
                            </div>

                            {uploadedDocs.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                    <p className="text-green-400 text-sm font-medium mb-1">Uploaded Documents:</p>
                                    <ul className="text-green-300 text-sm space-y-1">
                                        {uploadedDocs.map((doc, i) => (
                                            <li key={i}>✓ {doc}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Document Type</label>
                                <select
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    className="w-full py-3 px-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                                >
                                    {documentTypes.map(dt => (
                                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-2">Select File</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="file-input"
                                        accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,image/*"
                                    />
                                    <label
                                        htmlFor="file-input"
                                        className="block w-full py-8 px-4 bg-slate-900/50 border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl text-center cursor-pointer transition-colors"
                                    >
                                        {selectedFile ? (
                                            <div className="text-purple-400">
                                                <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {selectedFile.name}
                                            </div>
                                        ) : (
                                            <div className="text-slate-500">
                                                <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Click to select file
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={uploadDocument}
                                disabled={loading || !selectedFile}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {loading ? "Uploading..." : "Upload Document"}
                            </button>

                            {uploadedDocs.length > 0 && (
                                <button
                                    onClick={() => setStep("success")}
                                    className="w-full py-2 text-purple-400 hover:text-purple-300 text-sm transition-colors"
                                >
                                    Done uploading
                                </button>
                            )}
                        </div>
                    )}

                    {/* Success State */}
                    {step === "success" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto mb-4 flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-green-400 font-medium text-lg mb-2">All done!</p>
                            <p className="text-slate-400">Your documents have been uploaded successfully.</p>
                            <p className="text-slate-500 text-sm mt-4">You can close this page now.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-sm mt-6">
                    Secured by CybricHQ
                </p>
            </div>
        </div>
    );
}
