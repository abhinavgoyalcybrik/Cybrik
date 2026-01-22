/**
 * IELTS AI Evaluator API Service
 * Provides functions to call the AI Evaluator API for grading tests
 */

const API_URL = process.env.NEXT_PUBLIC_EVALUATOR_API || 'http://localhost:8001';
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// Utilities
// ============================================

/**
 * Generate a unique attempt ID for tracking test attempts
 */
export function generateAttemptId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `attempt_${timestamp}_${randomPart}`;
}

// ============================================
// Types
// ============================================

export interface WritingTask {
    question: string;
    answer: string;
}

export interface WritingEvaluationResult {
    attempt_id: string;
    module: string;
    overall_writing_band: number;
    tasks: {
        task_1?: {
            overall_band: number;
            criteria_scores: {
                task_response: number;
                coherence_cohesion: number;
                lexical_resource: number;
                grammar_accuracy: number;
            };
            mistakes: Array<{
                sentence: string;
                error_type: string;
                explanation: string;
                correction: string;
            }>;
            refined_answer: string;
            word_count: number;
        };
        task_2: {
            overall_band: number;
            criteria_scores: {
                task_response: number;
                coherence_cohesion: number;
                lexical_resource: number;
                grammar_accuracy: number;
            };
            mistakes: Array<{
                sentence: string;
                error_type: string;
                explanation: string;
                correction: string;
            }>;
            refined_answer: string;
            word_count: number;
        };
    };
}

export interface SpeakingEvaluationResult {
    attempt_id: string;
    part: number;
    result: {
        fluency: number;
        lexical: number;
        grammar: number;
        pronunciation: number;
        overall_band: number;
        feedback: {
            strengths: string;
            improvements: string;
        };
    };
}

export interface CombinedSpeakingResult {
    attempt_id: string;
    overall_band: number;
    fluency: number;
    lexical: number;
    grammar: number;
    pronunciation: number;
    feedback: {
        strengths: string;
        improvements: string;
    };
    parts: SpeakingEvaluationResult[];
    // Add parts array for structured data
    parts_detailed?: Array<{
        part: number;
        transcript: string;
        duration: string;
        audio_url?: string;
        result: {
            fluency: number;
            lexical: number;
            grammar: number;
            pronunciation: number;
            overall_band: number;
            feedback: {
                strengths: string;
                improvements: string;
            };
            grammar_analysis?: Array<{ error: string; correction: string; explanation: string; type: string }>;
            vocabulary_analysis?: Array<{ word: string; cefr: string; enhancement?: string }>;
            pronunciation_analysis?: Array<{ word: string; status: string; score: number }>;
            fluency_analysis?: { wpm: number; pauses: Array<{ start: number; end: number; duration: number }>; pause_count: number };
        };
    }>;
}

export interface ReadingEvaluationResult {
    attempt_id?: string;
    module: string;
    overall_band: number;
    accuracy: string;
    improvements: string[];
    examiner_feedback: string;
}

export interface ListeningEvaluationResult {
    attempt_id?: string;
    module: string;
    overall_band: number;
    accuracy: string;
    improvements: string[];
    examiner_feedback: string;
}

// ============================================
// API Functions
// ============================================

/**
 * Evaluate a Writing test (Task 1 and/or Task 2)
 */
export async function evaluateWriting(
    task1: WritingTask | null,
    task2: WritingTask,
    attemptId?: string
): Promise<WritingEvaluationResult> {
    const attempt_id = attemptId || generateAttemptId();
    const payload: { attempt_id: string; task_1?: WritingTask; task_2: WritingTask } = {
        attempt_id,
        task_2: task2
    };
    if (task1) {
        payload.task_1 = task1;
    }

    const response = await fetch(`${API_URL}/writing/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Writing evaluation failed: ${error}`);
    }

    const result = await response.json();
    return { ...result, attempt_id };
}

/**
 * Evaluate a Speaking test part (audio upload)
 * Routes through Django backend which proxies to AI Evaluator
 */
export async function evaluateSpeakingPart(
    part: number,
    audioBlob: Blob,
    attemptId?: string
): Promise<SpeakingEvaluationResult> {
    const formData = new FormData();
    formData.append('file', audioBlob, `part_${part}.webm`);
    formData.append('part', String(part));
    if (attemptId) {
        formData.append('attempt_id', attemptId);
    }

    // Use Django backend proxy endpoint instead of direct evaluator
    const response = await fetch(`${BACKEND_API_URL}/api/ielts/speaking/evaluate-part/`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Speaking evaluation failed: ${error}`);
    }

    return response.json();
}

/**
 * Evaluate a Reading test
 */
export async function evaluateReading(
    questions: Array<{ question_id: string; answer_key: string; type: string }>,
    userAnswers: Record<string, string>,
    attemptId?: string
): Promise<ReadingEvaluationResult> {
    const attempt_id = attemptId || generateAttemptId();
    const response = await fetch(`${API_URL}/reading/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id, questions, user_answers: userAnswers }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reading evaluation failed: ${error}`);
    }

    const result = await response.json();
    return { ...result, attempt_id };
}

/**
 * Evaluate a Listening test
 */
export async function evaluateListening(
    answerKey: Record<string, string>,
    userAnswers: Record<string, string>,
    attemptId?: string
): Promise<ListeningEvaluationResult> {
    const attempt_id = attemptId || generateAttemptId();
    const response = await fetch(`${API_URL}/listening/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id, answer_key: answerKey, user_answers: userAnswers }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Listening evaluation failed: ${error}`);
    }

    const result = await response.json();
    return { ...result, attempt_id };
}

/**
 * Check if the evaluator API is healthy
 */
export async function checkEvaluatorHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Evaluate all speaking parts and combine results
 * @param recordings Array of recordings with part number and blob
 * @param attemptId Optional attempt ID for tracking
 * @returns Combined speaking evaluation result with averaged scores
 */
export async function evaluateAllSpeakingParts(
    recordings: Array<{ part: number; blob: Blob }>,
    attemptId?: string
): Promise<CombinedSpeakingResult> {
    const attempt_id = attemptId || generateAttemptId();
    const results: SpeakingEvaluationResult[] = [];
    
    // Ensure all 3 parts are represented, even if not evaluated
    const partsMap = new Map<number, SpeakingEvaluationResult>();
    for (let i = 1; i <= 3; i++) {
        partsMap.set(i, {
            attempt_id,
            part: i,
            result: {
                fluency: 0,
                lexical: 0,
                grammar: 0,
                pronunciation: 0,
                overall_band: 0,
                feedback: {
                    strengths: '',
                    improvements: ''
                }
            }
        });
    }

    // Evaluate each part
    for (const rec of recordings) {
        try {
            const result = await evaluateSpeakingPart(rec.part, rec.blob, attempt_id);
            results.push(result);
            partsMap.set(rec.part, result);
        } catch (error) {
            console.error(`Failed to evaluate Part ${rec.part}:`, error);
            // Continue with other parts even if one fails
        }
    }

    // Get all parts in order
    const allParts = Array.from(partsMap.values()).sort((a, b) => a.part - b.part);
    const evaluatedParts = results.length > 0 ? results : allParts;

    if (results.length === 0) {
        console.warn('No speaking parts could be evaluated, returning empty structure');
    }

    // Calculate averages only from evaluated parts
    const avgFluency = evaluatedParts.length > 0 ? evaluatedParts.reduce((sum, r) => sum + r.result.fluency, 0) / evaluatedParts.length : 0;
    const avgLexical = evaluatedParts.length > 0 ? evaluatedParts.reduce((sum, r) => sum + r.result.lexical, 0) / evaluatedParts.length : 0;
    const avgGrammar = evaluatedParts.length > 0 ? evaluatedParts.reduce((sum, r) => sum + r.result.grammar, 0) / evaluatedParts.length : 0;
    const avgPronunciation = evaluatedParts.length > 0 ? evaluatedParts.reduce((sum, r) => sum + r.result.pronunciation, 0) / evaluatedParts.length : 0;
    const overallBand = evaluatedParts.length > 0 ? evaluatedParts.reduce((sum, r) => sum + r.result.overall_band, 0) / evaluatedParts.length : 0;

    // Combine feedback from all parts
    const strengths = evaluatedParts
        .map(r => r.result.feedback?.strengths)
        .filter(Boolean)
        .join(' ') || 'Good overall performance';
    const improvements = evaluatedParts
        .map(r => r.result.feedback?.improvements)
        .filter(Boolean)
        .join(' ') || 'Continue practicing for further improvement';

    return {
        attempt_id,
        overall_band: Math.round(overallBand * 2) / 2, // Round to nearest 0.5
        fluency: Math.round(avgFluency * 2) / 2,
        lexical: Math.round(avgLexical * 2) / 2,
        grammar: Math.round(avgGrammar * 2) / 2,
        pronunciation: Math.round(avgPronunciation * 2) / 2,
        feedback: {
            strengths: strengths || 'Good overall performance.',
            improvements: improvements || 'Continue practicing for further improvement.',
        },
        parts: evaluatedParts,  // Include all parts (1, 2, 3)
        parts_detailed: allParts.map(p => ({
            part: p.part,
            transcript: '',
            duration: '0:00',
            audio_url: undefined,
            result: p.result
        }))
    };
}

/**
 * Save aggregated speaking results to backend
 * specific to our Django integration
 */
export async function saveSpeakingResults(
    testId: string,
    result: CombinedSpeakingResult,
    sessionId: string
): Promise<any> {
    const payload = {
        session_id: sessionId,
        test_id: testId,
        overall_band: result.overall_band,
        parts: result.parts.map(p => ({
            part: p.part,
            score: p.result,
            feedback: p.result.feedback,
            recording_label: `Part ${p.part}.webm`
        }))
    };

    const response = await fetch(`${BACKEND_API_URL}/api/ielts/speaking/save-results/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to save speaking results: ${error}`);
    }

    return response.json();
}

