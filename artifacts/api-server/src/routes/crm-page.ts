import { Router, type IRouter } from "express";
import { CRM_HTML } from "../data/crm-html";
import { CRM_INSTAGRAM_JS } from "../data/crm-instagram-client";
import { CRM_TEAM_UI_JS } from "../data/crm-team-client";

const router: IRouter = Router();

// /crmpage: her CRM (pipeline, clients, follower lists, DM scripts). Only sent when the tools password is supplied.
router.get("/crm-page", (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const submitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
    if (submitted !== appPassword.trim().toLowerCase()) {
      return res.status(401).json({ error: "Please log in to your tools first." });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  // The Instagram layer (engagement badges, DM buttons, Instagram tab) is added on the way out so the big CRM page itself stays untouched.
  // The sales team layer (Leads, Scripts and Sales Team tabs) is added the same way.
  const extra = "<script>" + CRM_INSTAGRAM_JS + "</script><script>" + CRM_TEAM_UI_JS + "\nCT.addCrmTabs();</script>";
  const at = CRM_HTML.lastIndexOf("</body>");
  const page = at === -1 ? CRM_HTML + extra : CRM_HTML.slice(0, at) + extra + CRM_HTML.slice(at);
  res.type("html").send(page);
});

export default router;
