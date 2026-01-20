'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Phone,
    PhoneOff,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Download,
    Play,
    Circle,
    Target, // Added Target
} from 'lucide-react';
import { SpeakingTest } from '@/types';
import MicrophoneTest from '@/components/MicrophoneTest';
import { evaluateAllSpeakingParts, CombinedSpeakingResult, saveSpeakingResults } from '@/services/evaluatorApi';

type TestPart = 'intro' | 1 | 2 | 3;
type InterviewState = 'idle' | 'connecting' | 'speaking' | 'listening' | 'processing' | 'completed' | 'error';

interface PageProps {
    params: Promise<{ testId: string }>;
}

// Fixed intro sequence
const INTRO_SEQUENCE = [
    { text: "Good afternoon.", waitForResponse: false },
    { text: "My name is Alex and I will be conducting your Speaking exam today.", waitForResponse: false },
    { text: "Can you tell me your full name, please?", waitForResponse: true },
    { text: "Thank you. And what should I call you?", waitForResponse: true },
    { text: "Can I see your identification, please?", waitForResponse: true },
    { text: "Thank you. That's fine.", waitForResponse: false },
    { text: "This interview is being recorded.", waitForResponse: false },
    { text: "The Speaking test has three parts.", waitForResponse: false },
    { text: "Are you ready to begin?", waitForResponse: true },
    { text: "Excellent. Let's start with Part 1.", waitForResponse: false },
];

export default function SpeakingTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [test, setTest] = useState<SpeakingTest | null>(null);
    const [loading, setLoading] = useState(true);

    // Interview state
    const [interviewState, setInterviewState] = useState<InterviewState>('idle');
    const [currentPart, setCurrentPart] = useState<TestPart>('intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [testCompleted, setTestCompleted] = useState(false);
    const [showDoneButton, setShowDoneButton] = useState(false);
    const [micCheckComplete, setMicCheckComplete] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<any>(null);

    // Refs for mutable state (avoids stale closure issues)
    const introStepRef = useRef(0);
    const currentPartRef = useRef<TestPart>('intro');
    const questionIndexRef = useRef(0);
    const isMountedRef = useRef(true);
    const isListeningRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const recognitionRef = useRef<any>(null);

    // Responses
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [responses, setResponses] = useState<Record<string, string>>({});

    // Timing
    const [elapsedTime, setElapsedTime] = useState(0);

    // Part 2 specific
    const [prepTime, setPrepTime] = useState(60);
    const [speakTime, setSpeakTime] = useState(120);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSpeakingPart2, setIsSpeakingPart2] = useState(false);

    // Audio Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordings, setRecordings] = useState<Array<{ label: string; blob: Blob; url: string }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [savedSessionId, setSavedSessionId] = useState<string | null>(null); // Database session ID for report
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const recordingMimeTypeRef = useRef<string>('audio/webm');
    const sessionIdRef = useRef<string>(`session-${Date.now()}`);

    // Navigate to report page
    const viewReport = () => {
        if (savedSessionId) {
            router.push(`/reports/speaking/${savedSessionId}`);
        } else {
            console.error('No session ID available for report');
            // Fallback to reports page
            router.push('/reports');
        }
    };

    // Upload recordings to backend
    const uploadRecordingsToBackend = async (recordingsToUpload: Array<{ label: string; blob: Blob }>) => {
        setIsUploading(true);
        setUploadStatus('uploading');

        try {
            for (const rec of recordingsToUpload) {
                const formData = new FormData();
                formData.append('audio', rec.blob, `${rec.label}.webm`);
                formData.append('test_id', testId);
                formData.append('session_id', sessionIdRef.current);
                formData.append('label', rec.label);

                const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

                // Use absolute URL to hit Django directly, bypassing Next.js API routes if they are missing
                const response = await fetch(`${API_BASE}/api/ielts/speaking/recordings/upload/`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    console.error('Failed to upload recording:', rec.label);
                }
            }

            setUploadStatus('success');
            console.log('All recordings uploaded successfully');
        } catch (error) {
            console.error('Error uploading recordings:', error);
            setUploadStatus('error');
        } finally {
            setIsUploading(false);
        }
    };

    // Load test data
    useEffect(() => {
        fetch('/data/speaking_tests.json')
            .then((res) => res.json())
            .then((data: any) => {
                const foundTest = data.tests.find((t: SpeakingTest) => t.test_id === parseInt(testId));
                // Only set test if not already set (to refrain from overwriting if result view loaded partial data? actually test data is static)
                setTest(foundTest || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [testId]);

    // Check if test is already completed (backend enforcement)
    useEffect(() => {
        const view = searchParams.get('view');
        // Skip check if viewing results
        if (view === 'result') return;

        const checkCompletion = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const res = await fetch(`${API_BASE}/api/ielts/check-completion/speaking/${testId}/`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.is_completed) {
                        // Test already completed - show a notice but stay on page
                        alert(`You have already completed this test with a band score of ${data.band_score || 'N/A'}.`);
                    }
                }
            } catch (e) {
                console.warn('Could not check test completion:', e);
            }
        };
        checkCompletion();
    }, [testId, searchParams, router]);

    // Load session result if view=result
    useEffect(() => {
        const view = searchParams.get('view');
        const sessionId = searchParams.get('sessionId');

        if (view === 'result' && sessionId) {
            const loadResult = async () => {
                try {
                    const res = await fetch(`/api/ielts/sessions/${sessionId}/`, { credentials: 'include' });
                    if (res.ok) {
                        const session = await res.json();
                        const attempt = session.module_attempts?.find((a: any) => a.module_type === 'speaking');

                        if (attempt) {
                            const result = attempt.feedback || {};
                            // Ensure overall band is available
                            if (!result.overall_band && attempt.band_score) {
                                result.overall_band = attempt.band_score;
                            }
                            setEvaluationResult(result);
                            setMicCheckComplete(true); // Skip mic check
                            setTestCompleted(true);
                            setInterviewState('completed');
                        }
                    }
                } catch (e) {
                    console.error('Failed to load result:', e);
                }
            };
            loadResult();
        }
    }, [searchParams]);

    // Initialize speech synthesis
    useEffect(() => {
        isMountedRef.current = true;
        if (typeof window !== 'undefined') {
            window.speechSynthesis.getVoices();
        }
        return () => {
            isMountedRef.current = false;
            if (typeof window !== 'undefined') {
                window.speechSynthesis.cancel();
            }
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);

    // Elapsed time timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (interviewState !== 'idle' && interviewState !== 'completed' && interviewState !== 'error') {
            interval = setInterval(() => setElapsedTime((t) => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [interviewState]);

    // Part 2 prep timer
    const [isGapCompleted, setIsGapCompleted] = useState(false);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPreparing && prepTime > 0) {
            interval = setInterval(() => setPrepTime((t) => t - 1), 1000);
        } else if (prepTime === 0 && isPreparing) {
            setIsPreparing(false);
            // Speak the TTS message, then enforce a 5‑second pause before enabling Part 2
            speakText("Your preparation time is over. Please begin speaking now").then(async () => {
                // 4.5 second gap after TTS finishes before starting the 2-minute timer
                await new Promise(r => setTimeout(r, 4500));
                if (isMountedRef.current) {
                    setIsGapCompleted(true);
                    setIsSpeakingPart2(true);
                    startListening();
                }
            });
        }
        return () => clearInterval(interval);
    }, [isPreparing, prepTime]);

    // Part 2 speaking timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSpeakingPart2 && speakTime > 0) {
            interval = setInterval(() => setSpeakTime((t) => t - 1), 1000);
        } else if (speakTime === 0 && isSpeakingPart2) {
            setIsSpeakingPart2(false);
            stopListening();
            savePartRecording('Part 2'); // Save Part 2 recording when time runs out
            transitionToPart3();
        }
        return () => clearInterval(interval);
    }, [isSpeakingPart2, speakTime]);

    // Text-to-Speech with improved voice quality
    const speakText = async (text: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!isMountedRef.current || !voiceEnabled) {
                resolve();
                return;
            }

            isSpeakingRef.current = true;
            setInterviewState('speaking');
            setShowDoneButton(false);

            const synth = window.speechSynthesis;
            synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1;
            utterance.volume = 1;

            // Get all available voices
            const voices = synth.getVoices();

            // Priority order for best voice quality
            const preferredVoice =
                // Best: Google UK English Female (very natural)
                voices.find(v => v.name === 'Google UK English Female') ||
                // Good: Microsoft Hazel (UK)
                voices.find(v => v.name.includes('Microsoft Hazel')) ||
                // Good: Google UK English Male
                voices.find(v => v.name === 'Google UK English Male') ||
                // Fallback: Any Google English voice
                voices.find(v => v.name.startsWith('Google') && v.lang.startsWith('en')) ||
                // Fallback: Any Microsoft English voice
                voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
                // Fallback: Any British English voice
                voices.find(v => v.lang === 'en-GB') ||
                // Fallback: Any English voice
                voices.find(v => v.lang.startsWith('en')) ||
                voices[0];

            if (preferredVoice) {
                utterance.voice = preferredVoice;
                console.log('Using voice:', preferredVoice.name);
            }

            utterance.onend = () => {
                setTimeout(() => {
                    isSpeakingRef.current = false;
                    resolve();
                }, 500);
            };
            utterance.onerror = (e) => {
                console.error('Speech error:', e);
                isSpeakingRef.current = false;
                resolve();
            };

            synth.speak(utterance);
        });
    };

    // Start listening
    const startListening = () => {
        if (typeof window === 'undefined' || !isMountedRef.current || isSpeakingRef.current) return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setInterviewState('error');
            return;
        }

        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        let finalTranscript = '';

        recognitionRef.current.onresult = (event: any) => {
            if (!isMountedRef.current) return;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setCurrentTranscript(finalTranscript + interim);
        };

        recognitionRef.current.onerror = () => { };
        recognitionRef.current.onend = () => {
            if (isListeningRef.current && isMountedRef.current && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) { }
            }
        };

        try {
            recognitionRef.current.start();
            isListeningRef.current = true;
            setInterviewState('listening');
            setShowDoneButton(true);

            // Start or resume audio recording (depends on if recorder is already running)
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                startRecording();
            } else {
                // Resume recording if paused
                resumeRecording();
            }
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    };

    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Media devices not supported in this browser');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordingStreamRef.current = stream;

            // Standardize on WebM format with Opus codec for best quality and compatibility
            // WebM/Opus can be easily converted to MP3 or other formats later
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            }

            recordingMimeTypeRef.current = mimeType;
            console.log('Recording with MIME type:', mimeType);

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            // Clear chunks for fresh recording
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                console.log('ondataavailable fired! data.size:', event.data.size);
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log(`✓ Recording chunks: ${audioChunksRef.current.length}, latest size: ${event.data.size}`);
                } else {
                    console.warn('ondataavailable fired but data.size is 0 - microphone might not be capturing audio');
                }
            };

            mediaRecorder.start(100); // Capture in 100ms chunks
            setIsRecording(true);
            console.log('Recording started (WebM/Opus format), fresh chunks');
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    };

    // Resume recording without clearing chunks (for continuing within same part)
    const resumeRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'paused') {
            recorder.resume();
            setIsRecording(true);
            console.log('Recording resumed, existing chunks:', audioChunksRef.current.length);
        }
    };

    // Pause recording (keep chunks for later)
    const pauseRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            // CRITICAL: Request any pending data before pausing
            // This ensures we capture audio even if paused before the timeslice (100ms)
            recorder.requestData();
            recorder.pause();
            setIsRecording(false);
            console.log('Recording paused, chunks so far:', audioChunksRef.current.length);
        }
    };

    // Stop current recording session and ensure all data is captured
    const stopRecordingSession = async (): Promise<void> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                stopTracks();
                resolve();
                return;
            }

            // Capture any final data before stopping
            const handleDataAvailable = (event: BlobEvent) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log('Final chunk captured, size:', event.data.size);
                }
            };

            // Set up the stop handler
            recorder.onstop = () => {
                console.log('Recording stopped, total chunks:', audioChunksRef.current.length);
                stopTracks();
                // Small delay to ensure all events are processed
                setTimeout(resolve, 50);
            };

            // Add listener for final data
            recorder.addEventListener('dataavailable', handleDataAvailable);

            // Request any pending data before stopping
            try {
                recorder.requestData();
            } catch (e) {
                // Some browsers don't support requestData
            }

            // Small delay to allow requestData to complete, then stop
            setTimeout(() => {
                try {
                    recorder.stop();
                } catch (e) {
                    console.error('Error stopping recorder:', e);
                    stopTracks();
                    resolve();
                }
            }, 100);
        });
    };

    const stopTracks = () => {
        if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(track => track.stop());
            recordingStreamRef.current = null;
        }
        setIsRecording(false);
    };

    // Save accumulated recording for the Part
    const savePartRecording = async (label: string) => {
        await stopRecordingSession();

        // Always use WebM format
        const mimeType = 'audio/webm';

        // Create blob from chunks
        if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            // Always use .webm extension for consistency
            const finalLabel = label.endsWith('.webm') ? label : `${label}.webm`;
            setRecordings(prev => [...prev, { label: finalLabel, blob, url }]);
            console.log('Recording saved:', finalLabel, 'Size:', blob.size, 'bytes');
        } else {
            console.warn('No audio chunks for:', label);
        }

        audioChunksRef.current = [];
    };

    // Stop listening
    const stopListening = () => {
        isListeningRef.current = false;
        setShowDoneButton(false);
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
            recognitionRef.current = null;
        }
    };

    // Get questions for current part
    const getCurrentQuestions = (): string[] => {
        if (!test) return [];
        if (currentPartRef.current === 1) return test.part_1.questions;
        if (currentPartRef.current === 3) {
            return test.part_3.discussion_topics.flatMap(t => t.questions);
        }
        return [];
    };

    // Process next intro step
    const processNextIntroStep = async () => {
        const currentIndex = introStepRef.current;
        const nextIndex = currentIndex + 1;
        introStepRef.current = nextIndex;

        console.log(`Processing intro step: ${currentIndex} -> ${nextIndex}`);

        if (nextIndex >= INTRO_SEQUENCE.length) {
            // Intro complete, start Part 1
            currentPartRef.current = 1;
            questionIndexRef.current = 0;
            setCurrentPart(1);
            setCurrentQuestionIndex(0);
            if (test) {
                await speakText(test.part_1.questions[0]);
                startListening();
            }
            return;
        }

        const step = INTRO_SEQUENCE[nextIndex];
        await speakText(step.text);

        if (step.waitForResponse) {
            startListening();
        } else {
            await new Promise(r => setTimeout(r, 800));
            if (isMountedRef.current) {
                await processNextIntroStep();
            }
        }
    };

    // Handle user done button click
    const handleUserDone = async () => {
        const transcript = currentTranscript;

        // Stop Part 2 timer if active
        if (currentPartRef.current === 2) {
            setIsSpeakingPart2(false);
        }

        stopListening();
        // Pause recording (don't stop - we'll continue for next question in same part)
        pauseRecording();

        setCurrentTranscript('');
        setInterviewState('processing');

        await new Promise(r => setTimeout(r, 300));

        if (currentPartRef.current === 'intro') {
            const nextIndex = introStepRef.current + 1;

            // If this was the last intro step, save the intro recording and start Part 1 fresh
            if (nextIndex >= INTRO_SEQUENCE.length) {
                await savePartRecording('Introduction');
            }

            await processNextIntroStep();
        } else {
            const key = `part${currentPartRef.current}-q${questionIndexRef.current}`;
            setResponses(prev => ({ ...prev, [key]: transcript }));

            // DON'T save per question - we save per PART now
            const questions = getCurrentQuestions();

            if (currentPartRef.current === 1) {
                if (questionIndexRef.current < questions.length - 1) {
                    questionIndexRef.current++;
                    setCurrentQuestionIndex(questionIndexRef.current);
                    await speakText(questions[questionIndexRef.current]);
                    startListening(); // Will resume recording
                } else {
                    // End of Part 1 - save Part 1 recording
                    await savePartRecording('Part 1');
                    await transitionToPart2();
                }
            } else if (currentPartRef.current === 2) {
                // Part 2 is a single long turn, save and transition
                await savePartRecording('Part 2');
                await transitionToPart3();
            } else if (currentPartRef.current === 3) {
                if (questionIndexRef.current < questions.length - 1) {
                    questionIndexRef.current++;
                    setCurrentQuestionIndex(questionIndexRef.current);
                    await speakText(questions[questionIndexRef.current]);
                    startListening(); // Will resume recording
                } else {
                    // End of Part 3 - save Part 3 recording
                    await savePartRecording('Part 3');
                    await endInterview();
                }
            }
        }
    };

    // Transition to Part 2
    const transitionToPart2 = async () => {
        if (!isMountedRef.current) return;
        currentPartRef.current = 2;
        questionIndexRef.current = 0;
        setCurrentPart(2);
        setCurrentQuestionIndex(0);

        await speakText("Thank you. That is the end of Part 1.");
        await speakText("Now let's move to Part 2. I will give you a topic. You have one minute to prepare, then speak for one to two minutes.");

        if (test) {
            await speakText(`Your topic is: ${test.part_2.title}`);
            await speakText(`You should say: ${test.part_2.prompts.join(', ')}`);
            await speakText("You have one minute to prepare. Your time starts now.");
            setIsPreparing(true);
            setPrepTime(60);
            // Reset gap flag for a fresh attempt
            setIsGapCompleted(false);
        }
    };

    // Transition to Part 3
    const transitionToPart3 = async () => {
        if (!isMountedRef.current) return;
        currentPartRef.current = 3;
        questionIndexRef.current = 0;
        setCurrentPart(3);
        setCurrentQuestionIndex(0);
        setIsSpeakingPart2(false);

        await speakText("Thank you. That is the end of Part 2.");
        await speakText("Now let's move to Part 3. I will ask you some questions related to the topic.");

        const questions = test?.part_3.discussion_topics.flatMap(t => t.questions) || [];
        if (questions.length > 0) {
            await speakText(questions[0]);
            startListening();
        }
    };

    // End interview
    const endInterview = async () => {
        if (!isMountedRef.current) return;
        await speakText("Thank you. That is the end of the Speaking test. Your responses have been recorded and are being evaluated.");
        setInterviewState('completed');
        setTestCompleted(true);

        // Upload recordings to backend
        if (recordings.length > 0) {
            await uploadRecordingsToBackend(recordings);
        }

        // Evaluate speaking responses with AI
        if (recordings.length > 0) {
            setIsEvaluating(true);
            try {
                // Extract part numbers from labels (e.g., "Part 1.webm" -> 1)
                const partsToEvaluate = recordings
                    .map(rec => {
                        const match = rec.label.match(/Part (\d+)/i);
                        if (match) {
                            return { part: parseInt(match[1]), blob: rec.blob };
                        }
                        return null;
                    })
                    .filter((p): p is { part: number; blob: Blob } => p !== null);

                if (partsToEvaluate.length > 0) {
                    const result = await evaluateAllSpeakingParts(partsToEvaluate);
                    setEvaluationResult(result);
                    console.log('Evaluation result:', result);

                    // Save session results to backend
                    try {
                        // Original save call (might be broken, but keep for legacy/data logging)
                        try { await saveSpeakingResults(testId, result, sessionIdRef.current); } catch (e) { }

                        // Reliability Save for Reports
                        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                        const saveRes = await fetch(`${API_BASE}/api/ielts/sessions/save_module_result/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                test_id: testId,
                                module_type: 'speaking',
                                band_score: result?.overall_band || 0,
                                raw_score: 0,
                                answers: {},
                                feedback: result
                            })
                        });

                        if (saveRes.ok) {
                            const sessionData = await saveRes.json();
                            console.log('Report result saved successfully', sessionData);
                            // Capture the real database session ID for report navigation
                            if (sessionData?.id) {
                                setSavedSessionId(sessionData.id);
                                sessionIdRef.current = sessionData.id; // Update ref too for consistency
                            }
                        } else {
                            console.warn('Failed to save report result:', await saveRes.text());
                        }

                    } catch (saveError) {
                        console.error('Failed to save session results:', saveError);
                    }
                }
            } catch (error) {
                console.error('Failed to evaluate speaking test:', error);
            } finally {
                setIsEvaluating(false);
            }
        }
    };

    // Start interview
    const startInterview = async () => {
        if (!test) return;

        // Reset refs
        introStepRef.current = 0;
        currentPartRef.current = 'intro';
        questionIndexRef.current = 0;
        audioChunksRef.current = []; // Clean start

        setInterviewState('connecting');
        setCurrentPart('intro');

        // Start with first intro step
        const firstStep = INTRO_SEQUENCE[0];
        await speakText(firstStep.text);

        if (firstStep.waitForResponse) {
            startListening();
        } else {
            await processNextIntroStep();
        }
    };

    // End interview manually
    const endInterviewManually = async () => {
        // Stop speech synthesis
        if (typeof window !== 'undefined') window.speechSynthesis.cancel();

        // Stop listening first
        stopListening();

        // Save any current recording before ending (by part, not question)
        if (audioChunksRef.current.length > 0) {
            let label = 'Manual End';
            if (currentPartRef.current === 'intro') {
                label = 'Introduction (partial)';
            } else if (currentPartRef.current === 1) {
                label = 'Part 1 (partial)';
            } else if (currentPartRef.current === 2) {
                label = 'Part 2 (partial)';
            } else if (currentPartRef.current === 3) {
                label = 'Part 3 (partial)';
            }
            await savePartRecording(label);
        }

        // Now set mounted to false to stop all activities
        isMountedRef.current = false;
        isListeningRef.current = false;
        isSpeakingRef.current = false;

        setInterviewState('completed');
        setTestCompleted(true);
    };

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get part label
    const getPartLabel = () => {
        if (currentPart === 'intro') return 'Introduction';
        return `Part ${currentPart}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!test) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <p className="text-zinc-400 mb-4">Test not found</p>
                    <Link href="/tests/speaking" className="text-emerald-500 hover:underline">
                        Back to Speaking Tests
                    </Link>
                </div>
            </div>
        );
    }

    // Show microphone check first
    if (!micCheckComplete) {
        return (
            <MicrophoneTest
                testId={testId}
                onComplete={() => setMicCheckComplete(true)}
            />
        );
    }

    if (testCompleted) {
        // Function to download a single recording with proper filename
        const downloadRecording = async (rec: { label: string; blob: Blob; url: string }): Promise<void> => {
            // Clean the label and always use .webm extension
            const cleanLabel = rec.label.replace(/\.webm$/i, '').replace(/\s+/g, '-');
            const filename = `speaking-test-${testId}-${cleanLabel}.webm`;

            // Try using the File System Access API (modern browsers) - gives native save dialog
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'WebM Audio',
                            accept: { 'audio/webm': ['.webm'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(rec.blob);
                    await writable.close();
                    return;
                } catch (err: any) {
                    // User cancelled or API not available, fall through to fallback
                    if (err.name !== 'AbortError') {
                        console.log('Save dialog cancelled or failed, using fallback');
                    } else {
                        return; // User cancelled, don't download
                    }
                }
            }

            // Fallback: Use octet-stream to force download (not play)
            const downloadBlob = new Blob([rec.blob], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(downloadBlob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // Cleanup after a short delay
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 150);
        };

        // Function to download all recordings
        const downloadAllRecordings = async () => {
            for (const rec of recordings) {
                await downloadRecording(rec);
                await new Promise(r => setTimeout(r, 600));
            }
        };

        // Navigate to report after successful upload
        const viewReport = () => {
            router.push(`/reports/speaking/${sessionIdRef.current}`);
        };

        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center max-w-2xl w-full">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-4">Interview Complete</h2>
                    <p className="text-zinc-500 text-lg mb-2">Duration: {formatTime(elapsedTime)}</p>
                    <p className="text-zinc-600 mb-4">Your responses have been recorded</p>

                    {/* Upload Status */}
                    {uploadStatus === 'uploading' && (
                        <div className="flex items-center justify-center gap-2 text-amber-400 mb-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving recordings to server...</span>
                        </div>
                    )}
                    {/* Evaluation Status */}
                    {isEvaluating && (
                        <div className="flex items-center justify-center gap-2 text-purple-400 mb-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>🤖 AI is evaluating your responses...</span>
                        </div>
                    )}
                    {uploadStatus === 'success' && (
                        <div className="flex flex-col items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle className="w-4 h-4" />
                                <span>Recordings saved successfully!</span>
                            </div>
                            <button
                                onClick={viewReport}
                                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg"
                            >
                                View Your Report →
                            </button>
                        </div>
                    )}

                    {/* Result Display if available */}
                    {evaluationResult && (
                        <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl p-8 mb-8 border border-zinc-800 text-left">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Evaluation Result</h3>
                                    <p className="text-zinc-400">AI Examiner Feedback</p>
                                </div>
                                <div className="px-6 py-4 bg-zinc-800 rounded-2xl border border-zinc-700 text-center">
                                    <div className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Overall Band</div>
                                    <div className={`text-4xl font-bold ${evaluationResult.overall_band >= 7 ? 'text-emerald-400' :
                                        evaluationResult.overall_band >= 5 ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                        {Number(evaluationResult.overall_band || 0).toFixed(1)}
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown if available */}
                            {evaluationResult.fluency !== undefined && (
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {[
                                        { label: 'Fluency', score: evaluationResult.fluency },
                                        { label: 'Lexical Resource', score: evaluationResult.lexical },
                                        { label: 'Grammar', score: evaluationResult.grammar },
                                        { label: 'Pronunciation', score: evaluationResult.pronunciation }
                                    ].map((item, i) => (
                                        <div key={i} className="bg-zinc-800 p-4 rounded-xl">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-zinc-400 font-medium">{item.label}</span>
                                                <span className="text-white font-bold">{item.score?.toFixed(1) || '-'}</span>
                                            </div>
                                            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${(item.score / 9) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {evaluationResult.feedback && (
                                <div className="space-y-6">
                                    {evaluationResult.feedback.strengths && (
                                        <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
                                            <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4" /> Strengths
                                            </h4>
                                            <p className="text-zinc-300 leading-relaxed text-sm">
                                                {evaluationResult.feedback.strengths}
                                            </p>
                                        </div>
                                    )}
                                    {evaluationResult.feedback.improvements && (
                                        <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
                                            <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                                                <Target className="w-4 h-4" /> Improvement Areas
                                            </h4>
                                            <p className="text-zinc-300 leading-relaxed text-sm">
                                                {evaluationResult.feedback.improvements}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {uploadStatus === 'error' && (
                        <div className="flex items-center justify-center gap-2 text-red-400 mb-4">
                            <XCircle className="w-4 h-4" />
                            <span>Failed to save recordings - download locally instead</span>
                        </div>
                    )}

                    {/* Recordings Section */}
                    {recordings.length > 0 ? (
                        <div className="bg-zinc-900 rounded-2xl p-6 mb-8 text-left border border-zinc-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Your Recordings ({recordings.length})</h3>
                                <button
                                    onClick={downloadAllRecordings}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all text-sm font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    Download All
                                </button>
                            </div>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {recordings.map((rec, idx) => (
                                    <div key={idx} className="flex items-center gap-4 bg-zinc-800 rounded-xl p-3">
                                        <span className="text-zinc-400 text-sm w-28 flex-shrink-0">{rec.label}</span>
                                        <audio src={rec.url} controls className="flex-1 h-8" />
                                        <button
                                            onClick={() => downloadRecording(rec)}
                                            className="p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
                                            title="Download recording"
                                        >
                                            <Download className="w-4 h-4 text-zinc-300" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 rounded-2xl p-6 mb-8 text-center border border-zinc-800">
                            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MicOff className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">No Recordings Available</h3>
                            <p className="text-zinc-500 text-sm mb-4">
                                Recordings may not have been captured. This can happen if:
                            </p>
                            <ul className="text-zinc-500 text-sm text-left max-w-md mx-auto space-y-1 mb-4">
                                <li>• Microphone permission was denied in the browser</li>
                                <li>• The interview was ended before answering any questions</li>
                                <li>• The browser doesn&apos;t support audio recording</li>
                            </ul>
                            <Link
                                href={`/tests/speaking/${testId}`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all text-sm font-medium"
                            >
                                <Mic className="w-4 h-4" />
                                Retry Test
                            </Link>
                        </div>
                    )}

                    <div className="flex gap-4 justify-center mt-8">
                        <Link href="/dashboard" className="px-6 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-medium hover:bg-zinc-800 transition-colors border border-zinc-800">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex flex-col">
            {/* Idle State */}
            {interviewState === 'idle' && (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center max-w-lg">
                        {/* Main Card */}
                        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-10 mb-6">
                            {/* Icon */}
                            <div className="relative w-32 h-32 mx-auto mb-8">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full opacity-20 animate-pulse" />
                                <div className="absolute inset-3 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full opacity-30 animate-pulse" />
                                <div className="absolute inset-6 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Mic className="w-10 h-10 text-white" />
                                </div>
                            </div>

                            <h2 className="text-3xl font-bold text-slate-800 mb-3">IELTS Speaking Test</h2>
                            <p className="text-slate-500 mb-8">Your microphone is ready. Click below to begin your interview with the AI examiner.</p>

                            {/* Info Pills */}
                            <div className="flex justify-center gap-3 mb-8">
                                <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
                                    11-14 mins
                                </div>
                                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium">
                                    3 Parts
                                </div>
                                <div className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-sm font-medium">
                                    AI Examiner
                                </div>
                            </div>

                            <button
                                onClick={startInterview}
                                className="group relative px-10 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-2xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-xl shadow-emerald-200"
                            >
                                <span className="flex items-center gap-3">
                                    <Phone className="w-5 h-5" />
                                    Start Interview
                                </span>
                            </button>
                        </div>

                        {/* Tips Card */}
                        <div className="bg-white/70 backdrop-blur rounded-2xl p-5 text-left border border-slate-200">
                            <h3 className="font-semibold text-slate-700 mb-3 text-sm">💡 Quick Tips</h3>
                            <ul className="space-y-2 text-sm text-slate-500">
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 mt-1">•</span>
                                    Speak clearly and at a natural pace
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 mt-1">•</span>
                                    Click "I'm Done Speaking" when you finish answering
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Interface */}
            {interviewState !== 'idle' && !testCompleted && (
                <div className="flex-1 flex flex-col relative z-0">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 bg-white/50 backdrop-blur-md border-b border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <span className="text-xl font-bold text-emerald-600">{getPartLabel().split(' ')[0][0]}</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-800">{getPartLabel()}</h1>
                                <p className="text-sm text-slate-500">
                                    {currentPart === 'intro' ? 'Introduction' : `Question ${currentQuestionIndex + 1}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setVoiceEnabled(!voiceEnabled)}
                            className={`p-3 rounded-xl transition-all ${voiceEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                        >
                            {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Center Visualization */}
                    <div className="flex-1 flex items-center justify-center">
                        <div className="relative">
                            {/* Outer Glow */}
                            <div className={`absolute -inset-4 rounded-full blur-xl opacity-30 ${interviewState === 'speaking'
                                ? 'bg-emerald-400'
                                : interviewState === 'listening'
                                    ? 'bg-blue-400'
                                    : 'bg-slate-300'
                                }`} />

                            {/* Main Circle */}
                            <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${interviewState === 'speaking'
                                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-200'
                                : interviewState === 'listening'
                                    ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-200'
                                    : 'bg-gradient-to-br from-slate-200 to-slate-300 shadow-slate-200'
                                }`}>
                                {interviewState === 'speaking' && (
                                    <div className="flex gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-2 bg-white/90 rounded-full animate-pulse"
                                                style={{ height: `${20 + Math.random() * 30}px`, animationDelay: `${i * 100}ms` }}
                                            />
                                        ))}
                                    </div>
                                )}
                                {interviewState === 'listening' && (
                                    <Mic className="w-16 h-16 text-white" />
                                )}
                                {interviewState === 'processing' && (
                                    <Loader2 className="w-12 h-12 text-white/60 animate-spin" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Part 2 Preparation/Speaking Overlay */}
                    {(isPreparing || isSpeakingPart2) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-md z-10">
                            <div className="text-center max-w-2xl px-8">
                                {/* Timer Circle */}
                                <div className={`relative w-40 h-40 mx-auto mb-8 rounded-full shadow-xl ${isPreparing ? 'bg-amber-50 border-4 border-amber-300 shadow-amber-100' : 'bg-emerald-50 border-4 border-emerald-300 shadow-emerald-100'}`}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-5xl font-bold ${isPreparing ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {formatTime(isPreparing ? prepTime : speakTime)}
                                        </span>
                                    </div>
                                </div>

                                {/* Status Label */}
                                <div className={`inline-block px-6 py-2 rounded-full text-sm font-semibold mb-6 ${isPreparing ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {isPreparing ? '📝 Preparation Time' : '🎤 Speaking Time'}
                                </div>

                                {/* Topic and Prompts */}
                                {test && (
                                    <div className="bg-white rounded-2xl p-6 mb-8 text-left border border-slate-200 shadow-lg">
                                        <h3 className="text-lg font-bold text-slate-800 mb-3">Topic: {test.part_2.title}</h3>
                                        <p className="text-slate-500 text-sm mb-4">You should say:</p>
                                        <ul className="space-y-2">
                                            {test.part_2.prompts.map((prompt, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-slate-700 text-sm">
                                                    <span className="text-amber-500 font-bold">•</span>
                                                    {prompt}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Skip/Action Buttons */}
                                {isPreparing && (
                                    <button
                                        onClick={() => {
                                            setIsPreparing(false);
                                            setIsSpeakingPart2(true);
                                            speakText("You chose to start early. Please begin speaking now.").then(() => {
                                                startListening();
                                            });
                                        }}
                                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all flex items-center gap-3 mx-auto shadow-lg shadow-amber-200"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        I'm Ready - Start Speaking
                                    </button>
                                )}

                                {isSpeakingPart2 && (
                                    <button
                                        onClick={async () => {
                                            setIsSpeakingPart2(false);
                                            stopListening();
                                            await savePartRecording('Part 2');
                                            transitionToPart3();
                                        }}
                                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-3 mx-auto shadow-lg shadow-emerald-200"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        I'm Done Speaking
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status */}
                    <div className="flex-shrink-0 text-center py-6">
                        <p className={`text-lg font-medium ${interviewState === 'speaking' ? 'text-emerald-600' :
                            interviewState === 'listening' ? 'text-blue-600' :
                                'text-slate-500'
                            }`}>
                            {interviewState === 'speaking' && '🎙️ Examiner is speaking...'}
                            {interviewState === 'listening' && '🎤 Your turn - Click button when done'}
                            {interviewState === 'processing' && '⏳ Processing...'}
                        </p>
                    </div>

                    {/* Bottom Controls */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-6 pb-12">
                        {/* Done Button */}
                        {showDoneButton && interviewState === 'listening' && (
                            <button
                                onClick={handleUserDone}
                                className="px-10 py-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-xl shadow-emerald-200 flex items-center gap-4"
                            >
                                <CheckCircle className="w-8 h-8" />
                                I'm Done Speaking
                            </button>
                        )}

                        <div className="flex items-center justify-center gap-6">
                            <button
                                onClick={stopListening}
                                className={`p-5 rounded-2xl transition-all ${interviewState === 'listening'
                                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-200'
                                    : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                                    }`}
                            >
                                {interviewState === 'listening' ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                            </button>
                            <button
                                onClick={endInterviewManually}
                                className="p-5 rounded-2xl bg-red-100 text-red-600 border-2 border-red-200 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
