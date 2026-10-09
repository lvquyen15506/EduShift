export type ScheduleItem = {
  id: string;
  title: string;
  type: 'STUDY' | 'BUSY' | 'FREE' | 'WORK';
  source: 'SCHOOL' | 'MANUAL' | 'SHIFT';
  application_id?: string | null;
  shift_id?: string | null;
  start_time: string;
  end_time: string;
};

export type Shift = {
  id: string;
  title: string;
  description: string;
  company_name: string;
  location: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  required_workers: number;
  required_skills: string[];
  status: string;
  applicants: number;
  match_score?: number;
};

export type ShiftDetail = Shift & {
  match_score: number;
  match_reasons: string[];
  available: boolean;
  applied: boolean;
  invitation_id?: string | null;
  application_id?: string | null;
  application_status?: 'ACCEPTED' | 'COMPLETED';
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  completed_at?: string | null;
  reviewed?: boolean;
};

export type StudentDashboard = {
  stats: { available_shifts: number; pending_applications: number; accepted_applications: number };
  recommended_shifts: Shift[];
};

export type NotificationItem = {
  id: string;
  shift_id: string | null;
  title: string;
  body: string;
  kind: string;
  is_read: boolean;
  created_at: string;
};
