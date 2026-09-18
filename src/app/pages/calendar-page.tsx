import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { Calendar as CalendarIcon, Clock, Loader2, MapPin } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { isSameDay, parseISO } from "date-fns";

export function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('event_date', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (error: any) {
        toast.error("Error: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Filter events matching the selected calendar date
  const selectedDateEvents = events.filter(event => 
    date && event.event_date && isSameDay(parseISO(event.event_date), date)
  );

  // Extract all dates that have an event (for the calendar highlight dots)
  const eventDates = events
    .filter(event => event.event_date)
    .map(event => parseISO(event.event_date));

  const getEventTypeStyle = (type: string) => {
    switch (type?.toLowerCase()) {
      case "gathering": return "bg-green-100 text-green-800 border-green-200 shadow-sm";
      case "meeting": return "bg-black text-white border-black shadow-sm";
      case "event": return "bg-gray-100 text-black border-gray-200 shadow-sm";
      default: return "bg-gray-50 text-gray-600 border-gray-200 shadow-sm";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Syncing Church Calendar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col justify-center">
        <h2 className="text-2xl sm:text-3xl font-black text-black mb-2 flex items-center gap-2">
          <CalendarIcon className="w-8 h-8 text-green-600" /> Church Calendar
        </h2>
        <p className="text-gray-600 font-medium">Stay updated with our weekly gatherings and special events.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Left Column: The Interactive Calendar */}
        <div className="lg:col-span-1">
          <Card className="border-green-200 shadow-sm sticky top-20 bg-white">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg text-black">Select Date</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-4 sm:p-6">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-xl border border-green-200 shadow-sm bg-white p-3 w-full max-w-[350px] mx-auto flex justify-center"
                modifiers={{ hasEvent: eventDates }}
                modifiersStyles={{
                  hasEvent: { 
                    fontWeight: "bold", 
                    backgroundColor: "#f0fdf4", 
                    color: "#166534",
                    border: "1px solid #bbf7d0" 
                  },
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: The Event Details */}
        <div className="lg:col-span-2">
          <Card className="border-green-200 shadow-sm min-h-[500px] flex flex-col bg-white">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 rounded-t-xl pb-4 flex-none">
              <CardTitle className="flex items-center gap-3 text-xl text-black">
                <div className="p-2 bg-green-50 border border-green-100 rounded-lg text-green-600">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : "Select a date"}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-6 flex-1">
              <div className="space-y-6">
                {selectedDateEvents.length > 0 ? (
                  selectedDateEvents.map((event) => {
                    // Extract time cleanly from the ISO string
                    const eventTime = new Date(event.event_date).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit', 
                      hour12: true 
                    });

                    let eventAgenda = [];
                    if (event.agenda) {
                      try { eventAgenda = typeof event.agenda === 'string' ? JSON.parse(event.agenda) : event.agenda; } 
                      catch (e) { eventAgenda = []; }
                    }

                    return (
                      <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all overflow-hidden flex flex-col group">
                        
                        {/* Premium Cover Image */}
                        {event.image_url && (
                          <div className="w-full h-48 sm:h-56 relative overflow-hidden bg-gray-100 border-b border-gray-100">
                            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          </div>
                        )}

                        <div className="p-5 sm:p-6 flex flex-col flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                            <h4 className="font-bold text-xl sm:text-2xl text-black leading-tight">{event.title}</h4>
                            <Badge className={`w-fit font-bold uppercase tracking-wider text-[10px] ${getEventTypeStyle(event.type)}`}>
                              {event.type}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-black font-bold mb-5 bg-green-50 p-3 rounded-xl border border-green-100 w-fit">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-green-600" /> 
                              {eventTime}
                            </div>
                          </div>
                          
                          {event.description && (
                            <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
                              {event.description}
                            </p>
                          )}

                          {eventAgenda && eventAgenda.length > 0 && (
                            <div className="mt-2 mb-6 pt-4 border-t border-gray-50">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Event Schedule</p>
                              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[26px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-green-200 before:to-transparent">
                                {eventAgenda.map((item: any, idx: number) => (
                                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-green-100 text-green-700 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                    </div>
                                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-gray-100 bg-gray-50 shadow-sm flex items-center gap-3 hover:border-green-200 transition-colors">
                                      <Badge variant="outline" className="bg-white text-green-800 font-mono border-green-200 text-xs shrink-0 font-bold">{item.time}</Badge>
                                      <span className="font-bold text-black text-sm truncate">{item.activity}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-auto border-t border-gray-100 pt-4">
                            {/* Interactive Map Link */}
                            {event.location && (
                              <a 
                                href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-green-50 hover:bg-green-600 text-green-700 hover:text-white text-sm sm:text-base font-bold py-3 px-6 rounded-xl transition-all border border-green-200 hover:border-green-600 shadow-sm"
                              >
                                <MapPin className="w-5 h-5" /> Open in Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-bold text-black mb-1">No Events Scheduled</p>
                    <p className="text-sm text-gray-500">There are no gatherings planned for this day.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}