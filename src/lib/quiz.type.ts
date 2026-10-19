export interface Quiz {
    id: string;
    question: string;
    answers: QuizAnswer[];
    explanation: string;
}

interface QuizAnswer {
    text: string;
    correct: boolean;
}