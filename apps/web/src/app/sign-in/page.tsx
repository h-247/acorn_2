'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@acorn/ui';
import { ArrowRight, Lock, Mail, GraduationCap } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('taylor@acorn.edu');
  const [password, setPassword] = useState('password123');

  const handleLogin = (role: 'TEACHER' | 'STUDENT') => {
    if (role === 'TEACHER') {
      router.push('/');
    } else {
      router.push('/student');
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC]/60 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left Side: Brand Story & Mascot */}
        <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-white p-8 md:p-12 flex flex-col justify-between border-r border-gray-100">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#0967F7] flex items-center justify-center text-white text-xl shadow-xs">
                🌰
              </div>
              <div>
                <span className="font-bold text-lg text-[#082051]">Acorn</span>
                <p className="text-[11px] text-[#656C79]">by Agentivium AI</p>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-[#082051] leading-tight mb-2">
              Small steps <br />
              <span className="text-[#0967F7]">big progress.</span>
            </h1>
            <p className="text-xs text-[#656C79] mb-8 leading-relaxed">
              A brighter English learning experience for every learner and teacher.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0967F7] flex items-center justify-center shrink-0">
                  👥
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">For English centers</h4>
                  <p className="text-[11px] text-[#656C79]">Support teachers, engage learners, drive real progress.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  📊
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">Engaging & effective</h4>
                  <p className="text-[11px] text-[#656C79]">Interactive materials, practice and assessments.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  💚
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#082051]">A supportive community</h4>
                  <p className="text-[11px] text-[#656C79]">Because every learner can grow.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-4xl">🐿️</div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#082051]">Welcome to Acorn</h2>
            <p className="text-xs text-[#656C79] mt-1">
              Sign in to continue your English learning journey.
            </p>
          </div>

          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-2"
              onClick={() => handleLogin('TEACHER')}
            >
              Sign in as Teacher <ArrowRight className="w-4 h-4 ml-1" />
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[#656C79]">or quick demo sign-in</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => handleLogin('STUDENT')}
            >
              Sign in as Student (Emma Nguyen) ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
