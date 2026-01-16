"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function UploadContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [file, setFile] = useState<File | null>(null);
    const [leadName, setLeadName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError("Missing upload token. Please use the valid link provided.");
            setLoading(false);
            return;
        }

        // Verify token and get lead name
        fetch(`/api/public/upload/?token=${token}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Invalid or expired link");
                const data = await res.json();
                setLeadName(data.lead_name);
            })
            .catch((err) => {
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [token]);

    const handleUpload = async () => {
        if (!file || !token) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('token', token);
        formData.append('document_type', 'other'); // Could add a selector for this

        try {
            const res = await fetch('/api/public/upload/', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Upload failed");
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error && !leadName) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full shadow-lg border-red-200">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <AlertCircle className="h-6 w-6" />
                            <CardTitle>Link Expired or Invalid</CardTitle>
                        </div>
                        <CardDescription>
                            This upload link is no longer valid. Please request a new one.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full shadow-lg border-green-200 text-center py-8">
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Upload Successful!</h2>
                        <p className="text-gray-500">
                            Your document has been securely uploaded and is being verified by our AI system.
                        </p>
                        <p className="text-sm text-gray-400 mt-4">You can close this window now.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <UploadCloud className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Secure Document Upload</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Uploading for <span className="font-semibold text-indigo-700">{leadName}</span>
                    </p>
                </div>

                <Card className="shadow-lg border-gray-100">
                    <CardContent className="pt-6 space-y-6">

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="document">Select Document</Label>
                                <Input
                                    id="document"
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    disabled={uploading}
                                    className="cursor-pointer"
                                />
                            </div>

                            {file && (
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-100 flex items-center gap-3">
                                    <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-blue-700">{file.name.split('.').pop()?.toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                            size="lg"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                "Upload Securely"
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-gray-400">
                    Protected by specific SSL encryption. Your documents are private.
                </p>
            </div>
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <UploadContent />
        </Suspense>
    );
}
