import { Outlet, useNavigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";

import { 
  Home, BookOpen, Calendar, MessageSquare, User,Users,
  Settings, LogOut, CheckSquare, ClipboardList, 
  UserCheck, FolderTree, Loader2, ShieldCheck, Menu, X 
} from "lucide-react"; 
import { toast } from "sonner";
import { supabase } from "../../lib/supabase"; 

const getDashboardPath = (role: string) => {
  switch (role) {
    case 'admin': return '/app/admin-dashboard';
    case 'parent': return '/app/parent-dashboard';
    case 'member': return '/app/member-dashboard';
    default: return '/app';
  }
};

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkUserAndPermissions = async () => {
      setLoading(true);
      setIsAuthorized(false);

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate("/");
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error || !profile) {
          navigate("/");
          return;
        }

        setCurrentUser(profile);

        // Security Path Guarding
        const path = location.pathname;
        let hasPermission = true;

        const adminOnly = ["/app/admin-dashboard", "/app/admin-controls", "/app/attendance", "/app/members"];
        const parentOrAdmin = ["/app/family-management", "/app/family-activities", "/app/parent-dashboard"];
        
        if (adminOnly.some(p => path.startsWith(p)) && profile.role !== "admin") {
          hasPermission = false;
        }

        if (parentOrAdmin.some(p => path.startsWith(p)) && profile.role === "member") {
          hasPermission = false;
        }

        if (!hasPermission) {
          toast.error("Access Denied: Unauthorized area.");
          navigate(getDashboardPath(profile.role));
          return;
        }

        // Auto-redirect from base /app
        if (path === "/app" || path === "/app/") {
          navigate(getDashboardPath(profile.role));
          return;
        }

        setIsAuthorized(true);

      } catch (err) {
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    checkUserAndPermissions();
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("currentUser");
    toast.success("Logged out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4" />
        <div className="flex items-center gap-2 text-gray-500 font-medium">
          <ShieldCheck className="w-5 h-5" />
          Securing Session...
        </div>
      </div>
    );
  }

  if (!isAuthorized || !currentUser) return null;

  const navItems = [
    { path: getDashboardPath(currentUser.role), icon: Home, label: "Dashboard", roles: ["member", "parent", "admin"] },
    { path: "/app/profile", icon: User, label: "My Profile", roles: ["member", "parent"] },
    { path: "/app/family-management", icon: FolderTree, label: "Family Management", roles: ["admin"] },
    { path: "/app/bible", icon: BookOpen, label: "Bible Reading", roles: ["member", "parent"] },
    { path: "/app/quiz", icon: CheckSquare, label: "Quizzes", roles: ["member", "parent"] },
    { path: "/app/calendar", icon: Calendar, label: "Calendar", roles: ["member", "parent", "admin"] },
    { path: "/app/questions", icon: MessageSquare, label: "Questions", roles: ["member", "parent", "admin"] },
    { path: "/app/family-activities", icon: ClipboardList, label: "Family Activities", roles: ["parent"] },
    { path: "/app/attendance", icon: UserCheck, label: "Attendance", roles: ["admin"] },
    { path: "/app/admin-controls", icon: Settings, label: "Admin Controls", roles: ["admin"] },
    { path: "/app/directory", icon: Users, label: "Directory", roles: ["admin"] },
    { path: "/app/session-control", icon: Users, label: "Session Control", roles: ["admin"] },
  ].filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col relative">
      
      <header className="sticky top-0 z-[9999] w-full bg-white border-b border-green-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden shrink-0" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="text-gray-600" /> : <Menu className="text-gray-600" />}
            </Button>
            
            {/* THE FIX: Grouped Logo & Title into a clickable area */}
            <div 
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                navigate(getDashboardPath(currentUser.role));
                setIsMobileMenuOpen(false);
              }}
            >
              <img 
                src="/church-logo.png" 
                alt="Church Logo" 
                className="w-10 h-10 object-contain shrink-0" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-lg font-bold text-gray-900 truncate max-w-[120px] xs:max-w-none ml-2">Bete Ardete</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-bold text-gray-900">{currentUser.full_name || currentUser.name}</p>
               <p className="text-[10px] text-green-600 uppercase font-bold tracking-widest">{currentUser.role}</p>
             </div>
             <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:bg-red-50">
               <LogOut className="w-4 h-4" />
             </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full relative">
        
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/40 z-[9998] md:hidden backdrop-blur-sm" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <aside className={`
          fixed md:sticky top-16 h-[calc(100vh-64px)] z-[9999] md:z-40 bg-white md:bg-transparent
          transition-all duration-300 ease-in-out border-r md:border-none p-6 w-72 md:w-64
          ${isMobileMenuOpen ? "left-0 shadow-2xl" : "-left-72 md:left-0"}
        `}>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                      ? "bg-green-600 text-white shadow-lg shadow-green-100 scale-[1.02]" 
                      : "text-gray-500 hover:bg-green-50 hover:text-green-700"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 min-w-0 w-full z-0">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}