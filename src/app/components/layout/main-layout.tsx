import { Outlet, useNavigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { 
  Home, BookOpen, Calendar, MessageSquare, User, Users,
  Settings, LogOut, CheckSquare, ClipboardList, 
  UserCheck, FolderTree, Loader2, ShieldCheck, Menu, X, Activity
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

        // Fetch profile WITH the department name to check for Education HQ access
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, departments(name_en)')
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

        const isSuperAdmin = profile.role === "admin"; // Original IT Admin
        const isDeptHead = profile.department_role === "head"; // New Education/Media Heads
        const hasAdminAccess = isSuperAdmin || isDeptHead;

        // Added /app/education-workspace to the protected admin paths
        const adminOnly = [
          "/app/admin-dashboard", 
          "/app/attendance", 
          "/app/members", 
          "/app/directory", 
          "/app/session-control",
          "/app/education-workspace"
        ];
        const parentOrAdmin = ["/app/family-management", "/app/family-activities", "/app/parent-dashboard"];
        
        if (adminOnly.some(p => path.startsWith(p)) && !hasAdminAccess) {
          hasPermission = false;
        }

        if (parentOrAdmin.some(p => path.startsWith(p)) && profile.role === "member" && !hasAdminAccess) {
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
    localStorage.removeItem("currentUser");
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

  // Derive access levels for the sidebar nav
  const isSuperAdmin = currentUser.role === "admin";
  const isDeptHead = currentUser.department_role === "head";
  const hasAdminAccess = isSuperAdmin || isDeptHead;
  const isParent = currentUser.role === "parent";
  const isEducationTeam = currentUser.departments?.name_en === "Education";

  // Dynamic Navigation Items based on the dual roles
  const navItems = [
    { path: getDashboardPath(currentUser.role), icon: Home, label: "Dashboard", show: true },
    { path: "/app/profile", icon: User, label: "My Profile", show: !isSuperAdmin }, // Regular profile for members/parents
    { path: "/app/family-management", icon: FolderTree, label: "Family Management", show: isSuperAdmin },
    { path: "/app/bible", icon: BookOpen, label: "Bible Reading", show: !isSuperAdmin },
    { path: "/app/quiz", icon: CheckSquare, label: "Quizzes", show: !isSuperAdmin },
    { path: "/app/calendar", icon: Calendar, label: "Calendar", show: true },
    { path: "/app/questions", icon: MessageSquare, label: "Questions", show: true },
    { path: "/app/family-activities", icon: ClipboardList, label: "Family Activities", show: isParent },
    { path: "/app/attendance", icon: UserCheck, label: "Attendance", show: isSuperAdmin },
    
    // Dynamically show Education HQ only to Education Dept Heads (or Super Admins)
    { path: "/app/education-workspace", icon: Settings, label: "Education HQ", show: hasAdminAccess && isEducationTeam },
    
    { path: "/app/directory", icon: Users, label: "Directory", show: isSuperAdmin },
    { path: "/app/session-control", icon: Activity, label: "Session Control", show: isSuperAdmin },
  ].filter(item => item.show);

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
               <p className="text-[10px] text-green-600 uppercase font-bold tracking-widest">{isSuperAdmin ? "IT Super Admin" : (isDeptHead ? "Department Head" : currentUser.role)}</p>
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