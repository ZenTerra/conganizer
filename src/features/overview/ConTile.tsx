import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
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
        {(con.rating || con.reapply) && (
          <div className="tile-deadline">
            {con.rating ? (
              <>
                <Star size={12} fill="currentColor" style={{ color: 'var(--warning)' }} /> {con.rating}
              </>
            ) : null}
            {con.reapply && <span>{con.rating ? ' · ' : ''}wieder: {con.reapply}</span>}
          </div>
        )}
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
