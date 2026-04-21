const AppState = {
  currentUser: null,
  currentRoomId: null,
  isHost: false,
  isRegistering: false,
  usersCache: new Map(),
  roomsCache: new Map(),
  activeSubscriptions: [],
  roomSubscriptions: [],
  currentPresenceCache: {},
  rtc: {
    localStream: null,
    sessionId: null,
    peerConnections: new Map(),
    audioElements: new Map(),
    voiceParticipantsCache: {}
  },
  currentDirectChat: null,
  usersListRenderToken: 0,
  inviteCooldowns: new Map(),
  admin: {
    settings: {
      roomCreationBlocked: false
    },
    lastAnnouncementId: null
  }
};

export { AppState };
