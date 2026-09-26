import React, { useState } from 'react';
import { Button } from '../primitives/Button';;
import { Textarea } from '../primitives/Textarea';;

/** Just enough of a candidate to choose between them. */
export interface DecisionCandidate {
  materialId: string | null;
  title: string | null;
  action: string;
  level?: string | null;
}

export interface TeacherDecisionDetail {
  notes?: string;
  selectedMaterialId?: string | null;
  modifiedActionText?: string | null;
}

export interface TeacherDecisionBarProps {
  onDecision: (
    decision: 'ACCEPT' | 'MODIFY' | 'REJECT',
    detail: TeacherDecisionDetail
  ) => void;
  /** Offered by this recommendation; anything else is refused by the API. */
  candidates?: DecisionCandidate[];
  /** What the engine proposed, so MODIFY starts from it rather than blank. */
  currentActionText?: string;
  isLoading?: boolean;
}

export const TeacherDecisionBar: React.FC<TeacherDecisionBarProps> = ({
  onDecision,
  candidates = [],
  currentActionText = '',
  isLoading = false,
}) => {
  const [selectedDecision, setSelectedDecision] = useState<'ACCEPT' | 'MODIFY' | 'REJECT'>('ACCEPT');
  const [notes, setNotes] = useState('');

  // Only a candidate backed by a material can be selected; a NO_MATCH card
  // stands for the absence of one.
  const selectable = candidates.filter((c) => Boolean(c.materialId));
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [actionText, setActionText] = useState('');

  const effectiveMaterialId = selectedMaterialId || selectable[0]?.materialId || '';
  const rewritten = actionText.trim();

  // The API refuses a MODIFY that changes nothing, so do not offer to send one.
  const modifyIsEmpty =
    selectedDecision === 'MODIFY' &&
    !rewritten &&
    (!selectedMaterialId || selectedMaterialId === selectable[0]?.materialId);

  const decisions: Array<{
    key: 'ACCEPT' | 'MODIFY' | 'REJECT';
    label: string;
    active: string;
  }> = [
    { key: 'ACCEPT', label: '✓ Accept', active: 'bg-[#0967F7] text-white border-[#0967F7]' },
    { key: 'MODIFY', label: '✎ Modify', active: 'bg-amber-500 text-white border-amber-500' },
    { key: 'REJECT', label: '✕ Reject', active: 'bg-red-500 text-white border-red-500' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col gap-4">
      <h3 className="text-sm font-bold text-[#082051]">Teacher Decision</h3>

      <div className="grid grid-cols-3 gap-2">
        {decisions.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setSelectedDecision(d.key)}
            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
              selectedDecision === d.key
                ? d.active
                : 'bg-white text-[#082051] border-gray-200 hover:bg-gray-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {selectedDecision !== 'REJECT' && selectable.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#082051]">Material</span>
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {selectable.map((c) => (
              <label
                key={c.materialId}
                className="flex items-start gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="decision-candidate"
                  className="mt-0.5"
                  checked={effectiveMaterialId === c.materialId}
                  onChange={() => setSelectedMaterialId(c.materialId as string)}
                />
                <span>
                  <span className="font-medium text-[#082051] block">{c.title}</span>
                  <span className="text-[#656C79]">
                    {c.action}
                    {c.level ? ` • ${c.level}` : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {selectedDecision !== 'REJECT' && selectable.length === 0 && (
        <p className="text-xs text-[#656C79] bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          No material in the library fits this recommendation yet. Accepting records the focus;
          the material still has to be written.
        </p>
      )}

      {selectedDecision === 'MODIFY' && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#082051]">Rewrite the action</span>
          <Textarea
            placeholder={currentActionText || 'What should the learner do instead?'}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            rows={2}
            className="text-xs"
          />
          <p className="text-[11px] text-[#656C79]">
            Leave blank only if you are changing the material instead — a modification has to
            change something.
          </p>
        </div>
      )}

      <Textarea
        placeholder="Add teacher decision notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="text-xs"
      />

      <Button
        variant="primary"
        size="md"
        loading={isLoading}
        disabled={modifyIsEmpty}
        onClick={() =>
          onDecision(selectedDecision, {
            notes: notes.trim() || undefined,
            // A rejection is not a choice of material.
            selectedMaterialId:
              selectedDecision === 'REJECT' ? null : effectiveMaterialId || null,
            modifiedActionText: selectedDecision === 'MODIFY' ? rewritten || null : null,
          })
        }
        className="w-full"
      >
        Record Decision
      </Button>
    </div>
  );
};
