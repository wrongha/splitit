
export interface Trip {
  id: string;
  name: string;
  owner_id?: string;
  created_at: string;
  default_currency?: string;
  color_key?: string; // Random color key for trip styling
  flag_emoji?: string; // Country flag or trip icon
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  user_id?: string;
  color?: string; // Participant's custom theme color
  mascot?: string; // Participant's emoji mascot
}

export interface Expense {
  id: string;
  trip_id: string;
  expense_name: string;
  amount: number;
  currency: string;
  expense_date: string;
  category: string; // New field for expense categorization
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
