import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carouselRouter from "./carousel";
import contentRouter from "./content";
import presetsRouter from "./presets";
import captionsRouter from "./captions";
import calendarRouter from "./calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carouselRouter);
router.use(contentRouter);
router.use(presetsRouter);
router.use(captionsRouter);
router.use(calendarRouter);

export default router;
