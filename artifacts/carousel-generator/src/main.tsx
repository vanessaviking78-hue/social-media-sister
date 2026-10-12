import { createRoot } from "react-dom/client";
import App from "./App";
import { initSharedFonts } from "@/lib/shared-fonts";
import "./index.css";

// Load every uploaded and Envato font into the shared font lists first, so each tool
// opens with them already in its pickers.
initSharedFonts().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
