import { Router, type IRouter } from "express";
import { SUITS_CRM_HTML } from "../data/suits-crm-html";

const router: IRouter = Router();

// /suitscrm: the Suits in Social Media CRM for tracking new followers (solicitors). Only sent when the tools password is supplied.
router.get("/suits-crm", (req, res) => {
  // Its own password so Rachel and Isabella can use it without the main tools login. Set SUITS_CRM_PASSWORD to change it.
  const suitsPassword = (process.env.SUITS_CRM_PASSWORD || "legal").trim().toLowerCase();
  const submitted = String(req.header("x-suits-password") ?? "").trim().toLowerCase();
  const toolsPassword = process.env.APP_PASSWORD?.trim().toLowerCase();
  const toolsSubmitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  const allowed = submitted === suitsPassword || (!!toolsPassword && toolsSubmitted === toolsPassword);
  if (!allowed) {
    return res.status(401).json({ error: "That password is not right." });
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(SUITS_CRM_HTML);
});

export default router;
