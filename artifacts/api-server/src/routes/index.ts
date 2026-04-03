import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carouselRouter from "./carousel";
import contentRouter from "./content";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carouselRouter);
router.use(contentRouter);

export default router;
