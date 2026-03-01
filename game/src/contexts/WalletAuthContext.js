class WalletAuthContext {
    constructor() {
        this.state = {
            isPelagusInstalled: false,
            isConnected: false,
            address: null
        };
        this.listeners = new Set();
        this.isInitialized = false;
        this.accountsChangedHandlerBound = this.handleAccountsChanged.bind(this);
    }

    getProvider() {
        if (typeof window === 'undefined') {
            return null;
        }

        return window.pelagus || null;
    }

    getState() {
        return { ...this.state };
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());

        return () => {
            this.listeners.delete(listener);
        };
    }

    setState(nextState) {
        this.state = {
            ...this.state,
            ...nextState
        };

        this.listeners.forEach((listener) => listener(this.getState()));
    }

    async initialize() {
        const provider = this.getProvider();

        if (!provider) {
            this.isInitialized = true;
            this.setState({
                isPelagusInstalled: false,
                isConnected: false,
                address: null
            });
            return this.getState();
        }

        this.setState({ isPelagusInstalled: true });

        if (!this.isInitialized && provider.on) {
            provider.on('accountsChanged', this.accountsChangedHandlerBound);
        }

        this.isInitialized = true;

        try {
            const accounts = await provider.request({ method: 'quai_accounts' });
            const address = Array.isArray(accounts) ? accounts[0] || null : null;

            this.setState({
                isConnected: Boolean(address),
                address
            });
        } catch (error) {
            console.error('Unable to fetch Pelagus accounts:', error);
            this.setState({
                isConnected: false,
                address: null
            });
        }

        return this.getState();
    }

    async connect() {
        const provider = this.getProvider();

        if (!provider) {
            throw new Error('Pelagus wallet is not detected.');
        }

        const accounts = await provider.request({ method: 'quai_requestAccounts' });
        const address = Array.isArray(accounts) ? accounts[0] || null : null;

        this.setState({
            isPelagusInstalled: true,
            isConnected: Boolean(address),
            address
        });

        if (address) {
            console.log('Connected Pelagus wallet address:', address);
        }

        return address;
    }

    disconnect() {
        // This disconnects app session state; extension-level permission remains wallet-controlled.
        this.setState({
            isConnected: false,
            address: null
        });
        console.log('Pelagus wallet disconnected from app session.');
    }

    handleAccountsChanged(accounts) {
        const address = Array.isArray(accounts) ? accounts[0] || null : null;

        this.setState({
            isConnected: Boolean(address),
            address
        });

        if (address) {
            console.log('Pelagus account changed to:', address);
        } else {
            console.log('Pelagus account access removed.');
        }
    }
}

export const walletAuthContext = new WalletAuthContext();
