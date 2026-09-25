'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  Card,
  ErrorState,
  EmptyState,
} from '@acorn/ui';
import {
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  AlertCircle,
  Mic,
  Square,
  Play,
  RotateCcw,
  Volume2,
  FileAudio,
  HelpCircle,
  Check,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentPlayerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [autosaveStatus, setAutosaveStatus] = useState('Answers autosaved');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<any[]>([]);
  const [submissionId, setSubmissionId] = useState<string>(params.id);
  const [title, setTitle] = useState('Assessment Checkpoint');
  const [submissionStatus, setSubmissionStatus] = useState<string>('STARTED');
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState<string | null>(null);
  const [customPassage, setCustomPassage] = useState<string | null>(null);
  const [assessmentInstructions, setAssessmentInstructions] = useState<string | null>(null);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [actualStartedAt, setActualStartedAt] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [assessmentLevel, setAssessmentLevel] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const autoSubmittedRef = useRef(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Audio Recording State for Speaking questions
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [listeningAudioUrl, setListeningAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sub = await api.getSubmission(params.id);
      if (sub?.id) setSubmissionId(sub.id);
      if (sub?.assessmentTitle) setTitle(sub.assessmentTitle);
      setSubmissionStatus(sub?.status || 'STARTED');
      setOverallScore(sub?.overallScore ?? null);
      setTeacherFeedback(sub?.teacherFeedback || null);
      setAssessmentInstructions(sub?.assessmentInstructions || null);
      setTimeLimitMinutes(sub?.timeLimitMinutes ?? null);
      setStartedAt(sub?.startedAt || null);
      setActualStartedAt(sub?.actualStartedAt || null);
      setDueAt(sub?.dueAt || null);
      setSubmittedAt(sub?.submittedAt || null);
      setAssessmentLevel(sub?.assessmentLevel || sub?.level || 'B1');

      if (sub?.items && sub.items.length > 0) {
        const loaded = sub.items.map((it: any) => ({
          id: it.question?.id || it.questionId,
          type: it.question?.type || 'MCQ',
          prompt: it.question?.prompt || 'Question Prompt',
          options: it.question?.options || [],
          passage: it.question?.passage || null,
          points: it.points || 1.0,
          correctAnswer: it.question?.correctAnswer || null,
          rubric: it.question?.rubric || null,
          sourceMaterialId: it.question?.sourceMaterialId || null,
          audioUrl: it.question?.audioUrl || it.question?.mediaUrl || null,
          // Response feedback
          isCorrect: it.response?.isCorrect,
          rawScore: it.response?.rawScore,
          normalizedScore: it.response?.normalizedScore,
          teacherFeedback: it.response?.teacherFeedback,
          rubricScores: it.response?.rubricScores,
          savedResponse: it.response?.responsePayload,
        }));
        setQuestions(loaded);
        if (loaded[0]?.passage) {
          setCustomPassage(loaded[0].passage);
        }
      } else {
        setQuestions([]);
      }

      let loadedAnswers: Record<string, any> = {};
      if (sub?.responses && sub.responses.length > 0) {
        for (const r of sub.responses) {
          if (r.responsePayload != null) {
            loadedAnswers[r.questionId] = r.responsePayload;
          }
        }
      }

      // Check for locally saved draft if not finalized
      const isFin = sub?.status === 'SUBMITTED' || sub?.status === 'EVALUATED';
      if (!isFin && typeof window !== 'undefined') {
        try {
          const localStr = localStorage.getItem(`acorn_draft_${params.id}`);
          if (localStr) {
            const localObj = JSON.parse(localStr);
            loadedAnswers = { ...loadedAnswers, ...localObj };
          }
        } catch {}
      }
      setAnswers(loadedAnswers);
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment checkpoint');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const retrySync = useCallback(async () => {
    setAutosaveStatus('Saving...');
    try {
      for (const [qId, val] of Object.entries(answers)) {
        await api.autosave(submissionId, { questionId: qId, responsePayload: val });
      }
      setAutosaveStatus('Answers autosaved');
    } catch {
      setAutosaveStatus('Saved locally');
    }
  }, [answers, submissionId]);

  // Re-sync upon browser reconnect
  useEffect(() => {
    const handleOnline = () => {
      if (autosaveStatus === 'Saved locally') {
        retrySync();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autosaveStatus, retrySync]);

  const isReadOnly = submissionStatus === 'SUBMITTED' || submissionStatus === 'EVALUATED';

  // Submit Logic
  const executeSubmit = useCallback(async () => {
    if (submissionStatus === 'SUBMITTED' || submissionStatus === 'EVALUATED') return;
    setSubmitting(true);
    setSubmitError(null);
    setShowConfirmModal(false);
    try {
      await api.submit(submissionId, {
        submissionId: submissionId,
        answers: Object.entries(answers).map(([qId, val]) => ({
          questionId: qId,
          responsePayload: val,
        })),
      });
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`acorn_draft_${submissionId}`);
        } catch {}
      }
      router.push('/student');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit assessment. Please try again.');
      setSubmitting(false);
    }
  }, [submissionStatus, submissionId, answers, router]);

  // Timer Effect
  useEffect(() => {
    // G01: Use actualStartedAt instead of startedAt
    const timerStart = actualStartedAt || startedAt;

    if (loading || isReadOnly || !timeLimitMinutes || !timerStart) {
      setRemainingSeconds(null);
      return;
    }

    const startTs = new Date(timerStart).getTime();
    const totalSec = timeLimitMinutes * 60;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTs) / 1000);
      const left = Math.max(0, totalSec - elapsed);
      setRemainingSeconds(left);

      if (left === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        // Auto-submit on expiration
        executeSubmit();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [loading, isReadOnly, timeLimitMinutes, startedAt, actualStartedAt, executeSubmit]);

  const currentQ = questions[currentQIndex];

  useEffect(() => {
    let active = true;
    if (currentQ?.type === 'LISTENING') {
      if (currentQ.audioUrl) {
        setListeningAudioUrl(currentQ.audioUrl);
      } else if (currentQ.sourceMaterialId) {
        api.getMaterial(currentQ.sourceMaterialId)
          .then(async (mat) => {
            const audioFile = mat?.files?.find(
              (f: any) =>
                f.mimeType?.startsWith('audio/') ||
                /\.(mp3|wav|ogg|m4a|webm)$/i.test(f.fileName || '')
            );
            if (audioFile) {
              const res = await api.getMaterialFileDownloadUrl(mat.id, audioFile.id);
              if (active && res?.url) setListeningAudioUrl(res.url);
            } else if (active) {
              setListeningAudioUrl(null);
            }
          })
          .catch(() => {
            if (active) setListeningAudioUrl(null);
          });
      } else {
        setListeningAudioUrl(null);
      }
    } else {
      setListeningAudioUrl(null);
    }
    return () => {
      active = false;
    };
  }, [currentQ]);

  // Answer Saving
  const handleSaveAnswer = async (qId: string, val: any) => {
    if (isReadOnly) return;
    const updated = { ...answers, [qId]: val };
    setAnswers(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`acorn_draft_${submissionId}`, JSON.stringify(updated));
      } catch {}
    }
    setAutosaveStatus('Saving...');
    try {
      await api.autosave(submissionId, {
        questionId: qId,
        responsePayload: val,
      });
      setAutosaveStatus('Answers autosaved');
    } catch {
      setAutosaveStatus('Saved locally');
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert('Microphone access was denied or is unavailable: ' + (err.message || 'Error'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleSaveAudioResponse = async () => {
    if (!audioBlob || !currentQ) return;
    setUploadingAudio(true);
    try {
      const result = await api.uploadSubmissionAudio(submissionId, currentQ.id, audioBlob);
      const payload = {
        type: 'AUDIO',
        audioUrl: result.audioUrl,
        fileKey: result.fileKey,
        uploadedAt: new Date().toISOString(),
      };
      setAnswers((prev) => ({ ...prev, [currentQ.id]: payload }));
      setAutosaveStatus('Audio response saved');
    } catch (err: any) {
      alert('Failed to upload audio: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentQ) return;
    setUploadingAudio(true);
    try {
      const result = await api.uploadSubmissionAudio(submissionId, currentQ.id, file);
      const payload = {
        type: 'AUDIO',
        audioUrl: result.audioUrl,
        fileKey: result.fileKey,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
      };
      setAnswers((prev) => ({ ...prev, [currentQ.id]: payload }));
      setAudioUrl(result.audioUrl);
      setAutosaveStatus('Audio file uploaded and saved');
    } catch (err: any) {
      alert('Audio file upload failed: ' + err.message);
    } finally {
      setUploadingAudio(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F6FC]/70 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-[#082051] mb-1">Loading Assessment Checkpoint</p>
          <p className="text-xs text-[#656C79]">Retrieving questions and autosaved responses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F6FC]/70 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <ErrorState
            title="Unable to load assessment"
            message={error}
            onRetry={loadSubmission}
          />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F3F6FC]/70 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <EmptyState
            title="No questions in assessment"
            description="This assessment does not contain any questions to complete."
            action={
              <a href="/student/assessments">
                <Button variant="primary" size="sm">
                  Back to Assessments
                </Button>
              </a>
            }
          />
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  // Timer format
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC]/70 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a
            href="/student/assessments"
            className="text-xs text-[#656C79] hover:text-[#082051] flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Assessments
          </a>
          <span className="text-gray-300">|</span>
          <h1 className="text-sm font-bold text-[#082051] truncate max-w-md">{title}</h1>
          {assessmentInstructions && (
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="text-xs text-[#0967F7] flex items-center gap-1 hover:underline ml-2"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Instructions
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-[#082051]">
          {/* Countdown timer */}
          {remainingSeconds !== null && !isReadOnly && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${
                remainingSeconds <= 60
                  ? 'bg-red-100 text-red-700 animate-pulse'
                  : remainingSeconds <= 300
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-50 text-[#0967F7]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Time remaining: {formatTime(remainingSeconds)}</span>
            </div>
          )}

          <div>
            {isReadOnly ? (
              <Badge variant={submissionStatus === 'EVALUATED' ? 'success' : 'default'}>
                {submissionStatus === 'EVALUATED' ? 'Evaluated' : 'Awaiting Review'}
              </Badge>
            ) : (
              <span className="flex items-center gap-1 text-[#0967F7]">
                <Clock className="w-4 h-4" /> Active Checkpoint
              </span>
            )}
          </div>
        </div>
      </header>

      {submitError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Review Mode Banner */}
      {isReadOnly && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-3.5 text-xs text-[#082051] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  {submissionStatus === 'EVALUATED'
                    ? 'Detailed Assessment Evaluation'
                    : 'Submitted Checkpoint'}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Read-only result
                </span>
              </div>
              <p className="text-[11px] text-[#656C79] mt-0.5">
                This submission is read-only.{' '}
                {submissionStatus === 'EVALUATED'
                  ? 'Inspect question scores, correct answers, teacher remarks and rubric evaluation below.'
                  : 'Your answers have been saved and sent for evaluation. Teacher evaluation in progress.'}
              </p>
              {submittedAt && (
                <p className="text-[10px] text-[#5969AB] mt-0.5">
                  Submitted: {new Date(submittedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {assessmentLevel && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-xs text-center shrink-0">
                <span className="text-[10px] text-[#656C79] block">CEFR Band</span>
                <span className="text-xs font-extrabold text-[#082051]">{assessmentLevel}</span>
              </div>
            )}
            {overallScore != null && (
              <div className="bg-white px-3.5 py-1.5 rounded-xl border border-blue-200 shadow-xs flex items-center gap-2 shrink-0">
                <span className="text-xs text-[#656C79]">Overall Score:</span>
                <span className="text-base font-extrabold text-[#0967F7]">{overallScore}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-[#082051]">
          Question {currentQIndex + 1} of {questions.length}
        </span>
        <div className="w-48 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#0967F7] h-full rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[#656C79]">{progressPercent}% complete</span>
      </div>

      {/* Main Split View */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Passage & Context (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs max-h-[620px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
              Reading Passage
            </span>
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-1.5 py-0.5 rounded ${
                  fontSize === 'normal' ? 'bg-blue-100 font-bold' : ''
                }`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-1.5 py-0.5 rounded text-sm ${
                  fontSize === 'large' ? 'bg-blue-100 font-bold' : ''
                }`}
              >
                A+
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-[#082051] mb-3">{title}</h3>

          {/* Audio Player for Listening questions if present */}
          {currentQ?.type === 'LISTENING' && (
            <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0967F7]">
                <Volume2 className="w-4 h-4" />
                <span>Listening Audio Track</span>
              </div>
              <p className="text-[11px] text-[#656C79]">
                Listen to the audio track carefully before answering the question.
              </p>
              {listeningAudioUrl ? (
                <audio controls className="w-full h-8 mt-1" key={listeningAudioUrl}>
                  <source src={listeningAudioUrl} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <p className="text-xs text-[#656C79] italic mt-1">
                  {currentQ?.sourceMaterialId
                    ? 'Loading authorized listening audio track...'
                    : 'No audio track file attached to this listening prompt.'}
                </p>
              )}
            </div>
          )}

          <div
            className={`space-y-4 text-[#082051] leading-relaxed ${
              fontSize === 'large' ? 'text-sm' : 'text-xs'
            }`}
          >
            {customPassage ? (
              <p className="whitespace-pre-line">{customPassage}</p>
            ) : (
              <p className="text-xs text-[#656C79] italic">
                No external passage text attached. Focus on the question prompt.
              </p>
            )}
          </div>
        </div>

        {/* Middle Column: Question, Response & Evaluation (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#0967F7]">
              Question {currentQIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="primary">{currentQ?.type || 'MCQ'}</Badge>
              {isReadOnly && currentQ?.isCorrect !== undefined && (
                <Badge
                  variant={
                    currentQ.isCorrect === true
                      ? 'success'
                      : currentQ.isCorrect === false
                      ? 'danger'
                      : 'default'
                  }
                >
                  {currentQ.isCorrect === true
                    ? `✓ Correct (${currentQ.rawScore ?? 1} pts)`
                    : currentQ.isCorrect === false
                    ? '✗ Incorrect (0 pts)'
                    : `Evaluated (${currentQ.rawScore ?? 0} pts)`}
                </Badge>
              )}
            </div>
          </div>

          <h2 className="text-base font-bold text-[#082051] leading-snug">
            {currentQ?.prompt}
          </h2>

          {/* Question Body by Type */}
          <div className="space-y-3 pt-2">
            {/* 1. MCQ TYPE */}
            {currentQ?.type === 'MCQ' && currentQ.options && currentQ.options.length > 0 ? (
              <div className="space-y-2">
                {currentQ.options.map((opt: string, idx: number) => {
                  const studentAns = answers[currentQ.id];
                  const isSelected = studentAns === opt;
                  const isCorrectAnswer =
                    submissionStatus === 'EVALUATED' && currentQ.correctAnswer === opt;
                  const isWrongChoice =
                    submissionStatus === 'EVALUATED' && isSelected && currentQ.correctAnswer !== opt;

                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSaveAnswer(currentQ.id, opt)}
                      disabled={isReadOnly}
                      aria-disabled={isReadOnly}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between gap-3 ${
                        isCorrectAnswer
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                          : isWrongChoice
                          ? 'bg-red-50 border-red-400 text-red-900 shadow-xs'
                          : isSelected
                          ? 'bg-blue-50/80 border-[#0967F7] text-[#082051] shadow-xs'
                          : 'bg-white border-gray-200 text-[#082051] hover:bg-gray-50'
                      } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isCorrectAnswer
                              ? 'border-emerald-600 bg-emerald-600'
                              : isWrongChoice
                              ? 'border-red-500 bg-red-500'
                              : isSelected
                              ? 'border-[#0967F7] bg-[#0967F7]'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span aria-disabled={isReadOnly} {...(isReadOnly ? ({ disabled: true } as any) : {})}>{opt}</span>
                      </div>

                      {isCorrectAnswer && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Correct answer
                        </span>
                      )}
                      {isWrongChoice && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                          Your choice
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : currentQ?.type === 'SPEAKING' ? (
              /* 2. SPEAKING TYPE */
              <div className="space-y-4">
                <div className="bg-[#F3F6FC] rounded-2xl p-5 border border-blue-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#082051] flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-[#0967F7]" /> Speaking Response
                    </span>
                    {isRecording && (
                      <span className="text-xs font-mono font-bold text-red-600 animate-pulse flex items-center gap-1">
                        ● Recording {recordingTime}s
                      </span>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-3">
                      {!isRecording ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={startRecording}
                          icon={<Mic className="w-3.5 h-3.5" />}
                        >
                          Start Recording
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={stopRecording}
                          icon={<Square className="w-3.5 h-3.5" />}
                        >
                          Stop Recording
                        </Button>
                      )}

                      {audioBlob && !isRecording && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveAudioResponse}
                          loading={uploadingAudio}
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Save Recording
                        </Button>
                      )}

                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleAudioFileUpload}
                          disabled={isReadOnly || uploadingAudio}
                        />
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-[#656C79] hover:bg-gray-100">
                          <FileAudio className="w-3.5 h-3.5" /> Upload audio file
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Audio preview playback */}
                  {(audioUrl || answers[currentQ?.id]?.audioUrl) && (
                    <div className="pt-2 border-t border-gray-200/60">
                      <p className="text-[11px] font-semibold text-[#656C79] mb-1">
                        Recorded Voice Response:
                      </p>
                      <audio
                        controls
                        src={audioUrl || answers[currentQ?.id]?.audioUrl}
                        className="w-full h-8"
                      />
                    </div>
                  )}
                </div>

                {/* Optional transcript or notes */}
                <textarea
                  value={
                    typeof answers[currentQ?.id] === 'string'
                      ? answers[currentQ.id]
                      : answers[currentQ?.id]?.notes || ''
                  }
                  onChange={(e) =>
                    handleSaveAnswer(currentQ.id, {
                      ...(typeof answers[currentQ.id] === 'object' ? answers[currentQ.id] : {}),
                      notes: e.target.value,
                    })
                  }
                  readOnly={isReadOnly}
                  placeholder="Optional speaking notes or transcript..."
                  rows={3}
                  className="w-full p-3 text-xs text-[#082051] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none"
                />
              </div>
            ) : currentQ?.type === 'SHORT_ANSWER' ? (
              /* 3. SHORT ANSWER TYPE */
              <div className="space-y-1.5">
                <textarea
                  value={
                    typeof answers[currentQ?.id] === 'string'
                      ? answers[currentQ.id]
                      : answers[currentQ?.id]?.text || ''
                  }
                  onChange={(e) => handleSaveAnswer(currentQ.id, e.target.value)}
                  readOnly={isReadOnly}
                  placeholder="Type your concise short answer..."
                  rows={4}
                  className="w-full p-3.5 text-xs text-[#082051] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none leading-relaxed resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-[#656C79]">
                  <span>Concise short answer response</span>
                  <span className="font-mono">
                    {(typeof answers[currentQ?.id] === 'string' ? answers[currentQ.id] : answers[currentQ?.id]?.text || '').length} characters
                  </span>
                </div>
              </div>
            ) : (
              /* 4. WRITING TASK TYPE */
              <div className="space-y-1.5">
                <textarea
                  value={
                    typeof answers[currentQ?.id] === 'string'
                      ? answers[currentQ.id]
                      : answers[currentQ?.id]?.text || ''
                  }
                  onChange={(e) => handleSaveAnswer(currentQ.id, e.target.value)}
                  readOnly={isReadOnly}
                  placeholder="Compose your structured multi-paragraph essay or response here..."
                  rows={9}
                  className="w-full p-3.5 text-xs text-[#082051] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none leading-relaxed resize-y font-serif text-[13px]"
                />
                <div className="flex justify-between items-center text-[11px] text-[#656C79]">
                  <span>Formatted multi-paragraph composition</span>
                  <span className="font-mono font-semibold">
                    {(() => {
                      const txt = (typeof answers[currentQ?.id] === 'string' ? answers[currentQ.id] : answers[currentQ?.id]?.text || '').trim();
                      return txt ? txt.split(/\s+/).filter(Boolean).length : 0;
                    })()} words
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Question Review for Evaluated Submissions */}
          {isReadOnly && (
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              {currentQ?.teacherFeedback && (
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Teacher Feedback on Question:
                  </div>
                  <p className="leading-relaxed italic">{currentQ.teacherFeedback}</p>
                </div>
              )}

              {currentQ?.rubricScores && Object.keys(currentQ.rubricScores).length > 0 && (
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-xs space-y-1.5">
                  <span className="font-bold text-[#082051]">Rubric Score Breakdown:</span>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {Object.entries(currentQ.rubricScores).map(([criteria, score]: any) => (
                      <div
                        key={criteria}
                        className="bg-white p-2 rounded-lg border border-gray-100 flex justify-between"
                      >
                        <span className="text-[#656C79] capitalize">{criteria}</span>
                        <span className="font-bold text-[#0967F7]">{score} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-[11px] text-[#5969AB]">
            {isReadOnly
              ? '📌 Your responses are preserved exactly as submitted for academic evidence.'
              : '💡 Answers are autosaved as you complete each question.'}
          </div>
        </div>

        {/* Right Column: Question Navigator (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#082051] uppercase tracking-wider">
            Questions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {questions.map((q: any, idx: number) => {
              const isCurrent = currentQIndex === idx;
              const isAnswered = !!answers[q.id];

              let statusColor = 'bg-[#F3F6FC] text-[#656C79] border-gray-100 hover:bg-gray-100';
              if (isReadOnly && q.isCorrect === true) {
                statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
              } else if (isReadOnly && q.isCorrect === false) {
                statusColor = 'bg-red-50 text-red-800 border-red-300';
              } else if (isCurrent) {
                statusColor = 'bg-[#0967F7] text-white border-[#0967F7]';
              } else if (isAnswered) {
                statusColor = 'bg-blue-50 text-[#0967F7] border-blue-200';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`h-10 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1 ${statusColor} ${
                    isCurrent ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isReadOnly && q.isCorrect === true && (
                    <Check className="w-3 h-3 text-emerald-600" />
                  )}
                  {isReadOnly && q.isCorrect === false && (
                    <X className="w-3 h-3 text-red-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#656C79] space-y-1.5 pt-2 border-t border-gray-100">
            {isReadOnly ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Incorrect
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0967F7]" /> Current
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Answered
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="h-16 bg-white border-t border-gray-200/80 px-6 flex items-center justify-between sticky bottom-0 z-30">
        <div className="flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className={autosaveStatus === 'Saved locally' ? 'text-amber-700 font-semibold' : 'text-emerald-700'}>
            {isReadOnly ? 'Submission finalized' : autosaveStatus}
          </span>
          {!isReadOnly && autosaveStatus === 'Saved locally' && (
            <button
              onClick={retrySync}
              className="text-[#0967F7] font-bold underline hover:text-blue-800 text-xs ml-1"
            >
              [Retry Sync]
            </button>
          )}
        </div>

        {isReadOnly ? (
          <a href="/student/assessments">
            <Button variant="outline" size="md">
              Back to assessments
            </Button>
          </a>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex(currentQIndex - 1)}
            >
              ‹ Previous
            </Button>

            {currentQIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentQIndex(currentQIndex + 1)}
              >
                Next ›
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                loading={submitting}
                onClick={() => setShowConfirmModal(true)}
                icon={<Send className="w-4 h-4" />}
              >
                Submit assessment
              </Button>
            )}
          </div>
        )}
      </footer>

      {/* Modal: Confirm Submit */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[#082051]/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#082051]">Ready to submit your assessment?</h3>
            <p className="text-xs text-[#656C79]">
              Once submitted, your answers will be recorded into your learning profile and evaluated.
            </p>

            <div className="bg-[#F3F6FC] rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between font-semibold text-[#082051]">
                <span>Answered questions:</span>
                <span className="text-[#0967F7]">
                  {answeredCount} / {questions.length}
                </span>
              </div>
              {unansweredCount > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    You have <strong>{unansweredCount}</strong> unanswered question(s). You can still
                    submit, but points may be lost.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                Keep Working
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={submitting}
                onClick={executeSubmit}
                icon={<Send className="w-4 h-4" />}
              >
                Yes, Submit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Instructions */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-[#082051]/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#082051]">Assessment Instructions</h3>
            <div className="bg-[#F3F6FC] rounded-2xl p-4 text-xs text-[#082051] whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
              {assessmentInstructions || 'No specific instructions provided for this checkpoint.'}
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowInstructionsModal(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
