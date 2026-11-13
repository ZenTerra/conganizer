import type { CashDay, Cents, Con, Expense, Hotel, Trip } from '../db/types';
import { businessCashCosts, cashReport } from './cash';
import { kmTotals } from './trips';

export interface ProfitInput {
  con: Pick<Con, 'fee'>;
  cashDays: CashDay[];
  hotels: Hotel[];
  trips: Trip[];
  expenses: Expense[];
  kmRate: Cents;
}

export interface Profit {
  revenueCash: Cents;
  revenueCard: Cents;
  revenue: Cents;
  fee: Cents;
  hotels: Cents;
  km: number;
  kmCost: Cents;
  cashBusiness: Cents;
  other: Cents;
  costs: Cents;
  profit: Cents;
  /** Privatentnahmen (Verpflegung/Privat) – keine Kosten der Con */
  privat: Cents;
  /** Kassentage ohne Start- oder Endbestand */
  incompleteDays: number;
}

/**
 * Gewinn pro Con = Umsatz (Tageslosungen bar + SumUp) − Kosten
 * (Standgebühr + gebuchte Hotels + geschäftliche km × Satz + geschäftliche Kassenausgaben + sonstige Ausgaben).
 * Privatentnahmen und Tankkosten zählen nicht als Kosten.
 */
export function conProfit({ con, cashDays, hotels, trips, expenses, kmRate }: ProfitInput): Profit {
  const reports = cashDays.map(cashReport);
  const complete = reports.filter((r) => r.complete);
  const revenueCash = complete.reduce((s, r) => s + r.tageslosung, 0);
  const revenueCard = cashDays.reduce((s, d) => s + (d.card ?? 0), 0);
  const fee = con.fee ?? 0;
  const hotelCost = hotels.filter((h) => h.booked).reduce((s, h) => s + (h.price ?? 0), 0);
  const km = kmTotals(trips).geschaeftlich;
  const kmCost = Math.round(km * kmRate);
  const cashBusiness = reports.reduce((s, r) => s + businessCashCosts(r), 0);
  const other = expenses.reduce((s, e) => s + e.amount, 0);
  const costs = fee + hotelCost + kmCost + cashBusiness + other;
  const revenue = revenueCash + revenueCard;
  return {
    revenueCash,
    revenueCard,
    revenue,
    fee,
    hotels: hotelCost,
    km,
    kmCost,
    cashBusiness,
    other,
    costs,
    profit: revenue - costs,
    privat: reports.reduce((s, r) => s + r.privat, 0),
    incompleteDays: reports.filter((r) => !r.complete && (r.vortag || r.endbestand || r.ausgaben || r.einlagen)).length,
  };
}
