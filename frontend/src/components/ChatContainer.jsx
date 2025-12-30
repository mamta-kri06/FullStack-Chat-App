import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import { MessageInput } from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../utils/time";
import { axiosInstance } from "../utils/axios";

const ChatContainer = () => {
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [viewOnceImage, setViewOnceImage] = useState(null);

  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    editMessage,
    deleteMessage,
  } = useChatStore();

  const { authUser, socket } = useAuthStore();
  const messageEndRef = useRef(null);

  /* ---------------- LOAD MESSAGES ---------------- */
  useEffect(() => {
    if (!selectedUser?._id) return;
    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser?._id]);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- SOCKET: VIEW ONCE ---------------- */
  useEffect(() => {
    if (!socket) return;

    socket.on("viewOnceViewed", (messageId) => {
      useChatStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m._id === messageId ? { ...m, isViewed: true } : m
        ),
      }));
    });

    return () => socket.off("viewOnceViewed");
  }, [socket]);
  useEffect(() => {
    // console.log("selectedUser changed");

    if (!socket || !selectedUser) return;
    if (messages.length === 0) return; // messages load hone tak wait

    const unreadIds = messages
      .filter((m) => m.senderId === selectedUser._id && m.status !== "read")
      .map((m) => m._id);

    if (unreadIds.length) {
      console.log("msgRead emitted from client");
      socket.emit("messageRead", {
        messageIds: unreadIds,
        senderId: selectedUser._id,
      });
    }
  }, [messages, selectedUser, socket]);

  /* ---------------- VIEW ONCE CLICK ---------------- */
  const openViewOnce = async (message) => {
    if (message.isViewed) return;

    // 1️⃣ instant UI update
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) =>
        m._id === message._id ? { ...m, isViewed: true } : m
      ),
    }));

    // 2️⃣ image fullscreen
    setViewOnceImage(message.image);

    // 3️⃣ backend notify
    try {
      await axiosInstance.post(`/messages/view-once/${message._id}`);
    } catch (err) {
      console.error("view once failed", err);
    }
  };

  /* ---------------- EDIT ---------------- */
  const handleEditSave = async (messageId) => {
    if (!editText.trim()) return;
    await editMessage(messageId, editText);
    setIsEditing(false);
    setActiveMessageId(null);
  };

  /* ---------------- DELETE ---------------- */
  const handleDelete = async (messageId) => {
    if (!window.confirm("Delete message?")) return;
    await deleteMessage(messageId);
    setActiveMessageId(null);
  };

  /* ---------------- LOADING ---------------- */
  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
            ref={messageEndRef}
            onClick={() => setActiveMessageId(message._id)}
            className={`chat cursor-pointer ${
              message.senderId === authUser._id ? "chat-end" : "chat-start"
            }`}
          >
            {/* avatar */}
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic
                      : selectedUser.profilePic
                  }
                />
              </div>
            </div>

            <div className="chat-header mb-1">
              <time className="text-xs opacity-50">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            <div className="chat-bubble flex flex-col gap-2">
              {/* ---------- VIEW ONCE IMAGE ---------- */}
              {message.image && message.isViewOnce ? (
                <div onClick={() => openViewOnce(message)}>
                  {!message.isViewed ? (
                    <div className="w-32 h-32 bg-zinc-700 flex flex-col items-center justify-center text-white rounded-md">
                      👁 Photo
                      <span className="text-xs">Tap to view</span>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-black/30 flex items-center justify-center text-xs text-white rounded-md">
                      Viewed
                    </div>
                  )}
                </div>
              ) : (
                message.image && (
                  <img src={message.image} className="rounded-md max-w-52" />
                )
              )}

              {/* ---------- TEXT ---------- */}
              {isEditing && activeMessageId === message._id ? (
                <div className="flex gap-2">
                  <input
                    className="input input-sm input-bordered w-full"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <button
                    className="btn btn-xs btn-success"
                    onClick={() => handleEditSave(message._id)}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p>{message.text}</p>
              )}
              {message.status === "sent" && "✓"}
              {message.status === "delivered" && "✓✓"}
              {message.status === "read" && (
                <span className="text-blue-500">✓✓</span>
              )}

              {/* ---------- ACTIONS ---------- */}
              {activeMessageId === message._id &&
                message.senderId === authUser._id &&
                !isEditing && (
                  <div className="flex gap-3 text-xs opacity-70">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setEditText(message.text);
                      }}
                    >
                      Edit
                    </button>
                    <button onClick={() => handleDelete(message._id)}>
                      Delete
                    </button>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      <MessageInput />

      {/* ---------- VIEW ONCE MODAL ---------- */}
      {viewOnceImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setViewOnceImage(null)}
        >
          <img src={viewOnceImage} className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
};

export default ChatContainer;
