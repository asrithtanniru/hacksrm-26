class ApiService {
  constructor() {
    const isHttps = window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('Using GitHub Codespaces');
      const currentHostname = window.location.hostname;
      this.apiUrl = `https://${currentHostname.replace('8080', '8000')}`;
    } else {
      this.apiUrl = 'http://localhost:8000';
    }
  }

  async request(endpoint, method, data) {
    const url = `${this.apiUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    };

    const response = await fetch(url, options);
    
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.detail ? ` - ${body.detail}` : '';
      } catch (_) {
        // ignore body parse failure
      }
      throw new Error(`API error: ${response.status} ${response.statusText}${detail}`);
    }
    
    return response.json();
  }

  async sendMessage(character, message) {
    try {
      const data = await this.request('/chat', 'POST', {
        message,
        character_id: character.id
      });
      
      return data.response;
    } catch (error) {
      console.error('Error sending message to API:', error);
      return this.getFallbackResponse(character);
    }
  }

  async createLivekitToken({
    roomName,
    identity,
    name,
    metadata,
    ttlMinutes = 60,
  }) {
    return this.request('/livekit/token', 'POST', {
      room_name: roomName,
      identity,
      name,
      metadata,
      can_publish: true,
      can_subscribe: true,
      can_publish_data: true,
      ttl_minutes: ttlMinutes,
    });
  }

  async launchCharacterRoom({
    roomName,
    characterToken,
    userIdentity,
    userName,
    ttlMinutes = 60,
    replaceExistingDispatches = true,
  }) {
    return this.request('/livekit/character/launch', 'POST', {
      room_name: roomName,
      character_token: characterToken,
      agent_name: 'npc-router',
      replace_existing_dispatches: replaceExistingDispatches,
      user_identity: userIdentity,
      user_name: userName,
      ttl_minutes: ttlMinutes,
    });
  }

  async switchCharacter({ roomName, characterToken }) {
    return this.request('/livekit/character/switch', 'POST', {
      room_name: roomName,
      character_token: characterToken,
      mode: 'signal',
      agent_name: 'npc-router',
    });
  }

  async setCharacterEngagement({ roomName, engaged, characterToken = null }) {
    return this.request('/livekit/character/engagement', 'POST', {
      room_name: roomName,
      engaged: Boolean(engaged),
      character_token: characterToken,
    });
  }

  async endCharacterRoom({ roomName, closeRoom = true, dispatchId = null }) {
    return this.request('/livekit/character/end', 'POST', {
      room_name: roomName,
      close_room: Boolean(closeRoom),
      dispatch_id: dispatchId,
    });
  }

  async listLivekitCharacters() {
    try {
      return await this.request('/livekit/characters', 'GET');
    } catch (_) {
      // Backward compatibility if an older backend exposes unprefixed route.
      return this.request('/characters', 'GET');
    }
  }

  async startGameChallenge(payload) {
    return this.request('/game/challenge/start', 'POST', payload);
  }

  async recordNpcTalk(payload) {
    return this.request('/game/challenge/npc-talk', 'POST', payload);
  }

  async claimGameReward(payload) {
    return this.request('/game/challenge/claim', 'POST', payload);
  }

  getFallbackResponse(character) {
    return `I'm sorry, ${character.name || 'the character'} is unavailable at the moment. Please try again later.`;
  }

  async resetMemory() {
    try {
      const response = await fetch(`${this.apiUrl}/reset-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset memory');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error resetting memory:', error);
      throw error;
    }
  }
}

export default new ApiService(); 
