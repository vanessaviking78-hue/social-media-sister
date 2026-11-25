import { Router, type IRouter } from "express";
import { SUITS_CRM_HTML } from "../data/suits-crm-html";

const router: IRouter = Router();

// /suitscrm: the Suits in Social Media CRM for tracking new followers (solicitors). Only sent when the tools password is supplied.
router.get("/suits-crm", (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const submitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
    if (submitted !== appPassword.trim().toLowerCase()) {
      return res.status(401).json({ error: "Please log in to your tools first." });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(SUITS_CRM_HTML);
});

export default router;
