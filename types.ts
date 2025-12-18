
export interface RoutineItem {
  id: string;
  time: string; // 12h format string
  activity: string;
  emoji: string;
  category: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
}

export interface DailyLog {
  [date: string]: string[]; // date string (YYYY-MM-DD) -> array of completed task IDs
}

export interface DailyReflection {
  [date: string]: string; // date string -> AI generated summary/reflection
}

export interface Analytics {
  averageCompletion: number;
  bestDay: string;
  totalTasksDone: number;
  streak: number;
}
