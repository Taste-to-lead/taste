import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Listings from "@/pages/listings";
import Settings from "@/pages/settings";
import Consumer from "@/pages/consumer";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import MyTaste from "@/pages/my-taste";
import AdminImport from "@/pages/admin-import";
import PortfolioPage from "@/pages/portfolio";
import FeedPage from "@/pages/feed";
import MePage from "@/pages/me";
import AgentLeadsPage from "@/pages/agent-leads";
import StagingLab from "@/pages/StagingLab";

function AgentLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 border-b border-border shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Consumer} />
      <Route path="/feed" component={FeedPage} />
      <Route path="/me" component={MePage} />
      <Route path="/staging" component={StagingLab} />
      <Route path="/login" component={Login} />
      <Route path="/agent">
        <ProtectedRoute>
          <AgentLayout><Dashboard /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/agent/listings">
        <ProtectedRoute>
          <AgentLayout><Listings /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/agent/settings">
        <ProtectedRoute>
          <AgentLayout><Settings /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/agent/leads">
        <ProtectedRoute>
          <AgentLayout><AgentLeadsPage /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute>
          <AgentLayout><Admin /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/import">
        <ProtectedRoute>
          <AgentLayout><AdminImport /></AgentLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portfolio/:agentId" component={PortfolioPage} />
      <Route path="/my-taste" component={MyTaste} />
      <Route path="/discover">
        <Redirect to="/" />
      </Route>
      <Route path="/dashboard">
        <Redirect to="/agent" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
