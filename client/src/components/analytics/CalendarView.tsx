import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, DollarSign, Phone, Users, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CalendarEvent {
  date: string;
  revenue: number;
  trades: number;
  completion: number;
  type: 'revenue' | 'appointment' | 'call';
}

interface CalendarViewProps {
  events?: CalendarEvent[];
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

export function CalendarView({ events = [], currentMonth = new Date(), onMonthChange }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    date: Date;
    dateStr: string;
    revenue?: number;
    trades?: number;
    completion?: number;
    dailyStats: {
      calls: number;
      appointments: number;
      leads: number;
      conversionRate: number;
    };
  } | null>(null);

  // Get calendar data for the month
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month and how many days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Create array of calendar days
    const days = [];
    
    // Add empty days for previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const eventData = events.find(e => e.date === dateStr);
      
      days.push({
        day,
        date: new Date(year, month, day),
        dateStr,
        ...eventData
      });
    }
    
    return { days, year, month, daysInMonth };
  }, [currentMonth, events]);

  // Calculate weekly summaries
  const weekSummaries = useMemo(() => {
    const weeks = [];
    let currentWeek = 0;
    
    for (let i = 0; i < 6; i++) {
      const weekStart = i * 7;
      const weekEnd = Math.min(weekStart + 7, calendarData.days.length);
      const weekDays = calendarData.days.slice(weekStart, weekEnd).filter(day => day && day.day);
      
      if (weekDays.length > 0) {
        const totalRevenue = weekDays.reduce((sum, day) => sum + (day.revenue || 0), 0);
        const totalDays = weekDays.filter(day => day.revenue && day.revenue > 0).length;
        
        weeks.push({
          week: i + 1,
          revenue: totalRevenue,
          days: totalDays,
          average: totalDays > 0 ? totalRevenue / totalDays : 0
        });
      }
    }
    
    return weeks;
  }, [calendarData]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    onMonthChange?.(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    onMonthChange?.(newDate);
  };

  const handleDateClick = (day: any) => {
    if (!day || !day.day) return;
    
    // Generate realistic daily stats for the modal
    const dailyStats = {
      calls: day.revenue ? Math.floor(day.revenue / 50) + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 5),
      appointments: day.trades || Math.floor(Math.random() * 3),
      leads: day.revenue ? Math.floor(day.revenue / 100) + Math.floor(Math.random() * 8) : Math.floor(Math.random() * 4),
      conversionRate: day.completion || (Math.random() * 30 + 15)
    };

    // Ensure date is a proper Date object
    const dateObj = day.date instanceof Date ? day.date : new Date(day.date);

    setModalData({
      date: dateObj,
      dateStr: day.dateStr || dateObj.toDateString(),
      revenue: day.revenue,
      trades: day.trades,
      completion: day.completion,
      dailyStats
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalData(null);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {monthNames[calendarData.month]} {calendarData.year}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">This month</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Monthly stats:</span>
              <span className="text-green-600 font-semibold">
                {formatRevenue(weekSummaries.reduce((sum, week) => sum + week.revenue, 0))}
              </span>
              <span className="text-gray-500">
                {weekSummaries.reduce((sum, week) => sum + week.days, 0)} days
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Header row */}
          {dayNames.map(day => (
            <div key={day} className="bg-gray-50 dark:bg-gray-800 p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700">
              {day}
            </div>
          ))}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
            {/* Week totals column header */}
          </div>

          {/* Calendar rows */}
          {Array.from({ length: Math.ceil(calendarData.days.length / 7) }, (_, weekIndex) => {
            const weekStart = weekIndex * 7;
            const weekEnd = Math.min(weekStart + 7, calendarData.days.length);
            const weekDays = calendarData.days.slice(weekStart, weekEnd);
            const weekSummary = weekSummaries[weekIndex];

            return (
              <React.Fragment key={weekIndex}>
                {/* Week days */}
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const day = weekDays[dayIndex];
                  const isEmpty = !day || !day.day;
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`
                        relative min-h-[100px] p-3 border-t border-l border-gray-200 dark:border-gray-700
                        ${isEmpty ? 'bg-gray-50 dark:bg-gray-900' : 
                          day?.revenue && day.revenue > 0 ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 
                          'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'} 
                        cursor-pointer transition-colors
                      `}
                      onClick={() => handleDateClick(day)}
                    >
                      {!isEmpty && day && (
                        <>
                          <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            {day.day}
                          </div>
                          
                          {day.revenue && day.revenue > 0 && (
                            <div className="flex flex-col items-center justify-center space-y-1 mt-2">
                              <div className="text-lg font-bold text-gray-900 dark:text-white">
                                ${(day.revenue / 1000).toFixed(1)}K
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {day.trades || Math.floor(day.revenue / 2000)} trades
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {(day.completion || 50).toFixed(1)}%
                              </div>
                            </div>
                          )}
                          
                          {selectedDate && selectedDate.getTime() === day.date.getTime() && (
                            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded pointer-events-none" />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Week summary column - NOW ON RIGHT SIDE */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 text-center border-t border-l border-gray-200 dark:border-gray-700">
                  {weekSummary && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Week {weekSummary.week}</div>
                      <div className="text-2xl font-bold text-green-600">
                        ${(weekSummary.revenue / 1000).toFixed(1)}K
                      </div>
                      <div className="text-xs text-gray-500">
                        {weekSummary.days} day{weekSummary.days !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Date Details Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            {modalData && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {modalData.date.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </h2>
                  </div>
                  <div className="flex items-center gap-6">
                    {modalData.revenue && (
                      <div className="text-3xl font-bold text-green-600">
                        Net Revenue {formatCurrency(modalData.revenue)}
                      </div>
                    )}
                    <Button variant="outline" size="sm">
                      <span className="mr-2">📝</span>
                      Add note
                    </Button>
                    <Button variant="ghost" size="sm" onClick={closeModal}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-64 flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="w-full h-48 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 rounded relative overflow-hidden">
                      {/* Simulated chart line */}
                      <svg className="w-full h-full" viewBox="0 0 400 200">
                        <defs>
                          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0.05"/>
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 150 Q 50 120 100 130 T 200 110 T 300 90 T 400 70"
                          stroke="rgb(34, 197, 94)"
                          strokeWidth="2"
                          fill="none"
                        />
                        <path
                          d="M 0 150 Q 50 120 100 130 T 200 110 T 300 90 T 400 70 L 400 200 L 0 200 Z"
                          fill="url(#areaGradient)"
                        />
                      </svg>
                      <div className="absolute top-4 left-4 text-sm text-gray-600 dark:text-gray-300">
                        ${modalData.revenue ? Math.floor(modalData.revenue / 1000) : 30}K
                      </div>
                      <div className="absolute bottom-4 left-4 text-sm text-gray-600 dark:text-gray-300">
                        $0
                      </div>
                    </div>
                  </div>
                </div>

                {/* Production Statistics Grid */}
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Calls</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.dailyStats.calls}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Appointments</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.dailyStats.appointments}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Leads Worked</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.dailyStats.leads}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sales</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.trades || Math.floor(modalData.dailyStats.appointments * 0.7)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Contact Rate</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{(modalData.dailyStats.conversionRate || 45).toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Set Rate</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{(modalData.completion || 25).toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Call Volume</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.dailyStats.calls * 45 + 200}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">ALP</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{modalData.revenue ? Math.floor(modalData.revenue / 700) : 0}</div>
                  </div>
                </div>

                {/* Production Activity Log */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
                    <h3 className="font-medium text-gray-900 dark:text-white">Daily Activity Log</h3>
                  </div>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Time</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Lead Name</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Type</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Product</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Revenue</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Commission</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Status</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: modalData.dailyStats.calls || 5 }, (_, i) => {
                          const isSale = Math.random() > 0.6;
                          const isAppointment = Math.random() > 0.4;
                          const revenue = isSale ? Math.floor(Math.random() * 3000 + 500) : 0;
                          const commission = revenue * 0.3;
                          const time = new Date(modalData.date);
                          time.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
                          
                          const leadNames = ['Johnson, Robert', 'Smith, Maria', 'Davis, John', 'Wilson, Sarah', 'Brown, Michael', 'Garcia, Lisa', 'Miller, David', 'Jones, Jennifer'];
                          const products = ['ALP Term Life', 'Whole Life', 'Universal Life', 'Annuity', 'Medicare Supplement'];
                          
                          return (
                            <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-2">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-4 py-2">{leadNames[i % leadNames.length]}</td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  isSale ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                                  isAppointment ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                                  'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                                }`}>
                                  {isSale ? 'SALE' : isAppointment ? 'APPT' : 'CALL'}
                                </span>
                              </td>
                              <td className="px-4 py-2">{isSale ? products[i % products.length] : '–'}</td>
                              <td className={`px-4 py-2 font-medium ${isSale ? 'text-green-600' : 'text-gray-400'}`}>
                                {isSale ? formatCurrency(revenue) : '–'}
                              </td>
                              <td className={`px-4 py-2 ${isSale ? 'text-green-600' : 'text-gray-400'}`}>
                                {isSale ? formatCurrency(commission) : '–'}
                              </td>
                              <td className="px-4 py-2">
                                {isSale ? 'Completed' : isAppointment ? 'Scheduled' : 'No Contact'}
                              </td>
                              <td className="px-4 py-2 text-gray-500">
                                {isSale ? 'Policy issued' : isAppointment ? 'Follow-up set' : 'VM left'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}