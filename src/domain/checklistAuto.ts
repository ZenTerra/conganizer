import type { ChecklistAuto, ChecklistItem, Con, Hotel, PackItem } from '../db/types';

export interface AutoContext {
  con: Pick<Con, 'feePaid'>;
  hotels: Pick<Hotel, 'booked'>[];
  packItems: Pick<PackItem, 'checked'>[];
}

/** Punkte, die sich aus den Daten von selbst erledigen. */
export function isAutoDone(auto: ChecklistAuto | undefined, ctx: AutoContext): boolean {
  switch (auto) {
    case 'feePaid':
      return ctx.con.feePaid;
    case 'hotelBooked':
      return ctx.hotels.some((h) => h.booked);
    case 'packDone':
      return ctx.packItems.length > 0 && ctx.packItems.every((p) => p.checked);
    default:
      return false;
  }
}

export const isItemDone = (item: Pick<ChecklistItem, 'checked' | 'auto'>, ctx: AutoContext): boolean =>
  item.checked || isAutoDone(item.auto, ctx);
