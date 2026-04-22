import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/auth/verify", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return res.json({ valid: true });
  }
  if (password.trim() === appPassword.trim()) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, error: "Incorrect password" });
});

export default router;
