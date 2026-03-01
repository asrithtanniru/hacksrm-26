import ApiService from './ApiService';

class VoiceChatService {
  constructor() {
    this.room = null;
    this.connected = false;
    this.roomName = null;
    this.activeCharacterId = null;
    this.livekitClient = null;
    this.remoteAudioElements = new Map();
    this.livekitUrl = null;
    this.prelaunchedSession = null;
  }

  get isConnected() {
    return this.connected;
  }

  _buildIdentity(playerName) {
    const safePlayerName = (playerName || 'Subject-0')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `subject-${safePlayerName || 'subject'}-${Date.now()}`;
  }

  primeLaunchSession(session) {
    this.prelaunchedSession = session
      ? {
          ...session,
          userToken: session.userToken || session.token || null,
        }
      : null;
  }

  async loadLivekitClient() {
    if (this.livekitClient) {
      return this.livekitClient;
    }

    try {
      const module = await import('livekit-client');
      if (module && module.Room) {
        this.livekitClient = module;
        return this.livekitClient;
      }
    } catch (_) {
      // Fallback to UMD loading if package import is unavailable in current setup.
    }

    if (window.LivekitClient || window.LiveKitClient) {
      this.livekitClient = window.LivekitClient || window.LiveKitClient;
      return this.livekitClient;
    }

    await this.injectLivekitScript();

    if (window.LivekitClient || window.LiveKitClient) {
      this.livekitClient = window.LivekitClient || window.LiveKitClient;
      return this.livekitClient;
    }

    throw new Error('LiveKit client failed to load. Check internet/CDN access and refresh.');
  }

  async injectLivekitScript() {
    const existing = document.querySelector('script[data-livekit-client="true"]');
    if (existing) {
      if (existing.dataset.loaded === 'true') return;
      await new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('LiveKit UMD script failed to load')), { once: true });
      });
      return;
    }

    const candidateUrls = [
      'https://unpkg.com/livekit-client@2.17.2/dist/livekit-client.umd.js',
      'https://cdn.jsdelivr.net/npm/livekit-client@2.17.2/dist/livekit-client.umd.js',
      'https://unpkg.com/livekit-client/dist/livekit-client.umd.js',
    ];

    let lastError = null;
    for (const url of candidateUrls) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.async = true;
          script.dataset.livekitClient = 'true';
          script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
          };
          script.onerror = () => reject(new Error(`LiveKit UMD script failed: ${url}`));
          document.head.appendChild(script);
        });

        if (window.LivekitClient || window.LiveKitClient) {
          return;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('LiveKit UMD script failed to load');
  }

  _attachTrackListeners() {
    this.room.on('trackSubscribed', (track) => {
      if (track.kind !== 'audio') return;
      const element = track.attach();
      element.autoplay = true;
      element.dataset.livekitAudio = 'true';
      document.body.appendChild(element);
      this.remoteAudioElements.set(track.sid, element);
    });

    this.room.on('trackUnsubscribed', (track) => {
      if (track.kind !== 'audio') return;
      const element = this.remoteAudioElements.get(track.sid);
      if (element) {
        try {
          track.detach(element);
        } catch (_) {}
        element.remove();
        this.remoteAudioElements.delete(track.sid);
      }
    });
  }

  async ensureConnected({ roomName, playerName, initialCharacterId }) {
    const lk = await this.loadLivekitClient();
    const safePlayerName = playerName || 'Subject-0';

    if (this.connected && this.room && this.roomName === roomName) {
      return;
    }

    if (this.connected) {
      await this.disconnect();
    }

    let launchResponse = null;
    const canUsePrelaunched = Boolean(
      this.prelaunchedSession
      && this.prelaunchedSession.roomName === roomName
      && this.prelaunchedSession.userToken
      && (this.prelaunchedSession.url || window.__LIVEKIT_URL__)
    );

    if (canUsePrelaunched) {
      launchResponse = {
        user_token: this.prelaunchedSession.userToken,
        livekit_url: this.prelaunchedSession.url || window.__LIVEKIT_URL__,
        url: this.prelaunchedSession.url || window.__LIVEKIT_URL__,
        room_name: this.prelaunchedSession.roomName,
        character_token: this.prelaunchedSession.characterToken,
      };
    } else {
      launchResponse = await ApiService.launchCharacterRoom({
        roomName,
        characterToken: initialCharacterId,
        userIdentity: this._buildIdentity(safePlayerName),
        userName: safePlayerName,
        replaceExistingDispatches: true,
      });
    }

    const token = launchResponse.user_token;
    const url = launchResponse.livekit_url || launchResponse.url || window.__LIVEKIT_URL__;
    this.livekitUrl = url;

    if (!url || !token) {
      throw new Error('Missing LiveKit url/token from backend launch response');
    }

    this.room = new lk.Room({
      adaptiveStream: true,
      dynacast: true,
    });

    this._attachTrackListeners();

    await this.room.connect(url, token);
    // Stay muted until the player explicitly starts speaking with a nearby character.
    await this.room.localParticipant.setMicrophoneEnabled(false);

    this.connected = true;
    this.roomName = roomName;
    this.activeCharacterId = null;
    this.prelaunchedSession = null;

    // Session starts disengaged. Talk button will enable engagement.
    await ApiService.setCharacterEngagement({
      roomName,
      engaged: false,
    });
  }

  async connectToCharacter({ roomName, characterId, playerName }) {
    await this.ensureConnected({
      roomName,
      playerName,
      initialCharacterId: characterId,
    });

    this.activeCharacterId = characterId;
    if (this.room?.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(true);
    }
    await ApiService.switchCharacter({ roomName, characterToken: characterId });
    await ApiService.setCharacterEngagement({
      roomName,
      engaged: true,
      characterToken: characterId,
    });
  }

  async pauseConversation() {
    if (!this.connected || !this.roomName) {
      this.activeCharacterId = null;
      return;
    }

    this.activeCharacterId = null;
    if (this.room?.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(false);
    }
    await ApiService.setCharacterEngagement({
      roomName: this.roomName,
      engaged: false,
    });
  }

  async disconnect() {
    const roomName = this.roomName;

    this.remoteAudioElements.forEach((element) => {
      element.remove();
    });
    this.remoteAudioElements.clear();

    if (this.connected && roomName) {
      try {
        await ApiService.setCharacterEngagement({
          roomName,
          engaged: false,
        });
      } catch (_) {}

      try {
        await ApiService.endCharacterRoom({
          roomName,
          closeRoom: true,
        });
      } catch (_) {}
    }

    if (this.room) {
      this.room.disconnect();
    }

    this.room = null;
    this.connected = false;
    this.roomName = null;
    this.activeCharacterId = null;
    this.livekitUrl = null;
  }
}

export default new VoiceChatService();
