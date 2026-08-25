export var EventType;
(function (EventType) {
    EventType["MOTION"] = "MOTION";
    EventType["PERSON_DETECTED"] = "PERSON_DETECTED";
    EventType["UNKNOWN_PERSON"] = "UNKNOWN_PERSON";
    EventType["KNOWN_PERSON"] = "KNOWN_PERSON";
    EventType["RESTRICTED_ZONE"] = "RESTRICTED_ZONE";
    EventType["VEHICLE_DETECTED"] = "VEHICLE_DETECTED";
    EventType["SECURITY_ALERT"] = "SECURITY_ALERT";
})(EventType || (EventType = {}));
export var EventStatus;
(function (EventStatus) {
    EventStatus["NEW"] = "NEW";
    EventStatus["REVIEWED"] = "REVIEWED";
    EventStatus["DISMISSED"] = "DISMISSED";
})(EventStatus || (EventStatus = {}));
//# sourceMappingURL=event.js.map