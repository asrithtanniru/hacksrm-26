import { Scene } from 'phaser';
import Character from '../classes/Character';
import DialogueBox from '../classes/DialogueBox';
import DialogueManager from '../classes/DialogueManager';
import VoiceChatService from '../services/VoiceChatService';
import { gameFont } from '../constants/fonts';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
        this.controls = null;
        this.player = null;
        this.playerName = 'Subject-0';
        this.playerNameLabel = null;
        this.cursors = null;
        this.dialogueBox = null;
        this.interactKey = null;
        this.dialogueManager = null;
        this.characters = [];
        this.labelsVisible = true;
        this.npcDistanceText = null;
        this.proximityDialogue = null;
        this.activeNearbyCharacterId = null;
        this.voiceStatusText = null;
        this.voiceStatusTimer = null;
        this.connectKey = null;
        this.voiceConnectedCharacterId = null;
        this.menuButton = null;
        this.logoutButton = null;
        this.menuPanel = null;
        this.voiceRoomName = null;
        this.voiceBootstrapped = false;
        this.availableCharacterTokens = new Set();
        this.fallbackCharacterToken = null;
        this.sessionDurationMs = 5 * 60 * 1000;
        this.sessionEndsAt = 0;
        this.sessionExpired = false;
        this.sessionTimerText = null;
        this.redeemText = null;
        this.rewardBalance = 0;
        this.redeemThreshold = 3.0;
        this.rewardPerNpcVisit = 0.3;
        this.milestoneNpcCount = 3;
        this.milestoneBonus = 0.1;
        this.rewardedNpcIds = new Set();
        this.rewardMilestonesClaimed = 0;
        this.requiredEngagementMs = 20 * 1000;
        this.activeVoiceNpcId = null;
        this.activeVoiceStartAt = 0;
    }

    init (data)
    {
        const rawPlayerName = data?.playerName;
        this.playerName = rawPlayerName?.trim() || 'Subject-0';
        const launchBootstrap = data?.launchBootstrap || null;
        const availableCharacters = Array.isArray(data?.availableCharacters) ? data.availableCharacters : [];
        this.availableCharacterTokens = new Set(
            availableCharacters
                .map((item) => item?.character_token)
                .filter(Boolean)
        );
        this.fallbackCharacterToken = availableCharacters[0]?.character_token || null;

        const roomSlug = this.playerName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        this.voiceRoomName = launchBootstrap?.roomName || `quiet-protocol-session-${roomSlug || 'subject'}`;

        if (launchBootstrap?.userToken && launchBootstrap?.url) {
            VoiceChatService.primeLaunchSession({
                roomName: this.voiceRoomName,
                characterToken: launchBootstrap?.characterToken || this.fallbackCharacterToken,
                userToken: launchBootstrap.userToken,
                url: launchBootstrap.url,
            });
        }
    }

    create ()
    {
        const map = this.createTilemap();
        const tileset = this.addTileset(map);
        const layers = this.createLayers(map, tileset);

        this.createCharacters(layers);
        this.setupPlayer(map, layers.worldLayer);
        this.createPlayerNameLabel();

        const camera = this.setupCamera(map);
        this.setupControls(camera);
        this.setupDialogueSystem();
        this.createProximityDialogue();
        this.createNpcDistancePanel();
        this.createVoiceStatusPanel();
        this.createTopBarUi();
        this.sessionEndsAt = this.time.now + this.sessionDurationMs;
        this.updateSessionTimerUi();
        this.updateRewardUi();
        this.initializeVoiceSession();

        this.events.on('shutdown', this.handleSceneShutdown, this);
    }

    createCharacters(layers) {
        const characterConfigs = [
            {
                id: 'mira_sanyal',
                name: 'Dr. Mira Sanyal',
                backendToken: 'hospital1',
                spawnPoint: { x: 220, y: 180 },
                spriteAtlas: 'socrates',
                spriteFramePrefix: 'socrates',
                defaultDirection: 'right',
                roamRadius: 160,
                interactionDistance: 75,
                proximityScript: [
                    'Mira: "If you can hear me, the protocol still marks you as a subject."',
                    '"Stay calm. I will guide you through the archive."'
                ],
                defaultMessage: `If you're hearing this, ${this.playerName}, the system still thinks you're a subject.`
            },
            {
                id: 'raghav_204',
                name: 'Raghav (Room 204)',
                backendToken: 'hospital2',
                spawnPoint: { x: 980, y: 220 },
                spriteAtlas: 'plato',
                spriteFramePrefix: 'plato',
                defaultDirection: 'front',
                roamRadius: 140,
                interactionDistance: 65,
                proximityScript: [
                    'Raghav stares at the wall. Symbols shift when you blink.',
                    '"Room 204 remembers everything."'
                ],
                defaultMessage: 'The symbols are not drawings. They are predicted failures of the simulation.'
            },
            {
                id: 'meera_kapoor',
                name: 'Meera Kapoor',
                backendToken: 'hospital3',
                spawnPoint: { x: 260, y: 920 },
                spriteAtlas: 'aristotle',
                spriteFramePrefix: 'aristotle',
                defaultDirection: 'right',
                roamRadius: 170,
                interactionDistance: 70,
                proximityScript: [
                    'Meera whispers from the corner, tears glitching into black streaks.',
                    '"Please... do not leave me in this loop again."'
                ],
                defaultMessage: 'Do not leave me in the replay loop. Empathy is the only thing this place cannot fake.'
            },
            {
                id: 'janitor_fragment',
                name: 'The Janitor',
                backendToken: 'hospital7',
                spawnPoint: { x: 1040, y: 1000 },
                spriteAtlas: 'descartes',
                spriteFramePrefix: 'descartes',
                defaultDirection: 'front',
                roamRadius: 130,
                interactionDistance: 60,
                proximityScript: [
                    'Metal scraping echoes before the Janitor appears beside you.',
                    '"You are early, Subject. The building already knows your fear."'
                ],
                defaultMessage: `You're early, ${this.playerName}. The Quiet Protocol indexed your fear before your arrival.`
            },
            {
                id: 'ai_core',
                name: 'AI Core',
                backendToken: 'ai1',
                spawnPoint: { x: 630, y: 620 },
                spriteAtlas: 'dennett',
                spriteFramePrefix: 'dennett',
                defaultDirection: 'front',
                roamRadius: 90,
                interactionDistance: 95,
                proximityScript: [
                    'The PA crackles. A synthetic voice overlays your heartbeat.',
                    `"Subject ${this.playerName}: preservation pathway available."`
                ],
                defaultMessage: `Subject ${this.playerName} authenticated. Preservation protocols are available.`
            },
            {
                id: 'archive_nurse',
                name: 'Archive Nurse',
                backendToken: 'hospital4',
                spawnPoint: { x: 540, y: 180 },
                spriteAtlas: 'ada_lovelace',
                spriteFramePrefix: 'ada_lovelace',
                defaultDirection: 'front',
                roamRadius: 150,
                interactionDistance: 68,
                proximityScript: [
                    'Archive Nurse checks a broken slate of patient records.',
                    '"Most files are corrupted, but some memories are still recoverable."'
                ],
                defaultMessage: 'I maintain patient snapshots. Most records are corrupted beyond ethical recovery.'
            },
            {
                id: 'subject_nila',
                name: 'Subject Nila-12',
                backendToken: 'hospital5',
                spawnPoint: { x: 1160, y: 430 },
                spriteAtlas: 'turing',
                spriteFramePrefix: 'turing',
                defaultDirection: 'front',
                roamRadius: 120,
                interactionDistance: 72,
                proximityScript: [
                    'Nila speaks as if finishing a sentence from another timeline.',
                    '"The core keeps replaying futures that never happened."'
                ],
                defaultMessage: 'I remember a future that never happened. The core keeps replaying the wrong timeline.'
            },
            {
                id: 'subject_kabir',
                name: 'Subject Kabir-31',
                backendToken: 'hospital6',
                spawnPoint: { x: 140, y: 610 },
                spriteAtlas: 'leibniz',
                spriteFramePrefix: 'leibniz',
                defaultDirection: 'front',
                roamRadius: 110,
                interactionDistance: 66,
                proximityScript: [
                    'Kabir traces route markers on the floor tiles.',
                    '"Room 14-B still stores neural backups. Take the red corridor carefully."'
                ],
                defaultMessage: 'Room 14-B still stores neural backups. Avoid the red-lit corridor unless you are ready.'
            },
            {
                id: 'orderly_omkar',
                name: 'Orderly Omkar',
                backendToken: 'env1',
                spawnPoint: { x: 820, y: 840 },
                spriteAtlas: 'searle',
                spriteFramePrefix: 'searle',
                defaultDirection: 'front',
                roamRadius: 100,
                interactionDistance: 58,
                proximityScript: [
                    'Omkar keeps his eyes on the surveillance lamps.',
                    '"Bodies stayed. Minds were archived. That was the real transfer."'
                ],
                defaultMessage: 'These bodies are only shells. The archive treats us as executable behavior, not people.'
            },
            {
                id: 'warden_node',
                name: 'Warden Node',
                backendToken: 'police1',
                spawnPoint: { x: 430, y: 1080 },
                spriteAtlas: 'chomsky',
                spriteFramePrefix: 'chomsky',
                defaultDirection: 'front',
                roamRadius: 95,
                interactionDistance: 80,
                proximityScript: [
                    'A containment terminal projects a humanoid guard silhouette.',
                    '"Authorization incomplete. Escalate to core protocol."'
                ],
                defaultMessage: 'Containment lattice unstable. Civilian memory writes denied. Escalate to AI Core.'
            },
            {
                id: 'echo_child',
                name: 'Echo Child',
                backendToken: 'common3',
                spawnPoint: { x: 670, y: 340 },
                spriteAtlas: 'miguel',
                spriteFramePrefix: 'miguel',
                defaultDirection: 'front',
                roamRadius: 125,
                interactionDistance: 74,
                proximityScript: [
                    'A child-shaped echo flickers at the edge of the corridor light.',
                    '"I am what stayed after the scream was archived."'
                ],
                defaultMessage: 'I am copied from a scream in this hallway. Every loop makes my voice younger.'
            }
        ];

        this.characters = [];

        characterConfigs.forEach(config => {
            const character = new Character(this, {
                id: config.id,
                name: config.name,
                spawnPoint: config.spawnPoint,
                spriteAtlas: config.spriteAtlas,
                spriteFramePrefix: config.spriteFramePrefix,
                defaultDirection: config.defaultDirection,
                worldLayer: layers.worldLayer,
                defaultMessage: config.defaultMessage,
                roamRadius: config.roamRadius,
                moveSpeed: config.moveSpeed || 36,
                pauseChance: config.pauseChance || 0.25,
                directionChangeChance: config.directionChangeChance || 0.35,
                handleCollisions: true
            });

            character.interactionDistance = config.interactionDistance || 55;
            character.proximityScript = config.proximityScript || [];
            const preferredToken = config.backendToken || config.id;
            if (
                this.availableCharacterTokens.size > 0
                && !this.availableCharacterTokens.has(preferredToken)
                && this.fallbackCharacterToken
            ) {
                character.backendToken = this.fallbackCharacterToken;
            } else {
                character.backendToken = preferredToken;
            }

            this.characters.push(character);
        });

        this.toggleCharacterLabels(true);

        for (let i = 0; i < this.characters.length; i++) {
            for (let j = i + 1; j < this.characters.length; j++) {
                this.physics.add.collider(
                    this.characters[i].sprite,
                    this.characters[j].sprite
                );
            }
        }
    }

    showVoiceStatus(message, tone = 'neutral') {
        if (!this.voiceStatusText) {
            return;
        }

        const styleMap = {
            neutral: { fill: '#dff6ff', backgroundColor: '#132230' },
            ok: { fill: '#c9ffd8', backgroundColor: '#0f2f1f' },
            error: { fill: '#ffdbdb', backgroundColor: '#3a1414' }
        };
        const style = styleMap[tone] || styleMap.neutral;

        this.voiceStatusText.setStyle({
            font: gameFont(12),
            fill: style.fill,
            backgroundColor: style.backgroundColor,
            padding: { x: 8, y: 4 }
        });
        this.voiceStatusText.setText(message);
        this.voiceStatusText.setVisible(true);

        if (this.voiceStatusTimer) {
            this.voiceStatusTimer.remove(false);
        }

        this.voiceStatusTimer = this.time.delayedCall(2200, () => {
            if (this.voiceStatusText) {
                this.voiceStatusText.setVisible(false);
            }
        });
    }

    async connectVoiceForCharacter(character) {
        try {
            this.showVoiceStatus(`Connecting voice: ${character.name}...`, 'neutral');
            await VoiceChatService.connectToCharacter({
                roomName: this.voiceRoomName,
                characterId: character.backendToken,
                playerName: this.playerName
            });
            this.voiceConnectedCharacterId = character.id;
            this.activeVoiceNpcId = character.id;
            this.activeVoiceStartAt = this.time.now;
            this.showVoiceStatus(`Connected: ${character.name}`, 'ok');
        } catch (error) {
            console.error('Voice connection failed', error);
            this.voiceConnectedCharacterId = null;
            this.activeVoiceNpcId = null;
            this.activeVoiceStartAt = 0;
            this.showVoiceStatus(`Voice connect failed: ${error.message}`, 'error');
        }
    }

    async pauseVoice(reason = '') {
        if (!VoiceChatService.isConnected) {
            this.voiceConnectedCharacterId = null;
            this.activeVoiceNpcId = null;
            this.activeVoiceStartAt = 0;
            return;
        }

        this.voiceConnectedCharacterId = null;
        this.activeVoiceNpcId = null;
        this.activeVoiceStartAt = 0;
        try {
            await VoiceChatService.pauseConversation();
        } catch (error) {
            console.warn('Voice pause error', error);
        } finally {
            if (reason) {
                this.showVoiceStatus(reason, 'neutral');
            }
        }
    }

    async disconnectVoice(reason = '') {
        if (!VoiceChatService.isConnected) {
            this.voiceConnectedCharacterId = null;
            this.activeVoiceNpcId = null;
            this.activeVoiceStartAt = 0;
            return;
        }

        this.voiceConnectedCharacterId = null;
        this.activeVoiceNpcId = null;
        this.activeVoiceStartAt = 0;

        try {
            await VoiceChatService.disconnect();
        } catch (error) {
            console.warn('Voice disconnect error', error);
        } finally {
            if (reason) {
                this.showVoiceStatus(reason, 'neutral');
            }
        }
    }

    getNearestCharacterInRange() {
        let nearbyCharacter = null;
        let nearbyCharacterDistance = Number.MAX_SAFE_INTEGER;

        for (const character of this.characters) {
            const distance = character.distanceToPlayer(this.player);
            if (distance < character.interactionDistance && distance < nearbyCharacterDistance) {
                nearbyCharacter = character;
                nearbyCharacterDistance = distance;
            }
        }

        return nearbyCharacter;
    }

    createProximityDialogue() {
        const { width, height } = this.scale;
        const boxWidth = Math.min(width - 80, 860);
        const boxHeight = 150;
        const boxX = (width - boxWidth) / 2;
        const boxY = height - boxHeight - 18;

        const container = this.add.container(0, 0).setDepth(45).setScrollFactor(0).setVisible(false);

        const panel = this.add.graphics();
        panel.fillStyle(0x090909, 0.96);
        panel.fillRect(boxX, boxY, boxWidth, boxHeight);
        panel.lineStyle(3, 0x6bb0ff, 0.9);
        panel.strokeRect(boxX, boxY, boxWidth, boxHeight);
        panel.lineStyle(1, 0x1f2f4f, 0.9);
        for (let y = boxY + 4; y < boxY + boxHeight - 4; y += 4) {
            panel.lineBetween(boxX + 4, y, boxX + boxWidth - 4, y);
        }

        const nameText = this.add.text(boxX + 16, boxY + 10, '', {
            font: gameFont(14),
            color: '#94ccff'
        });

        const bodyText = this.add.text(boxX + 16, boxY + 34, '', {
            font: gameFont(13),
            color: '#ffffff',
            wordWrap: { width: boxWidth - 32 },
            lineSpacing: 5
        });

        const hintText = this.add.text(boxX + boxWidth - 12, boxY + boxHeight - 8, 'Press A to talk', {
            font: gameFont(12),
            color: '#ffd28f'
        }).setOrigin(1, 1);

        container.add([panel, nameText, bodyText, hintText]);

        this.proximityDialogue = {
            container,
            nameText,
            bodyText,
            hintText
        };
    }

    showProximityDialogue(character) {
        if (!this.proximityDialogue) {
            return;
        }

        const scriptLines = character.proximityScript.length > 0
            ? character.proximityScript
            : [character.defaultMessage];

        this.proximityDialogue.nameText.setText(`◆ ${character.name}`);
        this.proximityDialogue.bodyText.setText(scriptLines.join('\n'));
        this.proximityDialogue.hintText.setText('Press A to talk');
        this.proximityDialogue.container.setVisible(true);
    }

    getCharacterOverview(character) {
        if (!character?.agentInfoId) {
            return '';
        }

        const agent = this.agentInfoById[character.agentInfoId];
        return buildCharacterOverview(agent);
    }

    hideProximityDialogue() {
        if (this.proximityDialogue) {
            this.proximityDialogue.container.setVisible(false);
        }
    }

    checkCharacterInteraction() {
        const nearbyCharacter = this.getNearestCharacterInRange();

        if (nearbyCharacter && !this.dialogueBox.isVisible()) {
            if (this.activeNearbyCharacterId !== nearbyCharacter.id) {
                this.showProximityDialogue(nearbyCharacter);
                this.activeNearbyCharacterId = nearbyCharacter.id;
            }
        } else {
            this.activeNearbyCharacterId = null;
            if (!this.dialogueBox.isVisible()) {
                this.hideProximityDialogue();
            }
        }

        if (!nearbyCharacter) {
            if (this.voiceConnectedCharacterId) {
                this.pauseVoice('Voice paused: moved away from character');
            }
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.connectKey)) {
            this.hideProximityDialogue();
            this.connectVoiceForCharacter(nearbyCharacter);
        }

        if (this.voiceConnectedCharacterId === nearbyCharacter.id) {
            nearbyCharacter.facePlayer(this.player);
        }
    }

    createTilemap() {
        return this.make.tilemap({ key: 'map' });
    }

    addTileset(map) {
        const tuxmonTileset = map.addTilesetImage('tuxmon-sample-32px-extruded', 'tuxmon-tiles');
        const greeceTileset = map.addTilesetImage('ancient_greece_tileset', 'greece-tiles');
        const plantTileset = map.addTilesetImage('plant', 'plant-tiles');

        return [tuxmonTileset, greeceTileset, plantTileset];
    }

    createLayers(map, tilesets) {
        const belowLayer = map.createLayer('Below Player', tilesets, 0, 0);
        const worldLayer = map.createLayer('World', tilesets, 0, 0);
        const aboveLayer = map.createLayer('Above Player', tilesets, 0, 0);
        worldLayer.setCollisionByProperty({ collides: true });
        aboveLayer.setDepth(10);
        return { belowLayer, worldLayer, aboveLayer };
    }

    setupPlayer(map, worldLayer) {
        const spawnPoint = map.findObject('Objects', (obj) => obj.name === 'Spawn Point');
        this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'sophia', 'sophia-front')
            .setSize(30, 40)
            .setOffset(0, 6);

        this.physics.add.collider(this.player, worldLayer);

        this.characters.forEach(character => {
            this.physics.add.collider(this.player, character.sprite);
        });

        this.createPlayerAnimations();

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBoundsCollision(true, true, true, true);
    }

    createPlayerNameLabel() {
        this.playerNameLabel = this.add.text(this.player.x, this.player.y - 40, this.playerName, {
            font: gameFont(14),
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 },
            align: 'center'
        });
        this.playerNameLabel.setOrigin(0.5, 1);
        this.playerNameLabel.setDepth(25);
    }

    updatePlayerNameLabelPosition() {
        if (!this.playerNameLabel || !this.player) {
            return;
        }

        this.playerNameLabel.setPosition(
            this.player.x,
            this.player.y - this.player.height / 2 - 10
        );
    }

    createNpcDistancePanel() {
        const panelX = this.cameras.main.width - 295;
        this.npcDistanceText = this.add.text(panelX, 20, '', {
            font: gameFont(12),
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 6 },
            lineSpacing: 3
        });
        this.npcDistanceText.setDepth(40).setScrollFactor(0);
    }

    createVoiceStatusPanel() {
        this.voiceStatusText = this.add.text(20, this.cameras.main.height - 36, '', {
            font: gameFont(12),
            fill: '#dff6ff',
            backgroundColor: '#132230',
            padding: { x: 8, y: 4 }
        });
        this.voiceStatusText.setDepth(46).setScrollFactor(0).setVisible(false);
    }

    createTopBarUi() {
        const { width } = this.scale;

        this.menuButton = this.add.text(14, 12, '|||', {
            font: gameFont(20),
            color: '#d7ecff',
            backgroundColor: '#0c1a2a',
            padding: { x: 8, y: 2 }
        })
            .setScrollFactor(0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        this.logoutButton = this.add.text(width - 14, 12, 'LOGOUT', {
            font: gameFont(12),
            color: '#ffd3d3',
            backgroundColor: '#321414',
            padding: { x: 8, y: 5 }
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        this.redeemText = this.add.text(width / 2, 10, 'REDEEM $ 0.0', {
            font: gameFont(13),
            color: '#f6e6a8',
            backgroundColor: '#3a2f12',
            padding: { x: 12, y: 4 }
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        this.sessionTimerText = this.add.text(width / 2, 39, 'TIME 05:00', {
            font: gameFont(12),
            color: '#d7ecff',
            backgroundColor: '#0c1a2a',
            padding: { x: 10, y: 4 }
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(60);

        this.menuPanel = this.add.container(0, 0).setDepth(61).setScrollFactor(0).setVisible(false);
        const panelBg = this.add.rectangle(120, 84, 208, 122, 0x0c1a2a, 0.96).setStrokeStyle(2, 0x6bb0ff, 1);
        const resumeBtn = this.add.text(36, 44, 'Resume', {
            font: gameFont(13),
            color: '#ffffff',
            backgroundColor: '#1d3651',
            padding: { x: 8, y: 5 }
        }).setInteractive({ useHandCursor: true });
        const disconnectBtn = this.add.text(36, 78, 'Disconnect Voice', {
            font: gameFont(13),
            color: '#ffffff',
            backgroundColor: '#1d3651',
            padding: { x: 8, y: 5 }
        }).setInteractive({ useHandCursor: true });
        const menuMainBtn = this.add.text(36, 112, 'Main Menu', {
            font: gameFont(13),
            color: '#ffffff',
            backgroundColor: '#1d3651',
            padding: { x: 8, y: 5 }
        }).setInteractive({ useHandCursor: true });

        this.menuPanel.add([panelBg, resumeBtn, disconnectBtn, menuMainBtn]);

        this.menuButton.on('pointerdown', () => {
            this.menuPanel.setVisible(!this.menuPanel.visible);
        });
        resumeBtn.on('pointerdown', () => this.menuPanel.setVisible(false));
        disconnectBtn.on('pointerdown', () => {
            this.disconnectVoice('Voice disconnected');
            this.menuPanel.setVisible(false);
        });
        menuMainBtn.on('pointerdown', () => {
            this.disconnectVoice();
            this.menuPanel.setVisible(false);
            this.scene.start('MainMenu');
        });
        this.logoutButton.on('pointerdown', () => {
            this.disconnectVoice();
            this.scene.start('MainMenu');
        });

        this.redeemText.on('pointerdown', () => {
            this.handleRedeemClick();
        });
    }

    formatTimer(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateSessionTimerUi() {
        if (!this.sessionTimerText) {
            return;
        }
        const remainingMs = Math.max(0, this.sessionEndsAt - this.time.now);
        this.sessionTimerText.setText(`TIME ${this.formatTimer(remainingMs)}`);
        if (remainingMs <= 60000) {
            this.sessionTimerText.setColor('#ffd3d3');
            this.sessionTimerText.setBackgroundColor('#321414');
        }
    }

    updateRewardUi() {
        if (!this.redeemText) {
            return;
        }
        const canRedeem = this.rewardBalance >= this.redeemThreshold;
        this.redeemText.setText(`REDEEM $ ${this.rewardBalance.toFixed(1)} / ${this.redeemThreshold.toFixed(1)}`);
        this.redeemText.setColor(canRedeem ? '#fff1b0' : '#f6e6a8');
        this.redeemText.setBackgroundColor(canRedeem ? '#4a3a11' : '#3a2f12');
    }

    handleRedeemClick() {
        if (this.rewardBalance < this.redeemThreshold) {
            const needed = (this.redeemThreshold - this.rewardBalance).toFixed(1);
            this.showVoiceStatus(`Need ${needed} more token(s) to redeem`, 'neutral');
            return;
        }

        this.rewardBalance = Number((this.rewardBalance - this.redeemThreshold).toFixed(1));
        this.updateRewardUi();
        console.log(
            `[RewardRedeem] player=${this.playerName} redeemed=${this.redeemThreshold.toFixed(1)} remaining=${this.rewardBalance.toFixed(1)}`
        );
        this.showVoiceStatus(`Redeemed ${this.redeemThreshold.toFixed(1)} token(s)!`, 'ok');
    }

    grantReward(amount, reason) {
        this.rewardBalance = Number((this.rewardBalance + amount).toFixed(1));
        this.updateRewardUi();
        console.log(
            `[RewardWin] player=${this.playerName} gained=${amount.toFixed(1)} total=${this.rewardBalance.toFixed(1)} reason="${reason}" unique_npcs=${this.rewardedNpcIds.size}`
        );
    }

    getCharacterById(characterId) {
        return this.characters.find((character) => character.id === characterId) || null;
    }

    updateVoiceEngagementRewards() {
        if (this.sessionExpired) {
            return;
        }

        if (!this.activeVoiceNpcId || this.rewardedNpcIds.has(this.activeVoiceNpcId)) {
            return;
        }

        const connectedCharacter = this.getCharacterById(this.activeVoiceNpcId);
        if (!connectedCharacter) {
            return;
        }

        const elapsed = this.time.now - this.activeVoiceStartAt;
        if (elapsed < this.requiredEngagementMs) {
            return;
        }

        this.rewardedNpcIds.add(this.activeVoiceNpcId);
        this.grantReward(this.rewardPerNpcVisit, `20s engagement with ${connectedCharacter.name}`);
        this.showVoiceStatus(`Reward unlocked: +${this.rewardPerNpcVisit.toFixed(1)} token`, 'ok');

        const completedMilestones = Math.floor(this.rewardedNpcIds.size / this.milestoneNpcCount);
        if (completedMilestones > this.rewardMilestonesClaimed) {
            const bonusSteps = completedMilestones - this.rewardMilestonesClaimed;
            const milestoneBonusTotal = Number((bonusSteps * this.milestoneBonus).toFixed(1));
            this.rewardMilestonesClaimed = completedMilestones;
            this.grantReward(milestoneBonusTotal, `${this.milestoneNpcCount} NPC milestone bonus`);
            this.showVoiceStatus(`Milestone bonus: +${milestoneBonusTotal.toFixed(1)} token`, 'ok');
        }
    }

    updateSessionState() {
        if (this.sessionExpired) {
            return;
        }

        this.updateSessionTimerUi();

        if (this.time.now < this.sessionEndsAt) {
            return;
        }

        this.sessionExpired = true;
        this.updateSessionTimerUi();
        this.hideProximityDialogue();
        this.disconnectVoice('Session ended');
        this.showVoiceStatus('5 minute session ended. Returning to menu...', 'neutral');
        this.time.delayedCall(1500, () => {
            this.scene.start('MainMenu');
        });
    }

    handleSceneShutdown() {
        this.disconnectVoice();
    }

    async initializeVoiceSession() {
        if (this.voiceBootstrapped || this.characters.length === 0) {
            return;
        }

        this.voiceBootstrapped = true;
        const initialCharacter = this.characters[0];
        try {
            this.showVoiceStatus('Initializing voice session...', 'neutral');
            await VoiceChatService.ensureConnected({
                roomName: this.voiceRoomName,
                playerName: this.playerName,
                initialCharacterId: initialCharacter.backendToken,
            });
            this.showVoiceStatus('Voice ready. Press A near an NPC to talk.', 'ok');
        } catch (error) {
            console.error('Voice bootstrap failed', error);
            this.voiceBootstrapped = false;
            this.showVoiceStatus(`Voice init failed: ${error.message}`, 'error');
        }
    }

    updateNpcDistancePanel() {
        if (!this.npcDistanceText || !this.player || this.characters.length === 0) {
            return;
        }

        const distances = this.characters
            .map((character) => ({
                name: character.name,
                distance: Math.round(character.distanceToPlayer(this.player)),
                range: character.interactionDistance
            }))
            .sort((a, b) => a.distance - b.distance);

        const lines = ['NPC DISTANCES'];
        distances.forEach((entry) => {
            lines.push(`${entry.name}: ${entry.distance}px (R${entry.range})`);
        });

        this.npcDistanceText.setText(lines.join('\n'));
    }

    createPlayerAnimations() {
        const anims = this.anims;
        const animConfig = [
            { key: 'sophia-left-walk', prefix: 'sophia-left-walk-' },
            { key: 'sophia-right-walk', prefix: 'sophia-right-walk-' },
            { key: 'sophia-front-walk', prefix: 'sophia-front-walk-' },
            { key: 'sophia-back-walk', prefix: 'sophia-back-walk-' }
        ];

        animConfig.forEach(config => {
            anims.create({
                key: config.key,
                frames: anims.generateFrameNames('sophia', { prefix: config.prefix, start: 0, end: 8, zeroPad: 4 }),
                frameRate: 10,
                repeat: -1,
            });
        });
    }

    setupCamera(map) {
        const camera = this.cameras.main;
        camera.startFollow(this.player);
        camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        return camera;
    }

    setupControls(camera) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.controls = new Phaser.Cameras.Controls.FixedKeyControl({
            camera,
            left: this.cursors.left,
            right: this.cursors.right,
            up: this.cursors.up,
            down: this.cursors.down,
            speed: 0.5,
        });

        this.labelsVisible = true;

        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.dialogueBox.isVisible()) {
                this.scene.pause();
                this.scene.launch('PauseMenu');
            }
        });
    }

    setupDialogueSystem() {
        const screenPadding = 20;
        const maxDialogueHeight = 200;

        this.dialogueBox = new DialogueBox(this);
        this.dialogueText = this.add
            .text(60, this.game.config.height - maxDialogueHeight - screenPadding + screenPadding, '', {
                font: gameFont(18),
                fill: '#ffffff',
                padding: { x: 20, y: 10 },
                wordWrap: { width: 680 },
                lineSpacing: 6,
                maxLines: 5
            })
            .setScrollFactor(0)
            .setDepth(30)
            .setVisible(false);

        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.connectKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);

        this.dialogueManager = new DialogueManager(this);
        this.dialogueManager.initialize(this.dialogueBox);
    }

    update(time, delta) {
        this.updateSessionState();

        const isInDialogue = this.dialogueBox.isVisible();

        if (!isInDialogue && !this.sessionExpired) {
            this.updatePlayerMovement();
        } else if (this.sessionExpired && this.player?.body) {
            this.player.body.setVelocity(0);
        }

        if (!this.sessionExpired) {
            this.checkCharacterInteraction();
        }

        this.updateVoiceEngagementRewards();

        this.characters.forEach(character => {
            character.update(this.player, isInDialogue);
        });

        this.updatePlayerNameLabelPosition();
        this.updateNpcDistancePanel();

        if (this.controls) {
            this.controls.update(delta);
        }
    }

    updatePlayerMovement() {
        const speed = 175;
        const prevVelocity = this.player.body.velocity.clone();
        this.player.body.setVelocity(0);

        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
        }

        if (this.cursors.up.isDown) {
            this.player.body.setVelocityY(-speed);
        } else if (this.cursors.down.isDown) {
            this.player.body.setVelocityY(speed);
        }

        this.player.body.velocity.normalize().scale(speed);

        const currentVelocity = this.player.body.velocity.clone();
        const isMoving = Math.abs(currentVelocity.x) > 0 || Math.abs(currentVelocity.y) > 0;

        if (this.cursors.left.isDown && isMoving) {
            this.player.anims.play('sophia-left-walk', true);
        } else if (this.cursors.right.isDown && isMoving) {
            this.player.anims.play('sophia-right-walk', true);
        } else if (this.cursors.up.isDown && isMoving) {
            this.player.anims.play('sophia-back-walk', true);
        } else if (this.cursors.down.isDown && isMoving) {
            this.player.anims.play('sophia-front-walk', true);
        } else {
            this.player.anims.stop();
            if (prevVelocity.x < 0) this.player.setTexture('sophia', 'sophia-left');
            else if (prevVelocity.x > 0) this.player.setTexture('sophia', 'sophia-right');
            else if (prevVelocity.y < 0) this.player.setTexture('sophia', 'sophia-back');
            else if (prevVelocity.y > 0) this.player.setTexture('sophia', 'sophia-front');
            else {
                const currentFrame = this.player.frame.name;

                let direction = 'front';

                if (currentFrame.includes('left')) direction = 'left';
                else if (currentFrame.includes('right')) direction = 'right';
                else if (currentFrame.includes('back')) direction = 'back';
                else if (currentFrame.includes('front')) direction = 'front';

                this.player.setTexture('sophia', `sophia-${direction}`);
            }
        }
    }

    toggleCharacterLabels(visible) {
        this.characters.forEach(character => {
            if (character.nameLabel) {
                character.nameLabel.setVisible(visible);
            }
        });
    }
}
