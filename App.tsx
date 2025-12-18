import React, { useState, useEffect, useMemo } from 'react';
import { DailyLog, DailyReflection, RoutineItem } from './types';
import { ROUTINE_DEFINITIONS } from './constants';
import { GoogleGenAI } from "@google/genai";
import { 
  CheckCircle, 
  Circle, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  Award, 
  History, 
  Flame,
  Calendar as CalendarIcon,
  Zap,
  Target,
  Trophy,
  Download,
  BookOpen,
  CheckCheck,
  FileJson,
  LayoutDashboard,
  Clock,
  TrendingUp,
  PieChart,
  ArrowRight
} from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getTodayKey = (date = new Date()) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const adjustedDate = new Date(d.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [history, setHistory] = useState<DailyLog>(() => {
    const saved = localStorage.getItem('routine_history_v2');
    return saved ? JSON.parse(saved) : {};
  });
  const [reflections, setReflections] = useState<DailyReflection>(() => {
    const saved = localStorage.getItem('routine_reflections_v2');
    return saved ? JSON.parse(saved) : {};
  });
  const [view, setView] = useState<'dashboard' | 'daily' | 'analytics'>('dashboard');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);

  useEffect(() => {
    localStorage.setItem('routine_history_v2', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('routine_reflections_v2', JSON.stringify(reflections));
  }, [reflections]);

  const completedIds = useMemo(() => history[selectedDate] || [], [history, selectedDate]);
  const dayProgress = Math.round((completedIds.length / ROUTINE_DEFINITIONS.length) * 100);

  const toggleTask = (id: string) => {
    setHistory(prev => {
      const currentDone = prev[selectedDate] || [];
      const newDone = currentDone.includes(id)
        ? currentDone.filter(taskId => taskId !== id)
        : [...currentDone, id];
      return { ...prev, [selectedDate]: newDone };
    });
  };

  const analytics = useMemo(() => {
    const dates = Object.keys(history).filter(d => history[d].length > 0).sort();
    if (dates.length === 0) return { avg: 0, streak: 0, total: 0 };

    let totalPercentage = 0;
    let totalTasks = 0;
    dates.forEach(d => {
      const done = history[d].length;
      totalPercentage += (done / ROUTINE_DEFINITIONS.length);
      totalTasks += done;
    });

    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const key = getTodayKey(checkDate);
      if (history[key] && history[key].length > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      avg: Math.round((totalPercentage / dates.length) * 100),
      streak,
      total: totalTasks
    };
  }, [history]);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = getTodayKey(d);
      const doneCount = history[key]?.length || 0;
      const pct = (doneCount / ROUTINE_DEFINITIONS.length) * 100;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      return { key, pct, dayName };
    });
  }, [history]);

  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = getTodayKey(d);
      const doneCount = history[key]?.length || 0;
      const pct = (doneCount / ROUTINE_DEFINITIONS.length) * 100;
      return { key, pct, label: d.getDate() };
    });
  }, [history]);

  const nextTask = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeInMins = currentHour * 60 + currentMin;

    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const remaining = ROUTINE_DEFINITIONS.filter(item => {
      const itemTime = parseTime(item.time);
      return itemTime > currentTimeInMins && !completedIds.includes(item.id);
    });

    return remaining[0] || null;
  }, [completedIds]);

  const categoryPerformance = useMemo(() => {
    const categories = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
    const stats = categories.map(cat => {
      const tasksInCat = ROUTINE_DEFINITIONS.filter(r => r.category === cat);
      const doneInCat = tasksInCat.filter(r => completedIds.includes(r.id)).length;
      const pct = tasksInCat.length > 0 ? (doneInCat / tasksInCat.length) * 100 : 0;
      return { cat, pct, done: doneInCat, total: tasksInCat.length };
    });
    return stats;
  }, [completedIds]);

  const generateDailyReflection = async () => {
    if (completedIds.length === 0) return;
    setIsReflecting(true);
    try {
      const completedTasks = ROUTINE_DEFINITIONS
        .filter(r => completedIds.includes(r.id))
        .map(r => r.activity)
        .join(', ');

      const prompt = `I completed these tasks today: ${completedTasks}. Write a very brief, high-energy success summary (1-2 sentences) of my day to save in my archive. Use emojis.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setReflections(prev => ({
        ...prev,
        [selectedDate]: response.text || "Day completed with excellence! 🌟"
      }));
    } catch (e) {
      setReflections(prev => ({
        ...prev,
        [selectedDate]: "Another day of progress stored in the archives! 🚀"
      }));
    } finally {
      setIsReflecting(false);
    }
  };

  const exportData = () => {
    const data = {
      history,
      reflections,
      exportedAt: new Date().toISOString(),
      summary: analytics
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routine-backup-${getTodayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateAiReport = async () => {
    setIsAiLoading(true);
    try {
      const summary = `Schedule: 5AM to 12AM. Python, College and Fitness focus. 30-day avg: ${analytics.avg}%. Streak: ${analytics.streak}. Today: ${completedIds.length}/${ROUTINE_DEFINITIONS.length}.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${summary} Provide a sharp motivational analysis. One tip to maintain the streak. Use emojis. 2 sentences max.`,
      });
      setAiInsight(response.text);
    } catch (e) {
      setAiInsight("Crushing your goals! Python and fitness are the ultimate combo. 🐍🏋️‍♂️");
    } finally {
      setIsAiLoading(false);
    }
  };

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(getTodayKey(d));
  };

  const categories = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 pb-24">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-4 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setView('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'daily' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Daily
            </button>
            <button 
              onClick={() => setView('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'analytics' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Analytics
            </button>
          </div>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1 text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-full text-xs">
                <Flame size={14} fill="currentColor" />
                {analytics.streak}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-6">
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h1 className="text-2xl font-black text-slate-800">Command Center</h1>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedDate === getTodayKey() ? 'Live Today' : 'Selected Date'}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-600 rounded-[2rem] p-5 text-white shadow-lg shadow-indigo-100 flex flex-col justify-between">
                <div className="bg-white/20 p-2 w-fit rounded-lg"><Target size={18} /></div>
                <div>
                  <div className="text-3xl font-black mt-4">{dayProgress}%</div>
                  <div className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Progress</div>
                </div>
              </div>
              <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="bg-orange-50 p-2 w-fit rounded-lg text-orange-500"><Flame size={18} /></div>
                <div>
                  <div className="text-3xl font-black mt-4 text-slate-800">{analytics.streak}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Day Streak</div>
                </div>
              </div>
            </div>

            {nextTask && (
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                      {nextTask.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                          <Clock size={10} /> {nextTask.time}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Up</span>
                      </div>
                      <h3 className="font-bold text-slate-800 leading-tight">{nextTask.activity}</h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setView('daily')}
                    className="p-3 bg-slate-50 rounded-full text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Zap size={80} />
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-600" /> Weekly Trend
                </h3>
              </div>
              <div className="flex items-end justify-between h-32 px-2">
                {last7Days.map((day) => (
                  <div key={day.key} className="flex flex-col items-center gap-2 flex-grow">
                    <div className="relative w-3 flex-grow bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-indigo-500 transition-all duration-1000" 
                        style={{ height: `${day.pct}%` }} 
                      />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase">{day.dayName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <PieChart size={16} className="text-violet-600" /> Cycle Efficiency
                </h3>
              </div>
              <div className="space-y-4">
                {categoryPerformance.map(stat => (
                  <div key={stat.cat}>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      <span>{stat.cat}</span>
                      <span className="text-slate-800">{Math.round(stat.pct)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${stat.pct > 80 ? 'bg-green-500' : stat.pct > 50 ? 'bg-indigo-500' : 'bg-orange-400'}`} 
                        style={{ width: `${stat.pct}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'daily' && (
          <>
            <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><ChevronLeft /></button>
              <div className="text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedDate === getTodayKey() ? 'Today' : 'Archive'}</div>
                <div className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <CalendarIcon size={18} className="text-indigo-500" />
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <button 
                onClick={() => changeDate(1)} 
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 disabled:opacity-20 transition-colors"
                disabled={selectedDate === getTodayKey()}
              >
                <ChevronRight />
              </button>
            </div>

            <div className="relative mb-8 overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100">
               <div className="relative z-10">
                <div className="flex justify-between items-start">
                   <div>
                    <h2 className="text-indigo-100 font-bold text-sm uppercase tracking-wider mb-1">Success Score</h2>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tight">{dayProgress}%</span>
                    </div>
                   </div>
                   <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                     <Target className="text-white" size={32} />
                   </div>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-bold mb-2 text-indigo-100 uppercase tracking-widest">
                    <span>{completedIds.length} Logged</span>
                    <span>{ROUTINE_DEFINITIONS.length - completedIds.length} Left</span>
                  </div>
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${dayProgress}%` }} />
                  </div>
                </div>
               </div>
            </div>

            {dayProgress === 100 && !reflections[selectedDate] && (
              <div className="mb-8 p-6 bg-green-50 border border-green-100 rounded-[2rem] flex flex-col items-center text-center gap-4">
                <CheckCheck className="text-green-600" size={32} />
                <div>
                  <h3 className="font-black text-green-900">Day Fully Completed!</h3>
                  <button onClick={generateDailyReflection} disabled={isReflecting} className="mt-2 text-green-600 font-bold underline">
                    {isReflecting ? 'Logging...' : 'Save daily achievement'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-12">
              {categories.map(cat => (
                <div key={cat} className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{cat} Schedule</h3>
                  <div className="space-y-3">
                    {ROUTINE_DEFINITIONS.filter(r => r.category === cat).map(item => {
                      const isDone = completedIds.includes(item.id);
                      return (
                        <div key={item.id} onClick={() => toggleTask(item.id)} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all cursor-pointer ${isDone ? 'bg-indigo-50/40 border-indigo-100' : 'bg-white border-slate-100'}`}>
                          <div className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl bg-slate-50">{item.emoji}</div>
                          <div className="flex-grow">
                            <span className="text-[10px] font-black text-slate-400">{item.time}</span>
                            <h4 className={`font-bold ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.activity}</h4>
                          </div>
                          {isDone ? <CheckCircle className="text-indigo-600" /> : <Circle className="text-slate-200" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black px-2 flex items-center gap-2"><Trophy className="text-indigo-600" /> Analytics</h2>
            <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase text-slate-400">AI Performance Review</span>
                <button onClick={generateAiReport} disabled={isAiLoading} className="text-[10px] font-black bg-white text-slate-900 px-3 py-1 rounded-full uppercase">
                  {isAiLoading ? 'Analyzing...' : 'Refresh'}
                </button>
              </div>
              <p className="text-lg font-medium italic text-slate-200">{aiInsight || "Log your day and generate an AI insight here!"}</p>
            </div>
            
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase">Archive Management</h3>
                  <button onClick={exportData} className="flex items-center gap-2 text-indigo-600 font-bold text-xs"><Download size={14} /> Export JSON</button>
               </div>
               <div className="grid grid-cols-7 gap-2">
                 {last30Days.map(day => (
                   <div key={day.key} className="aspect-square rounded-lg transition-all" style={{ backgroundColor: day.pct > 0 ? `rgba(79, 70, 229, ${day.pct / 100})` : '#f1f5f9' }} />
                 ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="max-w-xl mx-auto flex justify-center pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-xl px-8 py-4 rounded-full border border-slate-200 shadow-2xl flex items-center gap-6">
            <button onClick={() => setView('dashboard')} className={`p-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}><LayoutDashboard /></button>
            <button onClick={() => setView('daily')} className={`p-1 ${view === 'daily' ? 'text-indigo-600' : 'text-slate-400'}`}><CheckCircle /></button>
            <button onClick={() => setView('analytics')} className={`p-1 ${view === 'analytics' ? 'text-indigo-600' : 'text-slate-400'}`}><BarChart3 /></button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;