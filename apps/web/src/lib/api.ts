const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function getStoredToken(): string | null {
  return null;
}

export function setStoredToken(_token: string | null) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('acorn_token');
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('acorn_user');
  return user ? JSON.parse(user) : null;
}

export function setStoredUser(user: any | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('acorn_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('acorn_user');
    localStorage.removeItem('acorn_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'API request failed');
    }
    return res.json();
  } catch (error) {
    console.warn(`API call failed for ${path}:`, error);
    throw error;
  }
}

function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // Auth & Identity
  login: async (email: string, password?: string) => {
    const data = await request<{ user: any }>('/identity/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredUser(data.user);
    return data;
  },
  logout: async () => {
    try {
      await request('/identity/logout', { method: 'POST' });
    } finally {
      setStoredUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('acorn_token');
      }
    }
  },
  getMe: () => request<any>('/identity/me'),
  getUsers: (params?: any) => {
    const qs = typeof params === 'string' ? (params ? `?role=${params}` : '') : buildQueryString(params);
    return request<any>(`/identity/users${qs}`);
  },
  createUser: (data: any) =>
    request<any>('/identity/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    request<any>(`/identity/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetUserPassword: (userId: string, newPassword?: string) =>
    request<any>(`/identity/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(newPassword ? { newPassword } : {}),
    }),

  // Taxonomy & Skills
  getSkills: (params?: any) => request<any>(`/taxonomy/skills${buildQueryString(params)}`),
  getSkillTree: () => request<any[]>('/taxonomy/tree'),
  createSkill: (data: any) =>
    request<any>('/taxonomy/skills', { method: 'POST', body: JSON.stringify(data) }),
  updateSkill: (id: string, data: any) =>
    request<any>(`/taxonomy/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSkill: (id: string) =>
    request<any>(`/taxonomy/skills/${id}`, { method: 'DELETE' }),

  // Courses & Classes
  getCourses: (params?: any) => request<any>(`/courses${buildQueryString(params)}`),
  createCourse: (data: any) =>
    request<any>('/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id: string, data: any) =>
    request<any>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getClasses: (params?: any) => request<any>(`/classes${buildQueryString(params)}`),
  getClass: (id: string) => request<any>(`/classes/${id}`),
  getClassEnrollments: (classId: string, params?: any) =>
    request<any>(`/classes/${classId}/enrollments${buildQueryString(params)}`),
  createClass: (data: any) =>
    request<any>('/classes', { method: 'POST', body: JSON.stringify(data) }),
  updateClass: (id: string, data: any) =>
    request<any>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  enrollLearner: (classId: string, learnerId: string) =>
    request<any>(`/classes/${classId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ learnerId }),
    }),
  unenrollLearner: (classId: string, learnerId: string) =>
    request<any>(`/classes/${classId}/enroll/${learnerId}`, {
      method: 'DELETE',
    }),

  // Materials
  getMaterials: (query?: string) => request<any[]>(`/materials${query ? `?${query}` : ''}`),
  getMaterial: (id: string) => request<any>(`/materials/${id}`),
  createMaterial: (data: any) =>
    request<any>('/materials', { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: string, data: any) =>
    request<any>(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateMaterialStatus: (id: string, status: string) =>
    request<any>(`/materials/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  archiveMaterial: (id: string) =>
    request<any>(`/materials/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ARCHIVED' }) }),
  releaseMaterialToClass: (materialId: string, classId: string) =>
    request<any>(`/materials/${materialId}/release`, {
      method: 'POST',
      body: JSON.stringify({ classId }),
    }),
  revokeMaterialRelease: (materialId: string, classId: string) =>
    request<any>(`/materials/${materialId}/release/${classId}`, {
      method: 'DELETE',
    }),
  getMaterialReleases: (materialId: string) =>
    request<any[]>(`/materials/${materialId}/releases`),
  adaptMaterial: (id: string, data: any) =>
    request<any>(`/materials/${id}/adapt`, { method: 'POST', body: JSON.stringify(data) }),
  uploadMaterialFile: async (materialId: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}/materials/${materialId}/files`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'File upload failed');
    }
    return res.json();
  },
  getMaterialFileDownloadUrl: (materialId: string, fileId: string) =>
    request<{ url: string; fileName: string; mimeType: string }>(
      `/materials/${materialId}/files/${fileId}/download`
    ),

  // Assessments & Questions
  getQuestions: (query?: string) =>
    request<any[]>(`/assessments/questions${query ? `?${query}` : ''}`),
  getQuestion: (id: string) => request<any>(`/assessments/questions/${id}`),
  createQuestion: (data: any) =>
    request<any>('/assessments/questions', { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (id: string, data: any) =>
    request<any>(`/assessments/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAssessments: () => request<any[]>('/assessments'),
  getAssessment: (id: string) => request<any>(`/assessments/${id}`),
  createAssessment: (data: any) =>
    request<any>('/assessments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssessment: (id: string, data: any) =>
    request<any>(`/assessments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishAssessment: (id: string) =>
    request<any>(`/assessments/${id}/publish`, { method: 'PUT' }),
  closeAssessment: (id: string) =>
    request<any>(`/assessments/${id}/close`, { method: 'PUT' }),
  assignAssessment: (id: string, data: any) =>
    request<any>(`/assessments/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),

  // Submissions
  getSubmissions: (query?: string) =>
    request<any[]>(`/submissions${query ? `?${query}` : ''}`),
  getSubmission: (id: string) => request<any>(`/submissions/${id}`),
  beginSubmission: (id: string) =>
    request<any>(`/submissions/${id}/begin`, { method: 'POST' }),
  autosave: (id: string, data: any) =>
    request<any>(`/submissions/${id}/autosave`, { method: 'POST', body: JSON.stringify(data) }),
  uploadSubmissionAudio: async (submissionId: string, questionId: string, file: Blob | File) => {
    const formData = new FormData();
    formData.append('questionId', questionId);
    formData.append('file', file, (file as any).name || 'recording.webm');
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/audio`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to upload audio response');
    }
    return res.json();
  },
  getSubmissionAudioUrl: (submissionId: string, questionId: string) =>
    request<{ audioUrl?: string; url?: string; mimeType?: string }>(`/submissions/${submissionId}/audio/${questionId}`),
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
    request<any>(`/recommendations/${recId}/decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  assignNextActivity: (recId: string, data: any) =>
    request<any>(`/recommendations/${recId}/assign-next-activity`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Audit & Pilot Metrics
  getAuditEvents: (params?: any) => request<any>(`/audit/events${buildQueryString(params)}`),
  getMetrics: () => request<any>('/audit/metrics'),
};
