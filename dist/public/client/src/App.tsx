import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Hierarchy from "@/pages/hierarchy";
import HierarchyManagement from "@/pages/hierarchy-management";
import CSVUpload from "@/pages/csv-upload";
import Analytics from "@/pages/Analytics";
import Subscription from "@/pages/Subscription";
import AuthPage from "@/pages/auth-page";
import Header from "@/components/Header";
import { AuthProvider } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        {children}
      </main>
    </>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Switch>
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route path="/">
          <ProtectedLayout>
            <Home />
          </ProtectedLayout>
        </Route>
        <Route path="/hierarchy">
          <ProtectedLayout>
            <Hierarchy />
          </ProtectedLayout>
        </Route>
        <Route path="/hierarchy-management">
          <ProtectedLayout>
            <HierarchyManagement />
          </ProtectedLayout>
        </Route>
        <Route path="/csv-upload">
          <ProtectedLayout>
            <CSVUpload />
          </ProtectedLayout>
        </Route>
        <Route path="/analytics">
          <ProtectedLayout>
            <Analytics />
          </ProtectedLayout>
        </Route>
        <Route path="/subscription">
          <ProtectedLayout>
            <Subscription />
          </ProtectedLayout>
        </Route>
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
