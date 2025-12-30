import express from "express";
import {
  getMessages,
  getUsersForSideBar,
  sendMessage,
  editMessage,
  deleteMessage,
  clearMessages,
  markViewOnceViewed,
} from "../controllers/message.controllers.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/users", protectRoute, getUsersForSideBar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.put("/edit/:messageId", protectRoute, editMessage);
router.delete("/delete/:messageId", protectRoute, deleteMessage);
router.delete("/clear/:id", protectRoute, clearMessages);
router.post("/view-once/:messageId", protectRoute, markViewOnceViewed);

export default router;
