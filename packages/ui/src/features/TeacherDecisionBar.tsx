import React, { useState } from 'react';
import { Button } from '../primitives/Button';;
import { Textarea } from '../primitives/Textarea';;

export interface TeacherDecisionBarProps {
  onDecision: (decision: 'ACCEPT' | 'MODIFY' | 'REJECT', notes?: string) => void;
  isLoading?: boolean;
}

export const TeacherDecisionBar: React.FC<TeacherDecisionBarProps> = ({
  onDecision,
  isLoading = false,
}) => {
  const [selectedDecision, setSelectedDecision] = useState<'ACCEPT' | 'MODIFY' | 'REJECT'>('ACCEPT');
  const [notes, setNotes] = useState('');

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col gap-4">
      <h3 className="text-sm font-bold text-[#082051]">Teacher Decision</h3>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setSelectedDecision('ACCEPT')}
          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
            selectedDecision === 'ACCEPT'
              ? 'bg-[#0967F7] text-white border-[#0967F7]'
              : 'bg-white text-[#082051] border-gray-200 hover:bg-gray-50'
          }`}
        >
          ✓ Accept
        </button>
        <button
          type="button"
          onClick={() => setSelectedDecision('MODIFY')}
          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
            selectedDecision === 'MODIFY'
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-[#082051] border-gray-200 hover:bg-gray-50'
          }`}
        >
          ✎ Modify
        </button>
        <button
          type="button"
          onClick={() => setSelectedDecision('REJECT')}
          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
            selectedDecision === 'REJECT'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-white text-[#082051] border-gray-200 hover:bg-gray-50'
          }`}
        >
          ✕ Reject
        </button>
      </div>

      <Textarea
        placeholder="Add teacher decision notes or adjustments (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="text-xs"
      />

      <Button
        variant="primary"
        size="md"
        loading={isLoading}
        onClick={() => onDecision(selectedDecision, notes)}
        className="w-full"
      >
        Record Decision
      </Button>
    </div>
  );
};
