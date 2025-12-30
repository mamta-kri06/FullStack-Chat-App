import cloudinary from "../config/cloudinary.js";
import { getReceiverSocketId } from "../config/socket.js";
import Message from "../models/message.models.js";
import User from "../models/user.models.js";
import { io } from "../config/socket.js";
export const getUsersForSideBar = async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUser },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUserForSideBar", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in get messages controller", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const clearMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // 🔥 SOCKET EMIT TO OTHER USER
    const receiverSocketId = getReceiverSocketId(userToChatId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatCleared", myId);
    }

    res.status(200).json({ message: "Chat cleared" });
  } catch (error) {
    console.error("Clear chat error", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, isViewOnce = false } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      isViewOnce: isViewOnce || false,
      status: "sent",
    });
    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    const senderSocketId = getReceiverSocketId(senderId);

    if (receiverSocketId) {
      newMessage.status = "delivered";
      await newMessage.save();

      // receiver ko msg
      io.to(receiverSocketId).emit("newMessage", newMessage);

      // 🔥 sender ko delivered tick
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", {
          messageId: newMessage._id,
        });
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in send message controller", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
// export const viewOnceMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const userId = req.user._id;

//     const message = await Message.findById(messageId);
//     if (!message) {
//       return res.status(404).json({ message: "Message not found" });
//     }

//     // 🔐 only receiver can view
//     if (message.receiverId.toString() !== userId.toString()) {
//       return res.status(403).json({ message: "Not allowed" });
//     }

//     // ❌ not view once
//     if (!message.isViewOnce) {
//       return res.status(400).json({ message: "Not a view-once message" });
//     }

//     const imageUrl = message.image;

//     // 🔥 DELETE AFTER VIEW
//     await message.deleteOne();

//     // 🔥 delete everywhere (sender + receiver)
//     const receiverSocketId = getReceiverSocketId(message.senderId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("viewOnceDeleted", messageId);
//     }

//     io.to(req.user._id.toString()).emit("viewOnceDeleted", messageId);

//     res.status(200).json({ image: imageUrl });
//   } catch (error) {
//     res.status(500).json({ message: "View once failed" });
//   }
// };
export const markViewOnceViewed = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Not found" });

    if (!message.isViewOnce) {
      return res.status(400).json({ message: "Not view once message" });
    }

    if (message.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (message.isViewed) {
      return res.status(200).json(message);
    }

    message.isViewed = true;
    await message.save();

    // 🔥 sender ko notify
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("viewOnceViewed", message._id);
    }

    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ message: "View once failed" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // 🔐 Only sender can edit
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageUpdated", message);
    }
    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: "Edit failed" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // 🔐 Only sender can delete
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await message.deleteOne();
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", message._id);
    }
    res.status(200).json({ message: "Message deleted", messageId });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};
