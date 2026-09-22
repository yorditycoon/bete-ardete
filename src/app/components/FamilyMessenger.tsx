import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Users, ArrowLeft, Sparkles, Check, CheckCheck, Trash2, Smile } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { toast } from "sonner";

const QUICK_REPLIES = ["Amen! 🙏", "On my way! 🏃‍♂️💨", "Preach! 🗣️🔥", "Who's bringing food? 🍲"];
const COMMON_EMOJIS = [
  "😀", "😂", "🥰", "😎", "🙏", "👍", "🙌", "🔥", 
  "🎉", "❤️", "🤔", "😭", "👀", "💯", "✨", "😅", 
  "⛪", "✝️", "🕊️", "📖", "🍲", "☕", "👶", "👼"
];

export function FamilyMessenger() {
  const { user, profile, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<"list" | "group" | string>("list");
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldShow = !isLoading && user && profile && profile.family_id;

  // Fetch Family Members
  useEffect(() => {
    if (!shouldShow) return;
    const fetchFamily = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("family_id", profile.family_id)
        .neq("id", user.id);
      if (data) setFamilyMembers(data);
    };
    fetchFamily();
  }, [shouldShow, profile, user]);

  // Fetch & Listen to Messages (INSERT, UPDATE, DELETE)
  useEffect(() => {
    if (!shouldShow) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("family_messages")
        .select("*, sender:profiles!family_messages_sender_id_fkey(name)")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase.channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_messages' }, (payload) => {
        supabase.from('profiles').select('name').eq('id', payload.new.sender_id).single()
          .then(({ data }) => {
            setMessages(prev => [...prev, { ...payload.new, sender: data }]);
          });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'family_messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'family_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shouldShow, profile]);

  // Auto-Mark Messages as Read when chat is opened
  useEffect(() => {
    if (!isOpen || activeChat === "list") return;

    const unreadIds = messages
      .filter(m => m.sender_id !== user.id && !m.is_read && (activeChat === "group" ? m.receiver_id === null : m.sender_id === activeChat))
      .map(m => m.id);

    if (unreadIds.length > 0) {
      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
      supabase.from("family_messages").update({ is_read: true }).in("id", unreadIds).then();
    }
  }, [isOpen, activeChat, messages, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChat]);

  const handleSendMessage = async (text: string = newMessage) => {
    if (!text.trim() || !profile?.family_id) return;
    
    const receiverId = activeChat === "group" ? null : activeChat;
    
    await supabase.from("family_messages").insert([{
      family_id: profile.family_id,
      sender_id: user.id,
      receiver_id: receiverId,
      message: text.trim(),
      is_read: false 
    }]);

    setNewMessage("");
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async (msgId: string, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    try {
      const { error } = await supabase.from("family_messages").delete().eq("id", msgId).eq("sender_id", user.id);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      toast.error("Could not delete message: " + err.message);
    }
  };

  const visibleMessages = messages.filter(m => {
    if (activeChat === "group") return m.receiver_id === null;
    return (m.sender_id === activeChat && m.receiver_id === user.id) || 
           (m.sender_id === user.id && m.receiver_id === activeChat);
  });

  const getUnreadCount = (chatId: string) => {
    return messages.filter(m => 
      m.sender_id !== user?.id && 
      !m.is_read && 
      (chatId === "group" ? m.receiver_id === null : m.sender_id === chatId)
    ).length;
  };

  const totalUnread = messages.filter(m => m.sender_id !== user?.id && !m.is_read && (m.receiver_id === user?.id || m.receiver_id === null)).length;

  const getChatName = () => {
    if (activeChat === "group") return "Family Group Chat";
    return familyMembers.find(m => m.id === activeChat)?.name || "Chat";
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className={`fixed bottom-6 right-6 z-[99998] transition-all duration-300 ${isOpen ? "opacity-0 scale-50 pointer-events-none sm:opacity-100 sm:scale-100 sm:pointer-events-auto" : "opacity-100 scale-100"}`}>
        <button 
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110"
        >
          <MessageCircle className="w-6 h-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Chat Window Container - Fixed responsive height limits */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-[99999] w-full h-[100dvh] sm:h-[600px] sm:max-h-[calc(100vh-120px)] sm:w-[380px] bg-white sm:rounded-3xl shadow-2xl sm:border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-5 duration-300 sm:origin-bottom-right">
          
          {/* Header */}
          <div className="bg-green-700 p-4 sm:p-5 text-white flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent mix-blend-overlay"></div>
            
            <div className="flex items-center gap-3 relative z-10">
              {activeChat !== "list" && (
                <button onClick={() => { setActiveChat("list"); setShowEmojiPicker(false); }} className="hover:bg-white/20 p-1.5 rounded-full transition-colors backdrop-blur-sm">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-black text-lg flex items-center gap-2">
                {activeChat === "list" ? "Household Comms" : getChatName()}
              </h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-red-500/80 hover:text-white p-1.5 rounded-full transition-colors relative z-10 bg-white/10 backdrop-blur-sm">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* LIST VIEW */}
          {activeChat === "list" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button 
                onClick={() => setActiveChat("group")}
                className="w-full bg-white p-4 rounded-2xl border border-green-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-green-50 to-transparent opacity-50 rounded-bl-full"></div>
                <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-base">Family Group Chat</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Talk to everyone!</p>
                </div>
                {getUnreadCount("group") > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                    {getUnreadCount("group")}
                  </span>
                )}
              </button>

              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">Direct Messages</p>
                <div className="space-y-2">
                  {familyMembers.map(member => (
                    <button 
                      key={member.id}
                      onClick={() => setActiveChat(member.id)}
                      className="w-full bg-white p-3.5 rounded-2xl border border-gray-100 hover:border-green-300 hover:shadow-sm transition-all flex items-center gap-3 relative"
                    >
                      <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold border border-gray-200">
                        {member.name.charAt(0)}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{member.name}</p>
                        <p className="text-[10px] text-gray-400 capitalize font-medium">{member.role}</p>
                      </div>
                      {getUnreadCount(member.id) > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                          {getUnreadCount(member.id)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CHAT VIEW */}
          {activeChat !== "list" && (
            <>
              {/* Message Feed */}
              <div ref={scrollRef} onClick={() => setShowEmojiPicker(false)} className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#e5ddd5] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative">
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
                
                {visibleMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2 opacity-60 relative z-10">
                    <Sparkles className="w-10 h-10 mb-2" />
                    <p className="font-bold text-sm">It's quiet... too quiet.</p>
                    <p className="text-xs">Send the first message!</p>
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => {
                    const isMe = msg.sender_id === user.id;
                    const timeString = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    return (
                      <div key={msg.id} className={`flex flex-col group relative z-10 ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && activeChat === "group" && (
                          <span className="text-[10px] text-gray-500 font-bold ml-2 mb-1">{msg.sender?.name}</span>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {isMe && (
                            <button 
                              type="button"
                              onClick={(e) => handleDeleteMessage(msg.id, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 bg-white rounded-full shadow-sm border border-gray-100"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          <div className={`relative px-3.5 pb-2 pt-2.5 rounded-2xl max-w-[240px] sm:max-w-[260px] min-w-[80px] shadow-sm ${isMe ? "bg-[#dcf8c6] text-gray-900 rounded-tr-sm" : "bg-white text-gray-900 rounded-tl-sm border border-gray-100"}`}>
                            <p className="text-[14px] leading-snug mb-3 pr-2 break-words">{msg.message}</p>
                            
                            <div className="absolute bottom-1.5 right-2.5 flex items-center gap-1">
                              <span className="text-[9px] text-gray-500/80 font-bold tracking-wider">{timeString}</span>
                              {isMe && (
                                msg.is_read 
                                  ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> 
                                  : <Check className="w-3 h-3 text-gray-400" /> 
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Replies - Hidden Scrollbar applied here */}
              <div className="px-3 pb-2 pt-3 bg-gray-50 border-t border-gray-200 flex gap-2 overflow-x-auto whitespace-nowrap shrink-0 relative z-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {QUICK_REPLIES.map((reply, i) => (
                  <button 
                    type="button"
                    key={i} 
                    onClick={(e) => { e.preventDefault(); handleSendMessage(reply); }}
                    className="px-3 py-1.5 bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-200 text-gray-600 border border-gray-200 text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm shrink-0"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Input Area with Emoji Picker */}
              <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0 pb-safe sm:pb-3 relative">
                
                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-3 bg-white border border-gray-200 shadow-xl rounded-2xl p-3 z-30 w-[280px] animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Quick Emojis</p>
                    <div className="grid grid-cols-6 gap-1">
                      {COMMON_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setNewMessage(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="text-xl hover:bg-green-50 p-1.5 rounded-xl transition-colors flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }}
                  className={`p-2.5 rounded-full transition-colors shrink-0 ${showEmojiPicker ? "bg-green-100 text-green-700" : "text-gray-400 hover:text-green-600 hover:bg-gray-50"}`}
                >
                  <Smile className="w-5 h-5" />
                </button>
                
                <input 
                  type="text"
                  placeholder="Message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  onClick={() => setShowEmojiPicker(false)}
                  className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
                />
                
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleSendMessage(); }}
                  disabled={!newMessage.trim()}
                  className="w-11 h-11 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center shrink-0 transition-colors shadow-md disabled:shadow-none"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}