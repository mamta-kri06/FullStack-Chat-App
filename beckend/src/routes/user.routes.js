import express from "express";
import { checkAuth, updateProfile } from "../controllers/user.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.put("/updateProfile", protectRoute, updateProfile);
router.get("/checkAuth", protectRoute, checkAuth);

export default router;
