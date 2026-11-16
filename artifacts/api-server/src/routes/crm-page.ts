import { Router, type IRouter } from "express";
import { CRM_HTML } from "../data/crm-html";
import { CRM_INSTAGRAM_JS } from "../data/crm-instagram-client";

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
  const at = CRM_HTML.lastIndexOf("</body>");
  const page = at === -1 ? CRM_HTML + "<script>" + CRM_INSTAGRAM_JS + "</script>" : CRM_HTML.slice(0, at) + "<script>" + CRM_INSTAGRAM_JS + "</script>" + CRM_HTML.slice(at);
  res.type("html").send(page);
});

export default router;
