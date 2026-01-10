'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Mic,
    Volume2,
    CheckCircle,
    XCircle,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    Headphones,
    Settings,
} from 'lucide-react';

interface MicTestProps {
    testId: string;
    onComplete: () => void;
}

type TestStatus = 'idle' | 'testing' | 'passed' | 'failed';

export default function MicrophoneTest({ testId, onComplete }: MicTestProps) {
    // Test states
    const [permissionStatus, setPermissionStatus] = useState<TestStatus>('idle');
    const [audioLevelStatus, setAudioLevelStatus] = useState<TestStatus>('idle');
    const [recordingStatus, setRecordingStatus] = useState<TestStatus>('idle');
    const [speechStatus, setSpeechStatus] = useState<TestStatus>('idle');

    // Audio state
    const [audioLevel, setAudioLevel] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speechText, setSpeechText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Refs
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const animationRef = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            cancelAnimationFrame(animationRef.current);
        };
    }, []);

    // Step 1: Request microphone permission
    const testPermission = async () => {
        setPermissionStatus('testing');
        setErrorMessage('');

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone access is not supported in this browser or environment.');
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio analyzer
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            setPermissionStatus('passed');

            // Automatically start audio level test
            setTimeout(() => testAudioLevel(), 500);
        } catch (error: any) {
            console.error('Microphone permission denied:', error);
            setPermissionStatus('failed');
            setErrorMessage(error.message || 'Microphone access denied. Please allow microphone access in your browser settings.');
        }
    };

    // Step 2: Test audio input level
    const testAudioLevel = () => {
        setAudioLevelStatus('testing');

        if (!analyserRef.current) {
            setAudioLevelStatus('failed');
            return;
        }

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        let peakLevel = 0;
        let testDuration = 5000;
        const startTime = Date.now();

        const updateLevel = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const normalizedLevel = Math.min(100, average * 1.5);

            setAudioLevel(normalizedLevel);
            peakLevel = Math.max(peakLevel, normalizedLevel);

            if (Date.now() - startTime < testDuration) {
                animationRef.current = requestAnimationFrame(updateLevel);
            } else {
                if (peakLevel > 20) {
                    setAudioLevelStatus('passed');
                } else {
                    setAudioLevelStatus('failed');
                    setErrorMessage('No audio detected. Please speak into your microphone or check your microphone settings.');
                }
            }
        };

        updateLevel();
    };

    // Step 3: Record and playback test
    const startRecording = () => {
        if (!streamRef.current) return;

        setRecordingStatus('testing');
        setRecordedAudio(null);
        audioChunksRef.current = [];

        mediaRecorderRef.current = new MediaRecorder(streamRef.current);

        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedAudio(url);
            setIsRecording(false);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);

        setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }, 5000);
    };

    const confirmRecording = () => {
        setRecordingStatus('passed');
    };

    // Step 4: Speech recognition test
    const testSpeechRecognition = () => {
        setSpeechStatus('testing');
        setSpeechText('');

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSpeechStatus('failed');
            setErrorMessage('Speech recognition not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setSpeechText(transcript);

            if (event.results[0].isFinal && transcript.length > 5) {
                setSpeechStatus('passed');
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setSpeechStatus('failed');
            setErrorMessage(`Speech recognition error: ${event.error}`);
        };

        recognition.onend = () => {
            if (speechStatus === 'testing' && speechText.length < 5) {
                setSpeechStatus('failed');
                setErrorMessage('Could not recognize speech. Please speak clearly.');
            }
        };

        recognition.start();

        setTimeout(() => {
            if (recognition) {
                try { recognition.stop(); } catch (e) { }
            }
        }, 10000);
    };

    const allTestsPassed =
        permissionStatus === 'passed' &&
        audioLevelStatus === 'passed' &&
        recordingStatus === 'passed' &&
        speechStatus === 'passed';

    const proceedToTest = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        onComplete();
    };

    const resetTests = () => {
        setPermissionStatus('idle');
        setAudioLevelStatus('idle');
        setRecordingStatus('idle');
        setSpeechStatus('idle');
        setAudioLevel(0);
        setRecordedAudio(null);
        setSpeechText('');
        setErrorMessage('');

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };

    const getStatusIcon = (status: TestStatus) => {
        switch (status) {
            case 'passed':
                return <CheckCircle className="w-6 h-6 text-emerald-600" />;
            case 'failed':
                return <XCircle className="w-6 h-6 text-red-500" />;
            case 'testing':
                return <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
            default:
                return <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-slate-300" />;
        }
    };

    const getStepNumber = (index: number, status: TestStatus) => {
        if (status === 'passed') return <CheckCircle className="w-5 h-5 text-white" />;
        return <span className="text-sm font-bold">{index}</span>;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Header Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 mb-6">
                    <div className="text-center">
                        {/* Icon */}
                        <div className="relative inline-block mb-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                <Mic className="w-12 h-12 text-white" />
                            </div>
                            <div className="absolute -right-1 -bottom-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                                <Settings className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Microphone Check</h1>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Let's ensure your microphone is working properly before starting the Speaking Test
                        </p>
                    </div>
                </div>

                {/* Test Steps Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 mb-6">
                    {/* Step 1: Permission */}
                    <div className={`p-5 rounded-2xl mb-4 transition-all ${permissionStatus === 'passed' ? 'bg-emerald-50 border border-emerald-200' :
                        permissionStatus === 'failed' ? 'bg-red-50 border border-red-200' :
                            permissionStatus === 'testing' ? 'bg-blue-50 border border-blue-200' :
                                'bg-slate-50 border border-slate-200'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${permissionStatus === 'passed' ? 'bg-emerald-500' :
                                permissionStatus === 'failed' ? 'bg-red-500' :
                                    permissionStatus === 'testing' ? 'bg-blue-500' :
                                        'bg-slate-300'
                                } text-white`}>
                                {getStepNumber(1, permissionStatus)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">Microphone Access</h3>
                                <p className="text-sm text-slate-500">Allow browser to access your microphone</p>
                            </div>
                            {permissionStatus === 'idle' && (
                                <button
                                    onClick={testPermission}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all font-medium shadow-lg shadow-emerald-200"
                                >
                                    Allow Access
                                </button>
                            )}
                            {permissionStatus === 'passed' && (
                                <span className="text-emerald-600 font-medium text-sm">✓ Granted</span>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Audio Level */}
                    <div className={`p-5 rounded-2xl mb-4 transition-all ${audioLevelStatus === 'passed' ? 'bg-emerald-50 border border-emerald-200' :
                        audioLevelStatus === 'failed' ? 'bg-red-50 border border-red-200' :
                            audioLevelStatus === 'testing' ? 'bg-blue-50 border border-blue-200' :
                                'bg-slate-50 border border-slate-200'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${audioLevelStatus === 'passed' ? 'bg-emerald-500' :
                                audioLevelStatus === 'failed' ? 'bg-red-500' :
                                    audioLevelStatus === 'testing' ? 'bg-blue-500' :
                                        'bg-slate-300'
                                } text-white`}>
                                {getStepNumber(2, audioLevelStatus)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">Audio Level Test</h3>
                                <p className="text-sm text-slate-500">Speak to test your microphone levels</p>
                                {audioLevelStatus === 'testing' && (
                                    <div className="mt-3">
                                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-blue-500 transition-all duration-100 rounded-full"
                                                style={{ width: `${audioLevel}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-blue-600 mt-2 font-medium">🎤 Say: "Hello, I am testing my microphone"</p>
                                    </div>
                                )}
                            </div>
                            {audioLevelStatus === 'passed' && (
                                <span className="text-emerald-600 font-medium text-sm">✓ Good</span>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Recording Test */}
                    <div className={`p-5 rounded-2xl mb-4 transition-all ${recordingStatus === 'passed' ? 'bg-emerald-50 border border-emerald-200' :
                        recordingStatus === 'failed' ? 'bg-red-50 border border-red-200' :
                            recordingStatus === 'testing' ? 'bg-blue-50 border border-blue-200' :
                                'bg-slate-50 border border-slate-200'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${recordingStatus === 'passed' ? 'bg-emerald-500' :
                                recordingStatus === 'failed' ? 'bg-red-500' :
                                    recordingStatus === 'testing' ? 'bg-blue-500' :
                                        'bg-slate-300'
                                } text-white`}>
                                {getStepNumber(3, recordingStatus)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">Recording Test</h3>
                                <p className="text-sm text-slate-500">Record and play back your voice</p>
                                {isRecording && (
                                    <p className="text-xs text-red-500 mt-2 flex items-center gap-2 font-medium">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        Recording... Speak now! (5 seconds)
                                    </p>
                                )}
                                {recordedAudio && !isRecording && recordingStatus === 'testing' && (
                                    <div className="mt-3 flex items-center gap-3">
                                        <audio src={recordedAudio} controls className="h-10 flex-1 rounded-lg" />
                                        <button
                                            onClick={confirmRecording}
                                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-sm font-medium"
                                        >
                                            Sounds Good ✓
                                        </button>
                                    </div>
                                )}
                            </div>
                            {recordingStatus === 'idle' && audioLevelStatus === 'passed' && (
                                <button
                                    onClick={startRecording}
                                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-200"
                                >
                                    Record
                                </button>
                            )}
                            {recordingStatus === 'passed' && (
                                <span className="text-emerald-600 font-medium text-sm">✓ Clear</span>
                            )}
                        </div>
                    </div>

                    {/* Step 4: Speech Recognition */}
                    <div className={`p-5 rounded-2xl transition-all ${speechStatus === 'passed' ? 'bg-emerald-50 border border-emerald-200' :
                        speechStatus === 'failed' ? 'bg-red-50 border border-red-200' :
                            speechStatus === 'testing' ? 'bg-blue-50 border border-blue-200' :
                                'bg-slate-50 border border-slate-200'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${speechStatus === 'passed' ? 'bg-emerald-500' :
                                speechStatus === 'failed' ? 'bg-red-500' :
                                    speechStatus === 'testing' ? 'bg-blue-500' :
                                        'bg-slate-300'
                                } text-white`}>
                                {getStepNumber(4, speechStatus)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">Speech Recognition</h3>
                                <p className="text-sm text-slate-500">Verify your speech can be understood</p>
                                {speechStatus === 'testing' && (
                                    <div className="mt-3">
                                        <p className="text-xs text-blue-600 mb-2 font-medium">🗣️ Say: "The weather is nice today"</p>
                                        {speechText && (
                                            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                                <span className="text-xs text-slate-400">Heard: </span>
                                                <span className="text-emerald-600 font-medium">"{speechText}"</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {speechStatus === 'idle' && recordingStatus === 'passed' && (
                                <button
                                    onClick={testSpeechRecognition}
                                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-200"
                                >
                                    Test Speech
                                </button>
                            )}
                            {speechStatus === 'passed' && (
                                <span className="text-emerald-600 font-medium text-sm">✓ Perfect</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-red-600 text-sm">{errorMessage}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between px-2">
                    <button
                        onClick={resetTests}
                        className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reset Tests
                    </button>

                    {allTestsPassed ? (
                        <button
                            onClick={proceedToTest}
                            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-xl shadow-emerald-200"
                        >
                            Start Speaking Test
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="text-slate-400 text-sm bg-slate-100 px-4 py-2 rounded-xl">
                            Complete all tests to continue
                        </div>
                    )}
                </div>

                {/* Skip link */}
                <div className="text-center mt-6">
                    <button
                        onClick={proceedToTest}
                        className="text-xs text-slate-400 hover:text-slate-500 transition-colors underline"
                    >
                        Skip microphone check (not recommended)
                    </button>
                </div>
            </div>
        </div>
    );
}
