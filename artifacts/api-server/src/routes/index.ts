import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import carouselRouter from "./carousel";
import contentRouter from "./content";
import presetsRouter from "./presets";
import captionsRouter from "./captions";
import calendarRouter from "./calendar";
import analyticsRouter from "./analytics";
import approvalRouter from "./approval";
import metaRouter from "./meta";
import metaAuthRouter from "./meta-auth";
import videoOverlayRouter from "./video-overlay";
import portalRouter from "./portal";
import schedulerRouter from "./scheduler";
import libraryRouter from "./library";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(carouselRouter);
router.use(contentRouter);
router.use(presetsRouter);
router.use(captionsRouter);
router.use(calendarRouter);
router.use(analyticsRouter);
router.use(approvalRouter);
router.use(metaRouter);
router.use(metaAuthRouter);
router.use(videoOverlayRouter);
router.use(portalRouter);
router.use(schedulerRouter);
router.use(libraryRouter);

export default router;
