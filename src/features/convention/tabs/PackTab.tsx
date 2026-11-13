import { useState } from 'react';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { db } from '../../../db/db';
import { useConRecords } from '../../../db/hooks';
import { createRecord, deleteRecord, updateRecord } from '../../../db/repo';
import type { PackItem } from '../../../db/types';
import { InlineAdd, ProgressBar } from '../../../ui/common';
import { useConContext } from '../ConLayout';

export function PackTab() {
  const { con } = useConContext();
  const items = useConRecords(db.packItems, con.id);
  const [editing, setEditing] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  if (!items) return null;

  const sorted = [...items].sort((a, b) => a.order - b.order);
  const categories: string[] = [];
  for (const i of sorted) if (!categories.includes(i.category)) categories.push(i.category);
  const done = items.filter((i) => i.checked).length;
  const nextOrder = () => (items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0);
  const add = (category: string, label: string) =>
    createRecord(db.packItems, { conId: con.id, category, label, checked: false, order: nextOrder() });

  async function resetAll() {
    if (!confirm('Alle Häkchen der Packliste entfernen?')) return;
    for (const i of items!.filter((x) => x.checked)) await updateRecord(db.packItems, i.id, { checked: false });
  }

  const renderRow = (item: PackItem) => (
    <div key={item.id} className={`item-row ${item.checked ? 'done' : ''}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => updateRecord(db.packItems, item.id, { checked: e.target.checked })}
        />
        <span>{item.label}</span>
      </label>
      {editing && (
        <button className="btn ghost icon small" aria-label={`${item.label} löschen`} onClick={() => deleteRecord(db.packItems, item.id)}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );

  return (
    <>
      <section className="card">
        <ProgressBar done={done} total={items.length} label={done === items.length && items.length ? 'Alles eingepackt 🎉' : 'Eingepackt'} />
        <div className="row">
          <button className="btn ghost small" onClick={resetAll} disabled={done === 0}>
            <RotateCcw size={14} /> Zurücksetzen
          </button>
          <span className="spacer" />
          <button className="btn ghost small" onClick={() => setEditing((e) => !e)}>
            <Pencil size={14} /> {editing ? 'Fertig' : 'Bearbeiten'}
          </button>
        </div>
      </section>

      <div className="grid-2">
        {categories.map((cat) => {
          const list = sorted.filter((i) => i.category === cat);
          const catDone = list.filter((i) => i.checked).length;
          return (
            <section key={cat} className="card">
              <div className="card-header">
                <h3>{cat}</h3>
                <span className="small muted">
                  {catDone} / {list.length}
                </span>
              </div>
              <div>
                {list.map(renderRow)}
              </div>
              {editing && <InlineAdd placeholder="Punkt hinzufügen …" onAdd={(t) => add(cat, t)} />}
            </section>
          );
        })}
      </div>

      {(editing || categories.length === 0) && (
        <section className="card">
          <h3>Neue Kategorie</h3>
          <label className="field">
            <span>Name der Kategorie</span>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="z. B. Deko Sommer" />
          </label>
          <InlineAdd
            placeholder="Erster Punkt …"
            onAdd={(t) => {
              if (!newCategory.trim()) return;
              void add(newCategory.trim(), t);
              setNewCategory('');
            }}
          />
        </section>
      )}
    </>
  );
}
