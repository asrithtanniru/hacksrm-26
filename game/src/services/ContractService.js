const SELECTORS = {
  startChallenge: '0xe0a7b2c3',
  redeemMyRewards: '0xed112cd9',
  getPlayerProgress: '0xf635c69b',
};

const EMPTY_32 = ''.padStart(64, '0');

class ContractService {
  constructor() {
    this.contractAddress = process.env.GAME_CONTRACT_ADDRESS || '';
    this.expectedChainId = process.env.GAME_CHAIN_ID || process.env.CHAIN_ID || '';
  }

  setContractAddress(address) {
    if (address && /^0x[a-fA-F0-9]{40}$/.test(String(address).trim())) {
      this.contractAddress = String(address).trim();
    }
  }

  getProvider() {
    if (typeof window === 'undefined' || !window.pelagus) {
      throw new Error('Pelagus wallet is not detected.');
    }
    return window.pelagus;
  }

  async rpc(method, params = []) {
    const provider = this.getProvider();
    return provider.request({ method, params });
  }

  async rpcWithFallback(methods, params = []) {
    let lastError;
    for (const method of methods) {
      try {
        return await this.rpc(method, params);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`RPC methods failed: ${methods.join(', ')}`);
  }

  normalizeAddress(address) {
    const value = String(address || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error('Invalid address');
    }
    return value;
  }

  toPaddedAddress(address) {
    return this.normalizeAddress(address).replace(/^0x/, '').toLowerCase().padStart(64, '0');
  }

  decodeUint(wordHex) {
    return Number(BigInt(`0x${wordHex}`));
  }

  decodeBool(wordHex) {
    return BigInt(`0x${wordHex}`) !== 0n;
  }

  chunkWords(hexNoPrefix) {
    const words = [];
    for (let i = 0; i < hexNoPrefix.length; i += 64) {
      words.push(hexNoPrefix.slice(i, i + 64));
    }
    return words;
  }

  async getAddress() {
    const accounts = await this.rpcWithFallback(['quai_requestAccounts', 'eth_requestAccounts', 'quai_accounts', 'eth_accounts']);
    const address = Array.isArray(accounts) ? accounts[0] : null;
    if (!address) {
      throw new Error('No connected wallet account');
    }
    return this.normalizeAddress(address);
  }

  async ensureNetwork() {
    if (!this.expectedChainId) {
      return;
    }
    const chainIdHex = await this.rpcWithFallback(['quai_chainId', 'eth_chainId']);
    const current = chainIdHex ? parseInt(chainIdHex, 16).toString() : '';
    if (String(current) !== String(this.expectedChainId)) {
      throw new Error(`Wrong network. Expected chainId=${this.expectedChainId}, got chainId=${current}`);
    }
  }

  async sendTransaction(data) {
    const from = await this.getAddress();
    const to = this.normalizeAddress(this.contractAddress);
    const tx = {
      from,
      to,
      data,
      value: '0x0',
    };
    return this.rpcWithFallback(['quai_sendTransaction', 'eth_sendTransaction'], [tx]);
  }

  async waitForReceipt(txHash, timeoutMs = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const receipt = await this.rpcWithFallback(['quai_getTransactionReceipt', 'eth_getTransactionReceipt'], [txHash]);
      if (receipt) {
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error('Transaction confirmation timeout');
  }

  async startChallengeTx() {
    await this.ensureNetwork();
    if (!this.contractAddress) {
      throw new Error('Missing GAME_CONTRACT_ADDRESS');
    }
    const hash = await this.sendTransaction(SELECTORS.startChallenge);
    const receipt = await this.waitForReceipt(hash);
    return { hash, receipt };
  }

  async redeemRewardsTx() {
    await this.ensureNetwork();
    if (!this.contractAddress) {
      throw new Error('Missing GAME_CONTRACT_ADDRESS');
    }
    const hash = await this.sendTransaction(SELECTORS.redeemMyRewards);
    const receipt = await this.waitForReceipt(hash);
    return { hash, receipt };
  }

  async fetchProgress(playerAddress) {
    await this.ensureNetwork();
    if (!this.contractAddress) {
      throw new Error('Missing GAME_CONTRACT_ADDRESS');
    }
    const encodedPlayer = this.toPaddedAddress(playerAddress);
    const data = `${SELECTORS.getPlayerProgress}${encodedPlayer}`;
    const callPayload = {
      to: this.normalizeAddress(this.contractAddress),
      data,
    };
    const raw = await this.rpcWithFallback(['quai_call', 'eth_call'], [callPayload, 'latest']);
    if (!raw || !raw.startsWith('0x')) {
      throw new Error('Invalid getPlayerProgress response');
    }
    const words = this.chunkWords(raw.replace(/^0x/, '').padEnd(64 * 7, '0'));
    if (words.length < 7) {
      throw new Error('Unexpected getPlayerProgress shape');
    }
    return {
      challengeStartedAt: this.decodeUint(words[0] || EMPTY_32),
      challengeEndsAt: this.decodeUint(words[1] || EMPTY_32),
      npcTalks: this.decodeUint(words[2] || EMPTY_32),
      rewardPoints: this.decodeUint(words[3] || EMPTY_32),
      completed: this.decodeBool(words[4] || EMPTY_32),
      expired: this.decodeBool(words[5] || EMPTY_32),
      claimableUnits: this.decodeUint(words[6] || EMPTY_32),
    };
  }
}

export default new ContractService();
