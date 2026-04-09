import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/auth-gate";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SingleImage from "@/pages/single-image";
import Presets from "@/pages/presets";
import CaptionLibrary from "@/pages/caption-library";
import Calendar from "@/pages/calendar";
import Analytics from "@/pages/analytics";
import Approval from "@/pages/approval";
import ApprovePublic from "@/pages/approve-public";

const queryClient = new QueryClient();

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/single-image" component={SingleImage} />
      <Route path="/presets" component={Presets} />
      <Route path="/captions" component={CaptionLibrary} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/approval" component={Approval} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [isPublic, publicParams] = useRoute("/approve/:token");

  if (isPublic && publicParams?.token) {
    return <ApprovePublic token={publicParams.token} />;
  }

  return (
    <AuthGate>
      <ProtectedRouter />
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
