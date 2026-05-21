import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/auth-gate";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SingleImage from "@/pages/single-image";
import Stories from "@/pages/stories";
import Presets from "@/pages/presets";
import CaptionLibrary from "@/pages/caption-library";
import Calendar from "@/pages/calendar";
import Analytics from "@/pages/analytics";
import Approval from "@/pages/approval";
import ApprovePublic from "@/pages/approve-public";
import ClientPortal from "@/pages/client-portal";
import MetaOAuthResult from "@/pages/meta-oauth-result";
import Reels from "@/pages/reels";
import VideoOverlay from "@/pages/video-overlay";
import Scheduler from "@/pages/scheduler";

const queryClient = new QueryClient();

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/single-image" component={SingleImage} />
      <Route path="/stories" component={Stories} />
      <Route path="/presets" component={Presets} />
      <Route path="/captions" component={CaptionLibrary} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/approval" component={Approval} />
      <Route path="/reels" component={Reels} />
      <Route path="/video-overlay" component={VideoOverlay} />
      <Route path="/scheduler" component={Scheduler} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [isApprove, approveParams] = useRoute("/approve/:token");
  const [isPortal, portalParams] = useRoute("/portal/:token");
  const [isMetaOAuth] = useRoute("/oauth/meta/result");

  if (isMetaOAuth) {
    return <MetaOAuthResult />;
  }
  if (isPortal && portalParams?.token) {
    return <ClientPortal token={portalParams.token} />;
  }
  if (isApprove && approveParams?.token) {
    return <ApprovePublic token={approveParams.token} />;
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
