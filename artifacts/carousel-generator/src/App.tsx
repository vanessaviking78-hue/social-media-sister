import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/auth-gate";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BeforeAfter from "@/pages/before-after";
import SingleImage from "@/pages/single-image";
import Presets from "@/pages/presets";
import CaptionLibrary from "@/pages/caption-library";
import Calendar from "@/pages/calendar";
import Analytics from "@/pages/analytics";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/before-after" component={BeforeAfter} />
      <Route path="/single-image" component={SingleImage} />
      <Route path="/presets" component={Presets} />
      <Route path="/captions" component={CaptionLibrary} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthGate>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
