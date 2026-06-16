import { Switch, Route, Router as WouterRouter, useRoute, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/auth-gate";
import NotFound from "@/pages/not-found";
import Hub from "@/pages/hub";
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
import Library from "@/pages/library";
import BulkConnectReview from "@/pages/bulk-connect-review";
import About from "@/pages/about";
import AboutMe from "@/pages/about-me";
import SeamlessCarousel from "@/pages/seamless-carousel";
import AiPortraitStudio from "@/pages/ai-portrait-studio";
import Onboard from "@/pages/onboard";
import OnboardChoosePage from "@/pages/onboard-choose-page";
import OnboardSuccess from "@/pages/onboard-success";
import DmAutomations from "@/pages/dm-automations";
import Intake from "@/pages/intake";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import DataDeletion from "@/pages/data-deletion";
import Splash from "@/pages/splash";
import BulkImportTemplates from "@/pages/bulk-import-templates";
import DmPrompts from "@/pages/dm-prompts";
import ReelScripts from "@/pages/reel-scripts";
import Podcast from "@/pages/podcast";
import Competition from "@/pages/competition";
import BundleBuilder from "@/pages/bundle-builder";
import BundlePreview from "@/pages/bundle-preview";
import BundleRequest from "@/pages/bundle-request";
import BundleRequestsDashboard from "@/pages/bundle-requests-dashboard";
import FounderSignup from "@/pages/founder-signup";
import FounderWelcome from "@/pages/founder-welcome";
import StrategyLibrary from "@/pages/strategy-library";
import PhotoCarousel from "@/pages/photo-carousel";
import Brand from "@/pages/brand";
import UploadSchedule from "@/pages/upload-schedule";
import BulkCarousel from "@/pages/bulk-carousel";
import BulkStories from "@/pages/bulk-stories";
import CsvSlideCarousel from "@/pages/csv-slide-carousel";
import ContentPreview from "@/pages/content-preview";
import PreviewIndex from "@/pages/preview-index";
import Settings from "@/pages/settings";
import CanvaOAuthResult from "@/pages/canva-oauth-result";
import ApprovalBundles from "@/pages/approval-bundles";
import ClientApproval from "@/pages/client-approval";

const queryClient = new QueryClient();

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/hub" component={Hub} />
      <Route path="/carousel" component={Home} />
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
      <Route path="/library" component={Library} />
      <Route path="/presets/bulk-connect/review" component={BulkConnectReview} />
      <Route path="/about" component={About} />
      <Route path="/about-me" component={AboutMe} />
      <Route path="/seamless-carousel" component={SeamlessCarousel} />
      <Route path="/ai-portrait-studio" component={AiPortraitStudio} />
      <Route path="/dm-automations" component={DmAutomations} />
      <Route path="/intake" component={Intake} />
      <Route path="/dm-prompts" component={DmPrompts} />
      <Route path="/reel-scripts" component={ReelScripts} />
      <Route path="/bundle-builder" component={BundleBuilder} />
      <Route path="/bundle-requests" component={BundleRequestsDashboard} />
      <Route path="/strategy-library" component={StrategyLibrary} />
      <Route path="/photo-carousel" component={PhotoCarousel} />
      <Route path="/brand" component={Brand} />
      <Route path="/upload-schedule" component={UploadSchedule} />
      <Route path="/bulk-carousel" component={BulkCarousel} />
      <Route path="/bulk-stories" component={BulkStories} />
      <Route path="/csv-slide-carousel" component={CsvSlideCarousel} />
      <Route path="/preview" component={PreviewIndex} />
      <Route path="/settings" component={Settings} />
      <Route path="/approval-bundles" component={ApprovalBundles} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [isClientApproval, clientApprovalParams] = useRoute("/client-approval/:token");
  const [isApprove, approveParams] = useRoute("/approve/:token");
  const [isPortal, portalParams] = useRoute("/portal/:token");
  const [isMetaOAuth] = useRoute("/oauth/meta/result");
  const [isCanvaOAuth] = useRoute("/oauth/canva/result");
  const [isOnboardSuccess, onboardSuccessParams] = useRoute("/onboard/:token/success");
  const [isOnboardChoose, onboardChooseParams] = useRoute("/onboard/:token/choose-page");
  const [isOnboard, onboardParams] = useRoute("/onboard/:token");
  const [isPrivacy] = useRoute("/privacy");
  const [isTerms] = useRoute("/terms");
  const [isDataDeletion] = useRoute("/data-deletion");
  const [isBulkTemplates] = useRoute("/bulk-import-templates");
  const [isPodcast] = useRoute("/podcast");
  const [isCompetition] = useRoute("/competition");
  const [isBundle, bundleParams] = useRoute("/bundle/:token");
  const [isFounderSignup] = useRoute("/founder-signup");
  const [isFounderWelcome] = useRoute("/founder-welcome");
  const [isTrialBundle] = useRoute("/trialbundle");
  const [isContentPreview, contentPreviewParams] = useRoute("/preview/:clientSlug");
  const [location] = useLocation();
  const isSplash = location === "/";

  if (isMetaOAuth) {
    return <MetaOAuthResult />;
  }
  if (isCanvaOAuth) {
    return <CanvaOAuthResult />;
  }
  if (isPortal && portalParams?.token) {
    return <ClientPortal token={portalParams.token} />;
  }
  if (isClientApproval && clientApprovalParams?.token) {
    return <ClientApproval token={clientApprovalParams.token} />;
  }
  if (isApprove && approveParams?.token) {
    return <ApprovePublic token={approveParams.token} />;
  }
  if (isOnboardSuccess && onboardSuccessParams?.token) {
    return <OnboardSuccess />;
  }
  if (isOnboardChoose && onboardChooseParams?.token) {
    return <OnboardChoosePage token={onboardChooseParams.token} />;
  }
  if (isOnboard && onboardParams?.token) {
    return <Onboard token={onboardParams.token} />;
  }
  if (isSplash) {
    return <Splash />;
  }
  if (isPrivacy) {
    return <Privacy />;
  }
  if (isTerms) {
    return <Terms />;
  }
  if (isDataDeletion) {
    return <DataDeletion />;
  }
  if (isBulkTemplates) {
    return <BulkImportTemplates />;
  }
  if (isPodcast) {
    return <Podcast />;
  }
  if (isCompetition) {
    return <Competition />;
  }
  if (isBundle && bundleParams?.token) {
    return <BundlePreview token={bundleParams.token} />;
  }
  if (isFounderSignup) {
    return <FounderSignup />;
  }
  if (isFounderWelcome) {
    return <FounderWelcome />;
  }
  if (isTrialBundle) {
    return <BundleRequest />;
  }
  if (isContentPreview && contentPreviewParams?.clientSlug) {
    return <ContentPreview clientSlug={contentPreviewParams.clientSlug} />;
  }

  return (
    <>
      <ProtectedRouter />
    </>
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
