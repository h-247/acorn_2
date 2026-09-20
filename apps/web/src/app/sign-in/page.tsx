'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@acorn/ui';
import { ArrowRight, AlertCircle, BookOpen, GraduationCap, Award } from 'lucide-react';
import { api } from '@/lib/api';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.login(email.trim(), password);
      if (res.user?.role === 'STUDENT') {
        router.push('/student');
      } else if (res.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC]/60 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left Side: Center Story & Mission */}
        <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-white p-8 md:p-12 flex flex-col justify-between border-r border-gray-100">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#0967F7] flex items-center justify-center text-white text-xl shadow-xs">
                🌰
              </div>
              <div>
                <span className="font-bold text-lg text-[#082051]">Acorn</span>
                <p className="text-[11px] text-[#656C79]">English Language Center</p>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-[#082051] leading-tight mb-2">
              Small steps, <br />
              <span className="text-[#0967F7]">lasting progress.</span>
            </h1>
            <p className="text-xs text-[#656C79] mb-8 leading-relaxed">
              Welcome to the Acorn Learning Portal. Fostering English proficiency through structured coursework, personalized teacher guidance, and targeted practice.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0967F7] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">Comprehensive Curriculum</h4>
                  <p className="text-[11px] text-[#656C79]">
                    IELTS preparation and academic skills aligned to international CEFR standards.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">Personalized Instructor Guidance</h4>
                  <p className="text-[11px] text-[#656C79]">
                    Detailed feedback on reading, writing, and speaking to support individual progress.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">Targeted Practice & Skill Building</h4>
                  <p className="text-[11px] text-[#656C79]">
                    Class assignments, curated study materials, and practical skill checkpoints.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-xs text-[#656C79]">
            Acorn English Language Portal &copy; {new Date().getFullYear()}
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#082051]">Sign In to Acorn</h2>
            <p className="text-xs text-[#656C79] mt-1">
              Enter your center credentials to access your classes, coursework, and assignments.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. taylor@acorn.edu"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
            >
              Sign In <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
