import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { Con, Hotel, IsoDate } from '../../db/types';
import { daysUntil, formatDate, formatRange, relativeDays } from '../../domain/dates';
import { nextDeadline } from '../../domain/deadlines';
import { STATUS_META } from '../../domain/status';
import { ConCover, StatusBadge } from '../../ui/common';

export function ConTile({ con, hotels, today }: { con: Con; hotels: Hotel[]; today: IsoDate }) {
  const deadline = nextDeadline(con, hotels, today);
  const soon = deadline ? daysUntil(deadline.date, today) <= 14 : false;

  return (
    <Link to={`/con/${con.id}`} className={`tile ${STATUS_META[con.status].inactive ? 'inactive' : ''}`}>
      <ConCover name={con.name} imageId={con.coverImageId} className="tile-media" />
      <div className="tile-body">
        <div className="tile-name">{con.name}</div>
        <div className="tile-meta">{formatRange(con.startDate, con.endDate)}</div>
        <div>
          <StatusBadge status={con.status} />
        </div>
        {deadline && (
          <div className={`tile-deadline ${soon ? 'soon' : ''}`} title={formatDate(deadline.date)}>
            <Clock size={13} />
            <span>
              {deadline.label} {relativeDays(deadline.date, today)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
