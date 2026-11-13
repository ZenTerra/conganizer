import type { AppSettings, ChecklistTemplateItem, PackTemplateItem } from './types';

const pack = (category: string, labels: string[]): PackTemplateItem[] =>
  labels.map((label) => ({ category, label }));

export const DEFAULT_PACK_TEMPLATE: PackTemplateItem[] = [
  ...pack('Stand & Deko', [
    'Tischdecke',
    'Displays / Ständer',
    'Gitterwand + Kabelbinder',
    'Banner',
    'Preisschilder',
    'Klebeband',
    'Schere',
    'Stuhlkissen',
  ]),
  ...pack('Ware', ['Ware laut Bestandsliste', 'Verpackung / Tüten', 'Visitenkarten', 'Flyer']),
  ...pack('Kasse & Technik', [
    'Wechselgeld / Kasse',
    'SumUp-Reader + Ladekabel',
    'Handy-Ladekabel',
    'Powerbank',
    'Lichter / Lampen',
    'Verlängerungskabel',
    'Mehrfachsteckdose',
  ]),
  ...pack('Orga', ['Ausstellerausweis / Bestätigung', 'Hotelbestätigung', 'Personalausweis', 'Stift', 'Notizblock']),
  ...pack('Persönliches', ['Wasser', 'Snacks', 'Kleidung', 'Medikamente', 'Kopfschmerztabletten', 'Zahnbürste']),
];

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { section: 'vor', label: 'Standgebühr bezahlt', auto: 'feePaid' },
  { section: 'vor', label: 'Hotel gebucht', auto: 'hotelBooked' },
  { section: 'vor', label: 'Wechselgeld besorgt' },
  { section: 'vor', label: 'SumUp-Reader geladen' },
  { section: 'vor', label: 'Packliste abgehakt', auto: 'packDone' },
  { section: 'vor', label: 'Route geprüft' },
  { section: 'tag', label: 'SumUp-Tagesbericht exportieren und in Accountable einpflegen' },
  { section: 'tag', label: 'Lichter / Lampen aufladen' },
  { section: 'tag', label: 'Powerbank aufladen' },
  { section: 'nach', label: 'Verpflegungspauschale in Accountable eintragen' },
  { section: 'nach', label: 'Fahrtenbuch exportieren und in Accountable einpflegen' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  homeAddress: '',
  kmRate: 30,
  mealRatePartial: 1400,
  mealRateFull: 2800,
  lastBackupAt: null,
  packTemplate: DEFAULT_PACK_TEMPLATE,
  checklistTemplate: DEFAULT_CHECKLIST_TEMPLATE,
};
