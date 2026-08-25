export var WsEvent;
(function (WsEvent) {
    WsEvent["CAMERA_STATUS_CHANGED"] = "camera.status_changed";
    WsEvent["DETECTION_CREATED"] = "detection.created";
    WsEvent["TRACKING_UPDATED"] = "tracking.updated";
    WsEvent["FACE_RECOGNIZED"] = "face.recognized";
    WsEvent["SECURITY_ALERT"] = "security.alert";
    WsEvent["EVENT_CREATED"] = "event.created";
    WsEvent["NOTIFICATION_SENT"] = "notification.sent";
    WsEvent["NOTIFICATION_FAILED"] = "notification.failed";
    WsEvent["SYSTEM_METRICS"] = "system.metrics";
})(WsEvent || (WsEvent = {}));
//# sourceMappingURL=websocket.js.map