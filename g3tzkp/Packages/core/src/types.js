// Complete type definitions - NO STUBS
export var NodeType;
(function (NodeType) {
    NodeType["MOBILE"] = "mobile";
    NodeType["DESKTOP"] = "desktop";
    NodeType["PWA"] = "pwa";
    NodeType["RELAY"] = "relay";
    NodeType["VERIFIER"] = "verifier";
})(NodeType || (NodeType = {}));
export var NetworkMode;
(function (NetworkMode) {
    NetworkMode["LOCAL_P2P"] = "local_p2p";
    NetworkMode["IPFS_PUBSUB"] = "ipfs_pubsub";
    NetworkMode["HYBRID"] = "hybrid";
    NetworkMode["OFFLINE"] = "offline";
})(NetworkMode || (NetworkMode = {}));
export var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["FILE"] = "file";
    MessageType["IMAGE"] = "image";
    MessageType["AUDIO"] = "audio";
    MessageType["VIDEO"] = "video";
    MessageType["SYSTEM"] = "system";
})(MessageType || (MessageType = {}));
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (MessageStatus = {}));
