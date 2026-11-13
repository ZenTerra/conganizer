import { useEffect, useState, type CSSProperties } from 'react';
import { Star } from 'lucide-react';
import { db } from '../../db/db';
import { updateRecord } from '../../db/repo';
import type { Con, Reapply } from '../../db/types';

const REAPPLY: { value: Reapply; label: string; color: string }[] = [
  { value: 'ja', label: 'Ja', color: 'var(--success)' },
  { value: 'vielleicht', label: 'Vielleicht', color: 'var(--warning)' },
  { value: 'nein', label: 'Nein', color: 'var(--danger)' },
];

/** Nachbereitung: Bewertung, „Wieder bewerben?“ und Lessons Learned. */
export function ReviewCard({ con }: { con: Con }) {
  const [lessons, setLessons] = useState(con.lessons ?? '');
  useEffect(() => setLessons(con.lessons ?? ''), [con.id, con.lessons]);

  const save = (changes: Partial<Pick<Con, 'rating' | 'reapply' | 'lessons'>>) => updateRecord(db.cons, con.id, changes);

  return (
    <section className="card">
      <h2>Nachbereitung</h2>
      <div className="field">
        <span>Bewertung</span>
        <div className="stars" role="radiogroup" aria-label="Bewertung">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={con.rating === n}
              aria-label={n === 1 ? "1 Stern" : `${n} Sterne`}
              className={(con.rating ?? 0) >= n ? 'on' : ''}
              onClick={() => save({ rating: con.rating === n ? undefined : n })}
            >
              <Star size={28} fill={(con.rating ?? 0) >= n ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Nächstes Jahr wieder bewerben?</span>
        <div className="segmented">
          {REAPPLY.map((r) => (
            <button
              key={r.value}
              aria-pressed={con.reapply === r.value}
              style={{ '--seg-color': r.color } as CSSProperties}
              onClick={() => save({ reapply: con.reapply === r.value ? undefined : r.value })}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Lessons Learned</span>
        <textarea
          rows={4}
          value={lessons}
          placeholder="Was lief gut? Was beim nächsten Mal anders? (Bestseller, Standplatz, Publikum …)"
          onChange={(e) => setLessons(e.target.value)}
          onBlur={() => lessons !== (con.lessons ?? '') && save({ lessons: lessons.trim() ? lessons : undefined })}
        />
      </label>
    </section>
  );
}
