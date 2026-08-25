export var CameraStatus;
(function (CameraStatus) {
    CameraStatus["ONLINE"] = "ONLINE";
    CameraStatus["OFFLINE"] = "OFFLINE";
    CameraStatus["CONNECTING"] = "CONNECTING";
    CameraStatus["ERROR"] = "ERROR";
    CameraStatus["DISABLED"] = "DISABLED";
})(CameraStatus || (CameraStatus = {}));
export var ConnectionType;
(function (ConnectionType) {
    ConnectionType["RTSP"] = "RTSP";
    ConnectionType["ONVIF"] = "ONVIF";
    ConnectionType["FILE"] = "FILE";
    ConnectionType["WEBCAM"] = "WEBCAM";
})(ConnectionType || (ConnectionType = {}));
//# sourceMappingURL=camera.js.map