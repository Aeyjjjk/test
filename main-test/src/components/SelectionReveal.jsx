import { useState } from 'react';

/**
 * Shown right after "Run selection." Lists everyone drawn at once behind a
 * blurred backdrop. Confirm keeps the draw; Cancel undoes it (deletes the
 * just-created selection rows) as if the draw never happened.
 */
export default function SelectionReveal({ picks, onConfirm, onCancel }) {
  const [cancelling, setCancelling] = useState(false);

  if (!picks || picks.length === 0) return null;
  const cycleNumber = picks[0]?.cycle_number;

  async function handleCancel() {
    setCancelling(true);
    await onCancel();
    setCancelling(false);
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-lg p-6 max-h-[85vh] flex flex-col">
        <p className="text-muted text-xs mb-1">Round {cycleNumber}</p>
        <h2 className="font-head font-extrabold text-xl sm:text-2xl text-ink mb-4">
          List of staffs to be tested today
        </h2>

        <div className="space-y-2 overflow-y-auto pr-1 -mr-1">
          {picks.map((p) => (
            <div
              key={p.selection_id}
              className="bg-raised border border-line rounded-md px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-head font-bold text-ink">{p.full_name}</p>
                <p className="text-muted text-xs">{p.department}</p>
              </div>
              <span className="bg-orange-dim text-orange-soft text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                Tag {p.tag_id}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 bg-raised border border-line hover:border-alert disabled:opacity-60 text-ink font-head font-bold rounded-md py-2.5 transition-colors"
          >
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="flex-1 bg-orange hover:bg-orange/90 disabled:opacity-60 text-inkOnOrange font-head font-bold rounded-md py-2.5 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
