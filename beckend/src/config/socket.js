import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.models.js";
import Message from "../models/message.models.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;
  if (userId) {
    // 🔥 PENDING MESSAGES KO DELIVERED KARO
    const undeliveredMessages = await Message.find({
      receiverId: userId,
      status: "sent",
    });

    const messageIds = undeliveredMessages.map((m) => m._id);

    if (messageIds.length > 0) {
      // DB update
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { status: "delivered" }
      );

      // sender ko notify
      undeliveredMessages.forEach((msg) => {
        const senderSocketId = getReceiverSocketId(msg.senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageDelivered", {
            messageId: msg._id,
          });
        }
      });
    }
  }
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // 🟢 TYPING
  socket.on("typing", ({ to, from }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { from });
    }
  });

  socket.on("stopTyping", ({ to, from }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStopTyping", { from });
    }
  });

  // 🔥 MESSAGE READ — YAHAN
  socket.on("messageRead", async ({ messageIds, senderId }) => {
    await Message.updateMany({ _id: { $in: messageIds } }, { status: "read" });
    // console.log("msgRead on server side");
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", { messageIds });
      // console.log("msgRead emitted to client");
    }
  });

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    await User.findByIdAndUpdate(userId, {
      lastSeen: new Date(),
    });
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
