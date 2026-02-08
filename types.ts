
export interface Trip {
  id: string;
  name: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  default_currency: string;
  color_key?: string;
  flag_emoji?: string;
  currency_method: 'fixed' | 'realtime';
  fixed_rates: Record<string, number>;
  is_archived?: boolean;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  user_id?: string;
  color?: string;
  mascot?: string;
}

export interface UserProfile {
  name: string;
  mascot: string;
  color: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  expense_name: string;
  amount: number;
  currency: string;
  exchange_rate: number; // Rate relative to the trip's base currency
  expense_date: string;
  updated_at: string;
  category: string;
  payers?: ExpensePayer[];
  splits?: ExpenseSplit[];
}

export interface ExpensePayer {
  expense_id: string;
  participant_id: string;
  amount_paid: number;
  participant?: Participant;
}

export interface ExpenseSplit {
  expense_id: string;
  participant_id: string;
  share_amount: number;
  participant?: Participant;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  rate_to_usd: number;
  is_enabled: boolean;
  updated_at: string;
}
