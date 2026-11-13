import { Hammer } from 'lucide-react';

export function PlaceholderTab({ title, milestone }: { title: string; milestone: number }) {
  return (
    <div className="card placeholder">
      <Hammer size={36} style={{ margin: '0 auto' }} className="faint" />
      <h2>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>
        Kommt mit Meilenstein {milestone}.
      </p>
    </div>
  );
}
