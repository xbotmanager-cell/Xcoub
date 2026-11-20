import React from 'react';
import { BrainCircuit } from 'lucide-react';
import type { AIAnalysisResult } from '../engine/types.ts';

interface AIThinkingPanelProps {
  analysis: AIAnalysisResult | null;
  thinking: boolean;
  difficultyLabel: string;
  visible: boolean;
  onToggleVisible: () => void;
}

export const AIThinkingPanel: React.FC<AIThinkingPanelProps> = ({
  analysis,
  thinking,
  difficultyLabel,
  visible,
  onToggleVisible,
}) => {
  const evalCp = analysis?.whiteEvalCp ?? 0;
  // Convert centipawns into 0..100% bar for White advantage
  const clamped = Math.max(-800, Math.min(800, evalCp));
  const whitePct = Math.round(50 + (clamped / 800) * 45);
  const formattedEval =
    Math.abs(evalCp) >= 100000
      ? evalCp > 0
        ? 'White Win'
        : 'Black Win'
      : `${evalCp >= 0 ? '+' : ''}${(evalCp / 100).toFixed(2)}`;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Engine Analysis
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">· {difficultyLabel}</span>
        </div>
        <button
          type="button"
          onClick={onToggleVisible}
          className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
        >
          {visible ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Evaluation Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span>White</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {thinking ? 'Calculating...' : formattedEval}
          </span>
          <span>Black</span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden bg-slate-800 flex">
          <div
            className="h-full bg-amber-100 transition-all duration-300"
            style={{ width: `${whitePct}%` }}
          />
        </div>
      </div>

      {visible && (
        <div className="space-y-3 pt-1 text-xs">
          {analysis ? (
            <>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Depth</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {analysis.depthReached} ply
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Positions</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {analysis.nodesAnalyzed.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Time</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {analysis.elapsedMs} ms
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1">Principal Variation</div>
                <div className="font-mono text-slate-800 dark:text-slate-200 break-words">
                  {analysis.principalVariation.join(' → ') || '—'}
                </div>
              </div>

              {analysis.candidateMoves.length > 0 && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Top Candidates</div>
                  <div className="flex flex-wrap gap-3 font-mono tabular-nums">
                    {analysis.candidateMoves.map((c) => (
                      <span key={c.notation} className="text-slate-700 dark:text-slate-300">
                        {c.notation}{' '}
                        <span className="text-slate-500">
                          ({c.scoreCp >= 0 ? '+' : ''}
                          {(c.scoreCp / 100).toFixed(1)})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {analysis.explanation}
              </p>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Make a move or request analysis to inspect depth, candidate lines, and tactical reasoning.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
