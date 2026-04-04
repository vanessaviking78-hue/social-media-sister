import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import carouselRouter from "./carousel";
import contentRouter from "./content";
import presetsRouter from "./presets";
import captionsRouter from "./captions";
import calendarRouter from "./calendar";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(carouselRouter);
router.use(contentRouter);
router.use(presetsRouter);
router.use(captionsRouter);
router.use(calendarRouter);
router.use(analyticsRouter);

export default router;
