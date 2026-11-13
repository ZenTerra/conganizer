import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { setSetting } from '../../db/repo';
import { DEFAULT_CHECKLIST_TEMPLATE, DEFAULT_PACK_TEMPLATE } from '../../db/templates';
import type { ChecklistSection, ChecklistTemplateItem, PackTemplateItem } from '../../db/types';
import { InlineAdd } from '../../ui/common';

/** Verschiebt ein Element innerhalb seiner Gruppe (tauscht mit dem Nachbarn derselben Gruppe). */
export function moveInGroup<T>(list: T[], index: number, dir: -1 | 1, group: (t: T) => string): T[] {
  const g = group(list[index]);
  let j = index + dir;
  while (j >= 0 && j < list.length && group(list[j]) !== g) j += dir;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}

function Row({
  label,
  onLabel,
  onUp,
  onDown,
  onDelete,
  badge,
}: {
  label: string;
  onLabel: (v: string) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  badge?: string;
}) {
  return (
    <div className="item-row" style={{ padding: '4px 0' }}>
      <input className="input" style={{ flex: 1, minWidth: 0, minHeight: 38 }} value={label} onChange={(e) => onLabel(e.target.value)} />
      {badge && <span className="tag-auto">{badge}</span>}
      <button className="btn ghost icon small" aria-label="Nach oben" onClick={onUp}>
        <ArrowUp size={15} />
      </button>
      <button className="btn ghost icon small" aria-label="Nach unten" onClick={onDown}>
        <ArrowDown size={15} />
      </button>
      <button className="btn ghost icon small" aria-label="Löschen" onClick={onDelete}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function SaveBar({ dirty, onSave, onReset }: { dirty: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="row">
      <button className="btn primary small" disabled={!dirty} onClick={onSave}>
        Vorlage speichern
      </button>
      <span className="spacer" />
      <button className="btn ghost small" onClick={onReset}>
        Standard wiederherstellen
      </button>
    </div>
  );
}

export function PackTemplateEditor({ initial, onSaved }: { initial: PackTemplateItem[]; onSaved: () => void }) {
  const [list, setList] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [newCat, setNewCat] = useState('');
  const update = (l: PackTemplateItem[]) => {
    setList(l);
    setDirty(true);
  };
  const categories = [...new Set(list.map((i) => i.category))];
  const byCat = (t: PackTemplateItem) => t.category;

  return (
    <section className="card">
      <h2>Vorlage Packliste</h2>
      <p className="muted small" style={{ margin: 0 }}>Gilt für neu angelegte Cons.</p>
      {categories.map((cat) => (
        <div key={cat} className="stack" style={{ gap: 4 }}>
          <h3 className="section-title">{cat}</h3>
          {list.map((item, i) =>
            item.category !== cat ? null : (
              <Row
                key={i}
                label={item.label}
                onLabel={(v) => update(list.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                onUp={() => update(moveInGroup(list, i, -1, byCat))}
                onDown={() => update(moveInGroup(list, i, 1, byCat))}
                onDelete={() => update(list.filter((_, j) => j !== i))}
              />
            ),
          )}
          <InlineAdd placeholder={`Punkt in „${cat}“ …`} onAdd={(t) => update([...list, { category: cat, label: t }])} />
        </div>
      ))}
      <div className="stack" style={{ gap: 6 }}>
        <h3 className="section-title">Neue Kategorie</h3>
        <input className="input" value={newCat} placeholder="Name der Kategorie" onChange={(e) => setNewCat(e.target.value)} />
        <InlineAdd
          placeholder="Erster Punkt …"
          onAdd={(t) => {
            if (!newCat.trim()) return;
            update([...list, { category: newCat.trim(), label: t }]);
            setNewCat('');
          }}
        />
      </div>
      <SaveBar
        dirty={dirty}
        onSave={async () => {
          await setSetting('packTemplate', list.filter((i) => i.label.trim()));
          setDirty(false);
          onSaved();
        }}
        onReset={() => update(DEFAULT_PACK_TEMPLATE)}
      />
    </section>
  );
}

const SECTION_LABEL: Record<ChecklistSection, string> = {
  vor: 'Vor der Con',
  tag: 'Jeden Con-Tag',
  nach: 'Nach der Con',
};

export function ChecklistTemplateEditor({ initial, onSaved }: { initial: ChecklistTemplateItem[]; onSaved: () => void }) {
  const [list, setList] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const update = (l: ChecklistTemplateItem[]) => {
    setList(l);
    setDirty(true);
  };
  const bySection = (t: ChecklistTemplateItem) => t.section;

  return (
    <section className="card">
      <h2>Vorlage Checkliste</h2>
      <p className="muted small" style={{ margin: 0 }}>
        „Vor“ und „Nach“ gelten für neue Cons, „Jeden Con-Tag“ für Tage, die noch keine Punkte haben.
      </p>
      {(Object.keys(SECTION_LABEL) as ChecklistSection[]).map((section) => (
        <div key={section} className="stack" style={{ gap: 4 }}>
          <h3 className="section-title">{SECTION_LABEL[section]}</h3>
          {list.map((item, i) =>
            item.section !== section ? null : (
              <Row
                key={i}
                label={item.label}
                badge={item.auto ? 'automatisch' : undefined}
                onLabel={(v) => update(list.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                onUp={() => update(moveInGroup(list, i, -1, bySection))}
                onDown={() => update(moveInGroup(list, i, 1, bySection))}
                onDelete={() => update(list.filter((_, j) => j !== i))}
              />
            ),
          )}
          <InlineAdd placeholder="Punkt hinzufügen …" onAdd={(t) => update([...list, { section, label: t }])} />
        </div>
      ))}
      <SaveBar
        dirty={dirty}
        onSave={async () => {
          await setSetting('checklistTemplate', list.filter((i) => i.label.trim()));
          setDirty(false);
          onSaved();
        }}
        onReset={() => update(DEFAULT_CHECKLIST_TEMPLATE)}
      />
    </section>
  );
}
