import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carouselRouter from "./carousel";
import contentRouter from "./content";
import presetsRouter from "./presets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carouselRouter);
router.use(contentRouter);
router.use(presetsRouter);

export default router;
