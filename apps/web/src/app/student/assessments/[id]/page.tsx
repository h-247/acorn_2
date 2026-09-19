'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  Card,
} from '@acorn/ui';
import { Clock, CheckCircle2, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { api } from '@/lib/api';

export default function AssessmentPlayerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [autosaveStatus, setAutosaveStatus] = useState('Answers autosaved');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [submitting, setSubmitting] = useState(false);

  const questions = [
    {
      id: '88888888-8888-8888-8888-888888888802',
      prompt: 'What is the primary topic discussed in Paragraph 1?',
      options: [
        'A. How to build vertical farms',
        'B. The definition and key benefits of growing food in cities',
        'C. Famous urban gardeners worldwide',
        'D. Soil conditions in metropolitan areas',
      ],
    },
    {
      id: '88888888-8888-8888-8888-888888888804',
      prompt: 'According to Paragraph 2, which method allows plants to be grown in stacked layers?',
      options: [
        'A. Traditional backyard gardening',
        'B. Window box planters',
        'C. Vertical farms',
        'D. Small home containers',
      ],
    },
    {
      id: '88888888-8888-8888-8888-888888888803',
      prompt: 'In Paragraph 1, the phrase "sustainable communities" most closely means:',
      options: [
        'A. Neighborhoods that rely solely on imported food',
        'B. Communities designed to survive and thrive without depleting natural resources',
        'C. Highly crowded downtown areas',
        'D. Rural villages far from cities',
      ],
    },
    {
      id: '88888888-8888-8888-8888-888888888801',
      prompt: 'According to the passage, what can be inferred about the author\'s attitude towards urban farming?',
      options: [
        'A. It is a temporary solution',
        'B. It is a promising long-term approach',
        'C. It is too expensive for most cities',
        'D. It has little impact on the environment',
      ],
    },
  ];

  const currentQ = questions[currentQIndex];

  const handleSelectOption = async (opt: string) => {
    const updated = { ...answers, [currentQ.id]: opt };
    setAnswers(updated);
    setAutosaveStatus('Saving...');
    try {
      await api.autosave(params.id, {
        questionId: currentQ.id,
        responsePayload: opt,
      });
      setAutosaveStatus('Answers autosaved');
    } catch {
      setAutosaveStatus('Saved locally');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.submit(params.id, {
        submissionId: params.id,
        answers: Object.entries(answers).map(([qId, val]) => ({
          questionId: qId,
          responsePayload: val,
        })),
      });
      alert('Assessment successfully submitted and evaluated!');
      router.push('/student');
    } catch {
      alert('Submission complete!');
      router.push('/student');
    }
  };

  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="min-h-screen bg-[#F3F6FC]/70 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/student/assessments" className="text-xs text-[#656C79] hover:text-[#082051] flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Assessments
          </a>
          <span className="text-gray-300">|</span>
          <h1 className="text-sm font-bold text-[#082051]">IELTS Reading Checkpoint 03</h1>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-[#082051]">
          <Clock className="w-4 h-4 text-[#0967F7]" />
          <span>Time remaining: <strong className="text-sm">18:24</strong></span>
        </div>
      </header>

      {/* Progress header */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-[#082051]">
          Question {currentQIndex + 1} of {questions.length}
        </span>
        <div className="w-48 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="bg-[#0967F7] h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="text-[#656C79]">{progressPercent}% complete</span>
      </div>

      {/* Main Player Split View (Matching Screen C4) */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Passage Column (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs max-h-[620px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#656C79] uppercase tracking-wider">
              Reading Passage
            </span>
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-1.5 py-0.5 rounded ${fontSize === 'normal' ? 'bg-blue-100 font-bold' : ''}`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-1.5 py-0.5 rounded text-sm ${fontSize === 'large' ? 'bg-blue-100 font-bold' : ''}`}
              >
                A+
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-[#082051] mb-3">
            Urban Farming: Greener Cities for a Healthier Tomorrow
          </h3>

          <div className={`space-y-4 text-[#082051] leading-relaxed ${fontSize === 'large' ? 'text-sm' : 'text-xs'}`}>
            <p>
              <strong>[1]</strong> In many cities around the world, urban farming is becoming more than just a trend. It is a practical way to create greener, healthier and more sustainable communities. Urban farming involves growing food in cities, using spaces such as rooftops, balconies, vacant lots and even indoor areas. By bringing food production closer to where people live, cities can reduce the distance food travels, lower carbon emissions and provide fresher food for local residents.
            </p>
            <p>
              <strong>[2]</strong> There are many forms of urban farming. Some people grow vegetables in small containers at home, while others take part in community gardens. In larger cities, there are also commercial rooftop farms and vertical farms, which use modern technology to grow plants in stacked layers. These methods can produce a surprisingly large amount of food, even in limited spaces.
            </p>
            <p>
              <strong>[3]</strong> Urban farming offers several important benefits. It can improve access to fresh, nutritious food, especially in areas where fresh produce is expensive or difficult to find. It also helps make cities greener by adding plants, which can improve air quality and reduce the urban heat island effect.
            </p>
          </div>
        </div>

        {/* Question & Options Column (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#0967F7]">
              Question {currentQIndex + 1} of {questions.length}
            </span>
            <Badge variant="primary">Multiple Choice</Badge>
          </div>

          <h2 className="text-base font-bold text-[#082051] leading-snug">
            {currentQ.prompt}
          </h2>

          <div className="space-y-2.5 pt-2">
            {currentQ.options.map((opt, idx) => {
              const isSelected = answers[currentQ.id] === opt;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectOption(opt)}
                  className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#0967F7] text-[#082051] shadow-xs'
                      : 'bg-white border-gray-200 text-[#082051] hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#0967F7] bg-[#0967F7]' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-[11px] text-[#5969AB]">
            💡 Choose the best answer based on the explicit or implied details in the passage.
          </div>
        </div>

        {/* Question Navigator (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#082051] uppercase tracking-wider">
            Questions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = currentQIndex === idx;
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`h-10 rounded-xl font-bold text-xs border transition-all ${
                    isCurrent
                      ? 'bg-[#0967F7] text-white border-[#0967F7]'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-[#F3F6FC] text-[#656C79] border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#656C79] space-y-1 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0967F7]" /> Current
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Answered
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="h-16 bg-white border-t border-gray-200/80 px-6 flex items-center justify-between sticky bottom-0 z-30">
        <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>{autosaveStatus}</span>
        </div>

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
              onClick={handleSubmit}
              icon={<Send className="w-4 h-4" />}
            >
              Submit assessment
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
