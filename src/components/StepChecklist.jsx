import { useState } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import ChecklistBoard from './ChecklistBoard';
import { buildChecklist, checklistSetup, checklistRowPatch, patchChecklistRows, addChecklistRow, removeChecklistRow } from '../utils/checklist';
import { saveChecklistItem, addChecklistTask, deleteChecklistTask, newTaskKey } from '../utils/checklistStore';
import { useProgramChecklist } from '../utils/useProgramChecklist';

// ════════════════════════════════════════════════════════════════════
// Step "Checklist" — the launch checklist of the open program
// ════════════════════════════════════════════════════════════════════
// Its steps follow the setup answers of Configuration; the brand sees the
// same checklist in its client portal and fills it in too.
export default function StepChecklist({ lang, programId, config, referralConfig, author, onGoToSetup, onPrev }) {
  const t = lang === 'fr';
  const { rows, loaded, error, missing, reload, update } = useProgramChecklist(programId);
  const [saveError, setSaveError] = useState('');
  const checklist = buildChecklist(checklistSetup({ config, referralConfig }), rows, lang);
  const me = { type: 'csm', name: author };

  const run = async (local, save) => {
    update(local);
    try {
      await save();
      setSaveError('');
    } catch (err) {
      setSaveError(err.message);
    }
    reload();
  };
  const onPatch = (key, patch) => {
    const row = checklistRowPatch(patch);
    run(rs => patchChecklistRows(rs, key, row, me), () => saveChecklistItem(programId, key, row));
  };
  const onAdd = (phase, label) => {
    const key = newTaskKey();
    run(rs => addChecklistRow(rs, key, label, phase, me), () => addChecklistTask(programId, key, label, phase));
  };
  const onDelete = key => run(rs => removeChecklistRow(rs, key), () => deleteChecklistTask(programId, key));

  return (
    <div className="space-y-3">
      <div>
        <div className="section-subheader">{t ? 'ÉTAPE 9' : 'STEP 9'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Checklist de lancement' : 'Launch checklist'}</h2>
        <p className="text-[15px] text-[#645648] mt-0.5">
          {t ? 'Les étapes du setup, choisies selon la Configuration. La marque suit et complète la même checklist dans son espace client.'
            : 'The setup steps, chosen from the Configuration. The brand follows and fills in the same checklist in its client portal.'}
        </p>
      </div>

      {!programId && <div className="card text-[13px] text-[#8A7D6B]">{t ? 'Le programme s\'enregistre…' : 'Saving the program…'}</div>}
      {missing && (
        <div className="card text-[13px] text-[#8A7D6B] flex items-center gap-2">
          <AlertCircle size={15} /> {t ? 'La checklist sera disponible une fois la base de données mise à jour (migration program_checklist).' : 'The checklist will be available once the database is updated (program_checklist migration).'}
        </div>
      )}
      {(error || saveError) && (
        <div className="text-[12px] text-red-600 flex items-center gap-1.5">
          <AlertCircle size={13} /> {t ? 'Checklist : ' : 'Checklist: '}{saveError || error}
        </div>
      )}
      {programId && loaded && !missing && (
        <ChecklistBoard lang={lang} audience="csm" checklist={checklist}
          onPatch={onPatch} onAdd={onAdd} onDelete={onDelete} onGoToSetup={onGoToSetup} />
      )}

      <div className="flex justify-between pt-6">
        <button onClick={onPrev} className="btn-secondary">
          <ChevronLeft size={16} /> {t ? 'Précédent' : 'Previous'}
        </button>
        <span />
      </div>
    </div>
  );
}
