export declare enum PresenceStatusEnum {
    AVAILABLE = "AVAILABLE",
    BUSY = "BUSY",
    IN_MEETING = "IN_MEETING",
    FOCUS = "FOCUS",
    LUNCH = "LUNCH",
    BRB = "BRB",
    OFFLINE = "OFFLINE"
}
export declare enum HairStyle {
    SHORT = "short",
    LONG = "long",
    CURLY = "curly",
    BALD = "bald",
    PONYTAIL = "ponytail",
    MOHAWK = "mohawk",
    AFRO = "afro",
    BUZZ = "buzz"
}
export declare enum Accessory {
    GLASSES = "glasses",
    HEADPHONES = "headphones",
    HAT = "hat",
    EARBUDS = "earbuds",
    NONE = "none"
}
export declare enum ZoneType {
    COMMON = "common",
    MEETING = "meeting",
    FOCUS = "focus",
    SOCIAL = "social",
    PRIVATE = "private"
}
export interface OfficeZone {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: ZoneType;
    color: string;
    icon: string;
    maxOccupancy: number | null;
}
export interface AvatarConfig {
    skinColor: string;
    hairStyle: HairStyle;
    hairColor: string;
    shirtColor: string;
    accessory: Accessory;
    emoji?: string;
}
export interface UserPresence {
    userId: string;
    firstName: string;
    lastName: string;
    status: PresenceStatusEnum;
    statusMessage?: string;
    currentZoneId?: string;
    positionX?: number;
    positionY?: number;
    isCheckedIn: boolean;
    lastActivityAt: Date;
    avatar?: AvatarConfig;
}
export interface PresenceUpdatePayload {
    userId: string;
    firstName: string;
    lastName: string;
    status: PresenceStatusEnum;
    isCheckedIn: boolean;
    currentZoneId?: string;
    positionX?: number;
    positionY?: number;
    avatar?: AvatarConfig;
}
export interface UserJoinedPayload {
    userId: string;
    firstName: string;
    lastName: string;
    avatar?: AvatarConfig;
    currentZoneId?: string;
    positionX?: number;
    positionY?: number;
    timestamp: string;
}
export interface UserLeftPayload {
    userId: string;
    timestamp: string;
}
export interface UserMovedPayload {
    userId: string;
    fromZone?: string;
    toZone?: string;
    positionX: number;
    positionY: number;
}
export interface StatusChangedPayload {
    userId: string;
    oldStatus: PresenceStatusEnum;
    newStatus: PresenceStatusEnum;
    statusMessage?: string;
}
export interface ActivityFeedPayload {
    type: 'joined' | 'left' | 'moved' | 'status_changed' | 'check_in' | 'check_out';
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
}
export interface MovePayload {
    zoneId: string;
    positionX: number;
    positionY: number;
}
export interface ChangeStatusPayload {
    status: PresenceStatusEnum;
    statusMessage?: string;
}
//# sourceMappingURL=office.types.d.ts.map