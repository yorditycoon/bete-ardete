import { useState, useEffect } from "react";
import { Bell, Check, BookOpen, Calendar, ListTodo, HelpCircle, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    // 1. Fetch initial notifications
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // 2. Subscribe to real-time new notifications
    const channel = supabase.channel('realtime-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', userId);
    setNotifications([]);
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return <ListTodo className="w-4 h-4 text-blue-500" />;
      case 'event': return <Calendar className="w-4 h-4 text-purple-500" />;
      case 'study': return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-orange-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-600 hover:text-black hover:bg-gray-100">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      {/* The Sheet slides in from the right and takes up max-w-md (half page on desktop, full width on mobile) */}
      <SheetContent style={{ zIndex: 100000 }} className="w-full sm:max-w-md p-0 flex flex-col border-l border-green-100 bg-white">
        
        <SheetHeader className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mt-4 sm:mt-0">
            <SheetTitle className="font-black text-2xl text-black">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 px-3 text-xs font-bold text-green-700 hover:bg-green-100">
                <Check className="w-4 h-4 mr-1.5" /> Mark read
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Notification List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/20">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notif) => (
                <div key={notif.id} className={`p-4 sm:p-5 flex gap-4 transition-colors ${!notif.is_read ? 'bg-green-50/40' : 'bg-white hover:bg-gray-50'}`}>
                  <div className="mt-1 shrink-0 bg-white p-2 rounded-full border border-gray-100 shadow-sm h-fit">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm sm:text-base ${!notif.is_read ? 'font-black text-black' : 'font-bold text-gray-800'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-3 leading-relaxed">
                      {notif.message}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notif.is_read && <div className="w-2.5 h-2.5 bg-green-500 rounded-full mt-2 shrink-0 shadow-sm"></div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Area */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white">
            <Button variant="outline" size="sm" onClick={clearAll} className="w-full h-12 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-xl">
              <Trash2 className="w-4 h-4 mr-2" /> Clear all notifications
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}