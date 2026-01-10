'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, AlertTriangle, ImageIcon } from 'lucide-react';

interface HandwritingUploadProps {
    onTextExtracted: (text: string) => void;
    currentTask: 1 | 2;
}

interface AnalysisResult {
    success: boolean;
    is_clear: boolean;
    clarity_score: number;
    extracted_text: string;
    word_count: number;
    feedback: string;
    error?: string;
}

export default function HandwritingUpload({ onTextExtracted, currentTask }: HandwritingUploadProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file: File) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
            setResult(null);
        };
        reader.readAsDataURL(file);
    };

    const analyzeImage = async () => {
        if (!imagePreview) return;

        setIsAnalyzing(true);
        setResult(null);

        try {
            // Convert base64 to blob
            const response = await fetch(imagePreview);
            const blob = await response.blob();

            // Create form data
            const formData = new FormData();
            formData.append('image', blob, 'handwriting.jpg');

            // Call API
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const apiResponse = await fetch(`${API_BASE}/api/ielts/analyze-handwriting/`, {
                method: 'POST',
                body: formData,
            });

            const data: AnalysisResult = await apiResponse.json();
            setResult(data);

        } catch (error) {
            console.error('Error analyzing image:', error);
            setResult({
                success: false,
                is_clear: false,
                clarity_score: 0,
                extracted_text: '',
                word_count: 0,
                feedback: '',
                error: 'Failed to connect to server. Please try again.',
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const useExtractedText = () => {
        if (result?.extracted_text) {
            onTextExtracted(result.extracted_text);
            setIsOpen(false);
            resetState();
        }
    };

    const resetState = () => {
        setImagePreview(null);
        setResult(null);
        setIsAnalyzing(false);
    };

    const closeModal = () => {
        setIsOpen(false);
        resetState();
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
                <Camera className="w-4 h-4" />
                Upload Handwritten
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                            <div>
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                                    Submit Handwritten Response
                                </h2>
                                <p className="text-sm text-zinc-500 mt-1">
                                    Take a photo or upload an image of your Task {currentTask} response
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5 text-zinc-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Upload Options */}
                            {!imagePreview && (
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <Camera className="w-7 h-7 text-blue-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium text-zinc-900 dark:text-white">Take Photo</p>
                                            <p className="text-xs text-zinc-500 mt-1">Use your camera</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                            <Upload className="w-7 h-7 text-indigo-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium text-zinc-900 dark:text-white">Upload Image</p>
                                            <p className="text-xs text-zinc-500 mt-1">From your gallery</p>
                                        </div>
                                    </button>

                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Image Preview */}
                            {imagePreview && (
                                <div className="space-y-4">
                                    <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        <img
                                            src={imagePreview}
                                            alt="Handwriting preview"
                                            className="w-full max-h-80 object-contain"
                                        />
                                        <button
                                            onClick={resetState}
                                            className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Analyze Button */}
                                    {!result && (
                                        <button
                                            onClick={analyzeImage}
                                            disabled={isAnalyzing}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Analyzing with AI...
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="w-5 h-5" />
                                                    Analyze Handwriting
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Analysis Result */}
                            {result && (
                                <div className="space-y-4">
                                    {/* Status */}
                                    {result.success ? (
                                        <div className={`flex items-center gap-3 p-4 rounded-xl ${result.is_clear
                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                            }`}>
                                            {result.is_clear ? (
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                                            )}
                                            <div>
                                                <p className={`font-medium ${result.is_clear ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
                                                    {result.is_clear ? 'Image is clear!' : 'Image could be clearer'}
                                                </p>
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    Clarity score: {Math.round(result.clarity_score * 100)}%
                                                </p>
                                                {result.feedback && (
                                                    <p className="text-sm text-zinc-500 mt-1">{result.feedback}</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                            <AlertTriangle className="w-6 h-6 text-red-600" />
                                            <div>
                                                <p className="font-medium text-red-800 dark:text-red-200">Analysis Failed</p>
                                                <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Extracted Text */}
                                    {result.success && result.extracted_text && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-medium text-zinc-900 dark:text-white">Extracted Text</h4>
                                                <span className="text-sm text-zinc-500">{result.word_count} words</span>
                                            </div>
                                            <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl max-h-48 overflow-y-auto">
                                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                                    {result.extracted_text}
                                                </p>
                                            </div>
                                            <button
                                                onClick={useExtractedText}
                                                className="w-full py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                Use This Text
                                            </button>
                                        </div>
                                    )}

                                    {/* Retry */}
                                    <button
                                        onClick={resetState}
                                        className="w-full py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                    >
                                        Try Another Photo
                                    </button>
                                </div>
                            )}

                            {/* Tips */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📷 Tips for best results:</h4>
                                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                    <li>• Use good lighting (avoid shadows)</li>
                                    <li>• Hold camera steady and parallel to paper</li>
                                    <li>• Ensure all text is visible in frame</li>
                                    <li>• Use dark pen on white/light paper</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
