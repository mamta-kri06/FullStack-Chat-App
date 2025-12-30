import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const [isTyping, setIsTyping] = useState(false);
  const { selectedUser, setSelectedUser, clearMessages } = useChatStore();
  const { onlineUsers, socket } = useAuthStore();
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleTyping = ({ from }) => {
      // console.log("userTyping received", from);
      if (from === selectedUser._id) {
        setIsTyping(true);
      }
    };

    const handleStopTyping = ({ from }) => {
      // console.log("userStopTyping received", from);
      if (from === selectedUser._id) {
        setIsTyping(false);
      }
    };

    socket.on("userTyping", handleTyping);
    socket.on("userStopTyping", handleStopTyping);

    return () => {
      socket.off("userTyping", handleTyping);
      socket.off("userStopTyping", handleStopTyping);
    };
  }, [socket, selectedUser]);

  useEffect(() => {
    setIsTyping(false);
  }, [selectedUser]);

  const clearChatHandler = async () => {
    const ok = window.confirm("Clear all messages?");
    if (!ok) return;

    await clearMessages();
  };
  const formatLastSeen = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const min = Math.floor(diff / 60000);

    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    return `${Math.floor(hr / 24)} days ago`;
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={
                  selectedUser.profilePic ||
                  "https://static.thenounproject.com/png/363640-200.png"
                }
                alt={selectedUser.fullName}
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>

            <p className="text-sm text-base-content/70">
              {onlineUsers?.includes(selectedUser._id)
                ? "Online"
                : `Last seen ${formatLastSeen(selectedUser.lastSeen)}`}
            </p>
          </div>
        </div>
        {isTyping && (
          <p className="text-xs text-zinc-400 ml-2">
            {selectedUser.fullName.split(" ")[0]} is typing...
          </p>
        )}
        {/* Close button */}
        <button onClick={() => setSelectedUser(null)}>
          <X />
        </button>
        <button className="btn btn-error btn-sm" onClick={clearChatHandler}>
          Clear Chat
        </button>
      </div>
    </div>
  );
};
export default ChatHeader;
