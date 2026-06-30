import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sendTestEmail } from "../lib/notify";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

router.post("/notify/test", requireAuth, async (_req: Request, res: Response) => {
  const result = await sendTestEmail();
  if (result.ok) res.json(result);
  else res.status(500).json(result);
});

export default router;
