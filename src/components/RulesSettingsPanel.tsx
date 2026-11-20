import React from 'react';
import {
  DRAFT_MASTER_8X8_RULES,
  ENGLISH_8X8_RULES,
  INTERNATIONAL_10X10_RULES,
  getPresetRules,
} from '../engine/presets.ts';
import type { PromotionMode, RuleConfig, VariantPreset } from '../engine/types.ts';

interface RulesSettingsPanelProps {
  rules: RuleConfig;
  onChange: (next: RuleConfig) => void;
  compact?: boolean;
}

export const RulesSettingsPanel: React.FC<RulesSettingsPanelProps> = ({
  rules,
  onChange,
  compact = false,
}) => {
  const selectPreset = (preset: VariantPreset) => {
    if (preset === 'draft_master_8x8') {
      onChange({ ...DRAFT_MASTER_8X8_RULES });
    } else if (preset === 'english_8x8') {
      onChange({ ...ENGLISH_8X8_RULES });
    } else if (preset === 'international_10x10') {
      onChange({ ...INTERNATIONAL_10X10_RULES });
    } else {
      onChange(
        getPresetRules('custom', {
          boardSize: rules.boardSize,
          startingRows: rules.startingRows,
          firstPlayer: rules.firstPlayer,
          flyingKings: rules.flyingKings,
          menMoveDirection: rules.menMoveDirection,
          menCaptureBackward: rules.menCaptureBackward,
          mandatoryCapture: rules.mandatoryCapture,
          maximumCapture: rules.maximumCapture,
          multipleCaptures: rules.multipleCaptures,
          promotionMode: rules.promotionMode,
        })
      );
    }
  };

  const updateCustom = (patch: Partial<RuleConfig>) => {
    onChange(
      getPresetRules('custom', {
        ...rules,
        ...patch,
      })
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Ruleset Preset
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {rules.preset === 'custom' ? 'Custom Variant' : 'Preset Ruleset'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => selectPreset('draft_master_8x8')}
            className={`px-4 py-3 rounded-lg text-left border transition-colors ${
              rules.preset === 'draft_master_8x8'
                ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold whitespace-nowrap">8×8 Flying Kings (Default)</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              12 pieces · Long-range Flying Kings
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectPreset('english_8x8')}
            className={`px-4 py-3 rounded-lg text-left border transition-colors ${
              rules.preset === 'english_8x8'
                ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold whitespace-nowrap">English 8×8 Classic</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              12 pieces · 1-square Kings
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectPreset('international_10x10')}
            className={`px-4 py-3 rounded-lg text-left border transition-colors ${
              rules.preset === 'international_10x10'
                ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold whitespace-nowrap">International 10×10</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              20 pieces · Flying Kings · Max Capture
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectPreset('custom')}
            className={`px-4 py-3 rounded-lg text-left border transition-colors ${
              rules.preset === 'custom'
                ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-semibold whitespace-nowrap">Custom Rules</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure board & mechanics
            </div>
          </button>
        </div>
      </div>

      {(!compact || rules.preset === 'custom') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {rules.preset === 'custom' ? 'Custom Variant Configuration' : `${rules.name} Specification`}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {rules.preset === 'custom'
                  ? 'Modifying any toggle marks this match as a Custom Variant.'
                  : 'Official presets preserve exact rules. Select Custom Rules to tailor mechanics.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Board Dimensions
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([8, 10] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() =>
                      updateCustom({
                        boardSize: sz,
                        startingRows: sz === 10 ? 4 : 3,
                      })
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                      rules.boardSize === sz
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {sz}×{sz} ({sz === 8 ? '32 sq' : '50 sq'})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Opening Turn
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['black', 'white'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => updateCustom({ firstPlayer: side })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border capitalize transition-colors ${
                      rules.firstPlayer === side
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {side} Moves First
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Starting Rows per Side
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as const).map((rCount) => {
                  const disabled = rules.boardSize === 8 && rCount === 4;
                  return (
                    <button
                      key={rCount}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateCustom({ startingRows: rCount })}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800'
                          : rules.startingRows === rCount
                            ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {rCount} rows ({rCount * (rules.boardSize / 2)})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Promotion During Capture
              </label>
              <select
                value={rules.promotionMode}
                onChange={(e) => updateCustom({ promotionMode: e.target.value as PromotionMode })}
                className="w-full py-2 px-3 rounded-lg text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              >
                <option value="immediate_stop">Promote & Stop Turn</option>
                <option value="end_of_turn_only">Promote Only If Ending on Rank</option>
                <option value="immediate_continue">Promote & Continue Capturing as King</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <RuleToggle
              label="Flying Kings"
              desc="Kings slide & capture across multiple squares"
              checked={rules.flyingKings}
              onToggle={(v) => updateCustom({ flyingKings: v })}
            />
            <RuleToggle
              label="Men Capture Backward"
              desc="Men jump backward as well as forward"
              checked={rules.menCaptureBackward}
              onToggle={(v) => updateCustom({ menCaptureBackward: v })}
            />
            <RuleToggle
              label="Men Move Both Ways"
              desc="Allow men to step backward on quiet moves"
              checked={rules.menMoveDirection === 'both'}
              onToggle={(v) => updateCustom({ menMoveDirection: v ? 'both' : 'forward' })}
            />
            <RuleToggle
              label="Mandatory Capture"
              desc="Players must take available captures"
              checked={rules.mandatoryCapture}
              onToggle={(v) => updateCustom({ mandatoryCapture: v })}
            />
            <RuleToggle
              label="Maximum Capture"
              desc="Must pick sequence capturing most pieces"
              checked={rules.maximumCapture}
              onToggle={(v) => updateCustom({ maximumCapture: v })}
            />
            <RuleToggle
              label="Multiple Captures"
              desc="Chain consecutive jumps in one turn"
              checked={rules.multipleCaptures}
              onToggle={(v) => updateCustom({ multipleCaptures: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function RuleToggle({
  label,
  desc,
  checked,
  onToggle,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={`p-3 rounded-lg border text-left transition-colors ${
        checked
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        <span
          className={`text-[11px] font-mono font-semibold ${
            checked ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
          }`}
        >
          {checked ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{desc}</p>
    </button>
  );
}
