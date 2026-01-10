// IELTS Test Types

// Speaking Test Types
export interface SpeakingPart1 {
    topic: string;
    questions: string[];
}

export interface SpeakingPart2 {
    title: string;
    prompts: string[];
}

export interface DiscussionTopic {
    topic: string;
    questions: string[];
}

export interface SpeakingPart3 {
    discussion_topics: DiscussionTopic[];
}

export interface SpeakingTest {
    test_id: number;
    difficulty: 'easy' | 'medium' | 'hard';
    part_1: SpeakingPart1;
    part_2: SpeakingPart2;
    part_3: SpeakingPart3;
}

export interface SpeakingTestsData {
    metadata: {
        totalTests: number;
        generatedAt: string;
        format: string;
    };
    tests: SpeakingTest[];
}

// Writing Test Types
export interface WritingTask1 {
    type: 'chart' | 'process' | 'map' | 'table' | 'diagram';
    question: string;
    image_url?: string; // Optional - user will add images over time
    word_limit: number;
}

export interface WritingTask2 {
    question: string;
    word_limit: number;
}

export interface WritingTest {
    test_id: number;
    difficulty: 'easy' | 'medium' | 'hard';
    task_1: WritingTask1;
    task_2: WritingTask2;
}

export interface WritingTestsData {
    metadata: {
        totalTests: number;
        generatedAt: string;
        format: string;
    };
    tests: WritingTest[];
}

// Test Mode
export type WritingMode = 'academic' | 'general';

// Speech Recognition Types (for browser API)
export interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

export interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
