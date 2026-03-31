import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carouselRouter from "./carousel";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carouselRouter);

export default router;
