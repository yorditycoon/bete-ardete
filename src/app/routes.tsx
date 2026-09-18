import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/layout/main-layout";
import { LoginPage } from "./pages/login-page";
import { MemberDashboard } from "./pages/member-dashboard";
import { ParentDashboard } from "./pages/parent-dashboard";
import { AdminDashboard } from "./pages/admin-dashboard";
import { BibleReading } from "./pages/bible-reading";
import { QuizPage } from "./pages/quiz-page";
import { CalendarPage } from "./pages/calendar-page";

// NEW: Import the Education Workspace
import { EducationWorkspace } from "./pages/education-workspace";

import { QuestionsPage } from "./pages/questions-page";
import { AttendancePage } from "./pages/attendance-page";
import { FamilyActivities } from "./pages/family-activities";
import { FamilyManagement } from "./pages/family-management";
import { ProfileSettings } from "./pages/ProfileSettings";
import { MemberDirectory } from "./pages/MemberDirectory";
import { SessionControl } from "./pages/SessionControl";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/app",
    Component: MainLayout,
    children: [
      { path: "member-dashboard", Component: MemberDashboard },
      { path: "parent-dashboard", Component: ParentDashboard },
      { path: "admin-dashboard", Component: AdminDashboard }, 
      { path: "bible", Component: BibleReading },
      { path: "quiz", Component: QuizPage },
      { path: "calendar", Component: CalendarPage },
      { path: "family-management", Component: FamilyManagement },
      
      // REPLACED admin-controls with education-workspace
      { path: "education-workspace", Component: EducationWorkspace },
      
      { path: "questions", Component: QuestionsPage },
      { path: "attendance", Component: AttendancePage },
      { path: "family-activities", Component: FamilyActivities },
      { path: "directory", Component: MemberDirectory },
      { path: "profile", Component: ProfileSettings },
      { path: "session-control", Component: SessionControl }
    ],
  },
]);