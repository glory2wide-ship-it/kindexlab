/** Normalized grant / welfare / biz support record for KinDex. */
export type PublicGrantRecord = {
  id: string;
  title: string;
  agency?: string;
  department?: string;
  summary?: string;
  target?: string;
  criteria?: string;
  content?: string;
  howToApply?: string;
  documents?: string;
  deadline?: string;
  url?: string;
  phone?: string;
  field?: string;
  source: "gov24" | "welfare-central" | "welfare-local" | "bizinfo";
};

export type AptTradeDeal = {
  aptName: string;
  amountManwon: number;
  areaM2?: number;
  floor?: string;
  dealYear: number;
  dealMonth: number;
  dealDay?: number;
  dong?: string;
  buildYear?: number;
};

export type AptRentDeal = {
  aptName: string;
  depositManwon: number;
  monthlyRentManwon: number;
  areaM2?: number;
  floor?: string;
  dealYear: number;
  dealMonth: number;
  dealDay?: number;
  dong?: string;
};
