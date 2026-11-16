import { Router, type IRouter } from "express";
import { CRM_HTML } from "../data/crm-html";

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
  res.type("html").send(CRM_HTML);
});

export default router;
