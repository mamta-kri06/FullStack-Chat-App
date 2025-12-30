import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../utils/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isMessagesSendLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    set({ isMessagesSendLoading: true });
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesSendLoading: false });
    }
  },
  clearMessages: async () => {
    const { selectedUser } = get();
    try {
      await axiosInstance.delete(`/messages/clear/${selectedUser._id}`);

      // 💥 apni side instantly empty
      set({ messages: [] });
    } catch (error) {
      toast.error("Failed to clear chat");
    }
  },
  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.off("newMessage");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("chatCleared");
    socket.off("viewOnceViewed");
    socket.off("notification");
    socket.off("messageDelivered");
    socket.off("messageRead");
    // 1️⃣ new message
    socket.on("newMessage", (msg) => {
      if (msg.senderId === selectedUser._id) {
        set({ messages: [...get().messages, msg] });
        console.log("new msg received socket");
        socket.emit("messageRead", {
          messageIds: [msg._id],
          senderId: msg.senderId,
        });
      }
    });

    // 2️⃣ message edit
    socket.on("messageUpdated", (updatedMessage) => {
      set({
        messages: get().messages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        ),
      });
    });
    socket.on("messageDelivered", ({ messageId }) => {
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, status: "delivered" } : m
        ),
      });
    });
    socket.on("messageRead", ({ messageIds }) => {
      // console.log("msgRead received on client");
      set({
        messages: get().messages.map((m) =>
          messageIds.includes(m._id) ? { ...m, status: "read" } : m
        ),
      });
    });

    // 3️⃣ message delete
    socket.on("messageDeleted", (messageId) => {
      set({
        messages: get().messages.filter((m) => m._id !== messageId),
      });
    });

    // 4️⃣ chat clear
    socket.on("chatCleared", (fromUserId) => {
      if (selectedUser._id === fromUserId) {
        set({ messages: [] });
      }
    });

    // 5️⃣ view-once viewed ✅
    socket.on("viewOnceViewed", (messageId) => {
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, isViewed: true } : m
        ),
      });
    });

    socket.on("notification", (data) => {
      if (!selectedUser || data.senderId != selectedUser._id)
        toast(`New message from ${data.from.split(" ")[0]}`);
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
    socket?.off("messageUpdated");
    socket?.off("messageDeleted");
    socket?.off("chatCleared");
    socket?.off("viewOnceDeleted");
    socket?.off("viewOnceViewed");
    socket?.off("notification");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),

  editMessage: async (messageId, newText) => {
    try {
      const res = await axiosInstance.put(`/messages/edit/${messageId}`, {
        text: newText,
      });

      const updatedMessage = res.data;

      set({
        messages: get().messages.map((msg) =>
          msg._id === messageId ? updatedMessage : msg
        ),
      });
    } catch (error) {
      console.error("Edit message failed", error);
    }
  },

  // 🔹 DELETE MESSAGE
  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/delete/${messageId}`);

      set({
        messages: get().messages.filter((msg) => msg._id !== messageId),
      });
    } catch (error) {
      console.error("Delete message failed", error);
    }
  },
}));
