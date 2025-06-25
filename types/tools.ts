export interface ToolFunctions {
  // Question Management
  getQuestion: (params: {
    category: string;
    difficulty: number;
    previousQuestions?: string[];
  }) => Promise<{
    question: string;
    expectedCriteria: string[];
    category: string;
    difficulty: number;
  }>;

  // Answer Evaluation
  evaluateAnswer: (params: {
    question: string;
    answer: string;
    criteria: string[];
  }) => Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    flags?: string[];
  }>;

  // Interview Progress Management
  updateInterviewState: (params: {
    currentScore: number;
    timeElapsed: number;
    questionsAsked: number;
    candidateEngagement: number;
  }) => Promise<{
    shouldContinue: boolean;
    nextAction: string;
    adjustedDifficulty?: number;
  }>;

  // Candidate Analysis
  analyzeBehavior: (params: {
    transcriptSegment: string;
    audioFeatures?: {
      volume: number;
      pitch: number;
      speed: number;
    };
  }) => Promise<{
    confidence: number;
    clarity: number;
    professionalism: number;
    flags: string[];
  }>;

  // Technical Skill Assessment
  assessTechnicalResponse: (params: {
    question: string;
    response: string;
    technology: string;
    expectedConcepts: string[];
  }) => Promise<{
    technicalAccuracy: number;
    conceptCoverage: string[];
    missingConcepts: string[];
    suggestions: string[];
  }>;
}
