const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer 11111111-1111-1111-1111-111111111111',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'API request failed');
    }
    return res.json();
  } catch (error) {
    // If API server is offline during static build or local render, return empty or handle gracefully
    console.warn(`API call failed for ${path}:`, error);
    throw error;
  }
}

export const api = {
  // Materials
  getMaterials: (query?: string) => request<any[]>(`/materials${query ? `?${query}` : ''}`),
  getMaterial: (id: string) => request<any>(`/materials/${id}`),
  createMaterial: (data: any) =>
    request<any>('/materials', { method: 'POST', body: JSON.stringify(data) }),
  adaptMaterial: (id: string, data: any) =>
    request<any>(`/materials/${id}/adapt`, { method: 'POST', body: JSON.stringify(data) }),

  // Assessments & Questions
  getQuestions: (query?: string) =>
    request<any[]>(`/assessments/questions${query ? `?${query}` : ''}`),
  getQuestion: (id: string) => request<any>(`/assessments/questions/${id}`),
  createQuestion: (data: any) =>
    request<any>('/assessments/questions', { method: 'POST', body: JSON.stringify(data) }),
  getAssessments: () => request<any[]>('/assessments'),
  getAssessment: (id: string) => request<any>(`/assessments/${id}`),
  createAssessment: (data: any) =>
    request<any>('/assessments', { method: 'POST', body: JSON.stringify(data) }),
  assignAssessment: (id: string, data: any) =>
    request<any>(`/assessments/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),

  // Submissions
  getSubmissions: (query?: string) =>
    request<any[]>(`/submissions${query ? `?${query}` : ''}`),
  getSubmission: (id: string) => request<any>(`/submissions/${id}`),
  autosave: (id: string, data: any) =>
    request<any>(`/submissions/${id}/autosave`, { method: 'POST', body: JSON.stringify(data) }),
  submit: (id: string, data: any) =>
    request<any>(`/submissions/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  evaluate: (id: string, data: any) =>
    request<any>(`/submissions/${id}/evaluate`, { method: 'POST', body: JSON.stringify(data) }),

  // Evidence
  getEvidence: (query?: string) =>
    request<any[]>(`/evidence${query ? `?${query}` : ''}`),
  getEvidenceItem: (id: string) => request<any>(`/evidence/${id}`),
  correctEvidence: (id: string, data: any) =>
    request<any>(`/evidence/${id}/correct`, { method: 'POST', body: JSON.stringify(data) }),

  // Learners
  getLearners: (query?: string) =>
    request<any[]>(`/learners${query ? `?${query}` : ''}`),
  getLearnerProfile: (id: string) => request<any>(`/learners/${id}/profile`),

  // Recommendations
  getRecommendation: (learnerId: string) => request<any>(`/recommendations/learner/${learnerId}`),
  recordDecision: (recId: string, data: any) =>
    request<any>(`/recommendations/${recId}/decision`, { method: 'POST', body: JSON.stringify(data) }),

  // AI
  generateAI: (data: any) =>
    request<any>('/ai/generate', { method: 'POST', body: JSON.stringify(data) }),
  getAICandidates: () => request<any[]>('/ai/candidates'),
  getAICandidate: (id: string) => request<any>(`/ai/candidates/${id}`),
  reviewAICandidate: (id: string, data: any) =>
    request<any>(`/ai/candidates/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  // Classes & Courses
  getClasses: () => request<any[]>('/classes'),
  getClass: (id: string) => request<any>(`/classes/${id}`),

  // Metrics
  getMetrics: () => request<any>('/audit/metrics'),
};
