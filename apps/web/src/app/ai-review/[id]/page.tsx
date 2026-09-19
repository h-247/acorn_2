'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppShell,
  EntityHeader,
  AICandidateReview,
} from '@acorn/ui';
import { api } from '@/lib/api';

export default function AICandidateDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAICandidate(params.id).then(setCandidate).catch(() => {});
  }, [params.id]);

  const handleApprove = async () => {
    if (!candidate) return;
    setLoading(true);
    try {
      await api.reviewAICandidate(candidate.id, {
        generationId: candidate.id,
        decision: 'APPROVE',
        teacherNotes: 'Approved by teacher for B1 inference practice.',
      });
      alert('AI content approved and added as official material to repository!');
      router.push('/materials');
    } catch (err) {
      alert('Failed to approve candidate');
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!candidate) return;
    setLoading(true);
    try {
      await api.reviewAICandidate(candidate.id, {
        generationId: candidate.id,
        decision: 'REJECT',
        teacherNotes: 'Content did not meet target CEFR criteria.',
      });
      alert('AI candidate rejected.');
      router.push('/ai-review');
    } catch (err) {
      alert('Failed to reject candidate');
      setLoading(false);
    }
  };

  if (!candidate) {
    return (
      <AppShell currentPath="/ai-review">
        <div className="p-8 text-center text-[#656C79]">Loading AI review candidate...</div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/ai-review" roleMode="TEACHER">
      <div className="space-y-6">
        <EntityHeader
          breadcrumbs={[
            { label: 'AI Review', href: '/ai-review' },
            { label: 'Candidate Review' },
          ]}
          title="AI Content Review"
          subtitle="Review and approve AI-assisted English learning content before use."
        />

        <AICandidateReview
          candidate={candidate}
          onApprove={handleApprove}
          onRevise={() => alert('Opening editor to revise candidate text...')}
          onReject={handleReject}
          isLoading={loading}
        />
      </div>
    </AppShell>
  );
}
