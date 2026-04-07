"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZoneType = exports.Accessory = exports.HairStyle = exports.PresenceStatusEnum = void 0;
var PresenceStatusEnum;
(function (PresenceStatusEnum) {
    PresenceStatusEnum["AVAILABLE"] = "AVAILABLE";
    PresenceStatusEnum["BUSY"] = "BUSY";
    PresenceStatusEnum["IN_MEETING"] = "IN_MEETING";
    PresenceStatusEnum["FOCUS"] = "FOCUS";
    PresenceStatusEnum["LUNCH"] = "LUNCH";
    PresenceStatusEnum["BRB"] = "BRB";
    PresenceStatusEnum["OFFLINE"] = "OFFLINE";
})(PresenceStatusEnum || (exports.PresenceStatusEnum = PresenceStatusEnum = {}));
var HairStyle;
(function (HairStyle) {
    HairStyle["SHORT"] = "short";
    HairStyle["LONG"] = "long";
    HairStyle["CURLY"] = "curly";
    HairStyle["BALD"] = "bald";
    HairStyle["PONYTAIL"] = "ponytail";
    HairStyle["MOHAWK"] = "mohawk";
    HairStyle["AFRO"] = "afro";
    HairStyle["BUZZ"] = "buzz";
})(HairStyle || (exports.HairStyle = HairStyle = {}));
var Accessory;
(function (Accessory) {
    Accessory["GLASSES"] = "glasses";
    Accessory["HEADPHONES"] = "headphones";
    Accessory["HAT"] = "hat";
    Accessory["EARBUDS"] = "earbuds";
    Accessory["NONE"] = "none";
})(Accessory || (exports.Accessory = Accessory = {}));
var ZoneType;
(function (ZoneType) {
    ZoneType["COMMON"] = "common";
    ZoneType["MEETING"] = "meeting";
    ZoneType["FOCUS"] = "focus";
    ZoneType["SOCIAL"] = "social";
    ZoneType["PRIVATE"] = "private";
})(ZoneType || (exports.ZoneType = ZoneType = {}));
//# sourceMappingURL=office.types.js.map