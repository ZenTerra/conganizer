import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { db } from '../../../db/db';
import { useConRecords, useSettings } from '../../../db/hooks';
import { createRecord, deleteRecord, ensureDailyChecklist, updateRecord } from '../../../db/repo';
import type { ChecklistItem, ChecklistSection, IsoDate } from '../../../db/types';
import { isAutoDone, isItemDone, type AutoContext } from '../../../domain/checklistAuto';
import { conDays, formatWeekdayDate, todayIso } from '../../../domain/dates';
import { InlineAdd, ProgressBar } from '../../../ui/common';
import { useConContext } from '../ConLayout';

export function ItemList({ items, ctx, editing }: { items: ChecklistItem[]; ctx: AutoContext; editing: boolean }) {
  return (
    <div>
      {items.map((item) => {
        const auto = isAutoDone(item.auto, ctx);
        const done = isItemDone(item, ctx);
        return (
          <div key={item.id} className={`item-row ${done ? 'done' : ''}`}>
            <label className="check">
              <input
                type="checkbox"
                checked={done}
                disabled={auto && !item.checked}
                onChange={(e) => updateRecord(db.checklistItems, item.id, { checked: e.target.checked })}
              />
              <span>{item.label}</span>
            </label>
            {item.auto && <span className="tag-auto" title="Hakt sich aus den Daten automatisch ab">automatisch</span>}
            {editing && (
              <button
                className="btn ghost icon small"
                aria-label={`${item.label} löschen`}
                onClick={() => deleteRecord(db.checklistItems, item.id)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, done, total, children }: { title: string; done: number; total: number; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <ProgressBar done={done} total={total} />
      {children}
    </section>
  );
}

export function ChecklistTab() {
  const { con } = useConContext();
  const settings = useSettings();
  const items = useConRecords(db.checklistItems, con.id);
  const hotels = useConRecords(db.hotels, con.id);
  const packItems = useConRecords(db.packItems, con.id);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (settings) void ensureDailyChecklist(con, settings);
  }, [con, settings]);

  if (!items || !hotels || !packItems) return null;

  const ctx: AutoContext = { con, hotels, packItems };
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const of = (section: ChecklistSection, date?: IsoDate) =>
    sorted.filter((i) => i.section === section && (date === undefined || i.date === date));
  const count = (list: ChecklistItem[]) => list.filter((i) => isItemDone(i, ctx)).length;
  const nextOrder = () => (items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0);
  const add = (section: ChecklistSection, label: string, date?: IsoDate) =>
    createRecord(db.checklistItems, { conId: con.id, section, date, label, checked: false, order: nextOrder() });

  const days = conDays(con.startDate, con.endDate);
  const today = todayIso();
  const vor = of('vor');
  const nach = of('nach');
  const tagAll = sorted.filter((i) => i.section === 'tag' && i.date && days.includes(i.date));

  return (
    <>
      <div className="row">
        <span className="spacer" />
        <button className="btn ghost small" onClick={() => setEditing((e) => !e)}>
          <Pencil size={14} /> {editing ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>

      <Section title="Vor der Con" done={count(vor)} total={vor.length}>
        <ItemList items={vor} ctx={ctx} editing={editing} />
        {editing && <InlineAdd placeholder="Eigener Punkt …" onAdd={(t) => add('vor', t)} />}
      </Section>

      <Section title="Jeden Con-Tag" done={count(tagAll)} total={tagAll.length}>
        {days.map((date, i) => {
          const list = of('tag', date);
          const isToday = date === today;
          return (
            <details key={date} className="day" open={isToday || (days.length === 1)} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <summary>
                <ChevronRight size={18} className="chev" />
                <span style={{ flex: 1 }}>
                  Tag {i + 1} · {formatWeekdayDate(date)} {isToday && <span className="tag-auto">heute</span>}
                </span>
                <span className="small muted">
                  {count(list)} / {list.length}
                </span>
              </summary>
              <ItemList items={list} ctx={ctx} editing={editing} />
              {editing && <InlineAdd placeholder="Punkt für diesen Tag …" onAdd={(t) => add('tag', t, date)} />}
            </details>
          );
        })}
      </Section>

      <Section title="Nach der Con" done={count(nach)} total={nach.length}>
        <ItemList items={nach} ctx={ctx} editing={editing} />
        {editing && <InlineAdd placeholder="Eigener Punkt …" onAdd={(t) => add('nach', t)} />}
      </Section>
    </>
  );
}
