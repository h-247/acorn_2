import React from 'react';

export interface ProvenanceNode {
  id: string;
  title: string;
  version: number;
  date: string;
  author: string;
  isCurrent?: boolean;
}

export interface ProvenanceLineageProps {
  nodes: ProvenanceNode[];
}

export const ProvenanceLineage: React.FC<ProvenanceLineageProps> = ({ nodes }) => {
  return (
    <div className="flex flex-col gap-3 py-2">
      {nodes.map((node, idx) => (
        <div key={node.id} className="relative flex items-start gap-3">
          {idx < nodes.length - 1 && (
            <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-gray-200" />
          )}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 ${
              node.isCurrent
                ? 'bg-[#0967F7] ring-4 ring-blue-100 text-white text-xs'
                : 'bg-white border-2 border-gray-300'
            }`}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#082051]">{node.title}</span>
              <span className="text-xs bg-gray-100 text-[#5969AB] px-1.5 py-0.5 rounded font-mono">
                v{node.version}
              </span>
              {node.isCurrent && (
                <span className="text-[10px] bg-blue-50 text-[#0967F7] px-1.5 py-0.5 rounded font-medium">
                  Current
                </span>
              )}
            </div>
            <div className="text-xs text-[#656C79] mt-0.5">
              by {node.author} • {node.date}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
