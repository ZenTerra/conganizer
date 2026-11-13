import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Calculator,
  Car,
  Images,
  LayoutDashboard,
  ListChecks,
  Luggage,
  Pencil,
  Wallet,
} from 'lucide-react';
import { useCon } from '../../db/hooks';
import type { Con } from '../../db/types';

const TABS = [
  { to: '', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: 'hotel', label: 'Hotel', icon: BedDouble },
  { to: 'fahrten', label: 'Fahrten', icon: Car },
  { to: 'packliste', label: 'Packliste', icon: Luggage },
  { to: 'kasse', label: 'Kasse', icon: Wallet },
  { to: 'checkliste', label: 'Checkliste', icon: ListChecks },
  { to: 'bilder', label: 'Bilder', icon: Images },
  { to: 'abrechnung', label: 'Abrechnung', icon: Calculator },
];

export interface ConContext {
  con: Con;
}

export const useConContext = () => useOutletContext<ConContext>();

export function ConLayout() {
  const { id } = useParams();
  const con = useCon(id);

  if (con === undefined) return null;
  if (con === null) {
    return (
      <main className="page narrow">
        <p>Diese Con gibt es nicht (mehr).</p>
        <Link to="/">Zur Übersicht</Link>
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="btn ghost icon" aria-label="Zur Übersicht">
          <ArrowLeft size={22} />
        </Link>
        <h1>{con.name}</h1>
        <Link to={`/con/${con.id}/bearbeiten`} className="btn ghost icon" aria-label="Bearbeiten">
          <Pencil size={20} />
        </Link>
      </header>
      <div className="con-shell">
        <nav className="tabbar" aria-label="Bereiche">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={label} to={to} end={end} replace>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="page">
          <Outlet context={{ con } satisfies ConContext} />
        </main>
      </div>
    </>
  );
}
