import { Scene } from 'phaser';
import Character from '../classes/Character';
import DialogueBox from '../classes/DialogueBox';
import DialogueManager from '../classes/DialogueManager';
import VoiceChatService from '../services/VoiceChatService';

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
    }

    init (data)
    {
        const rawPlayerName = data?.playerName;
        this.playerName = rawPlayerName?.trim() || 'Subject-0';
        const roomSlug = this.playerName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        this.voiceRoomName = `quiet-protocol-${roomSlug || 'subject'}`;
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
            character.backendToken = config.backendToken || config.id;

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
            font: '12px monospace',
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
            this.showVoiceStatus(`Connected: ${character.name}`, 'ok');
        } catch (error) {
            console.error('Voice connection failed', error);
            this.voiceConnectedCharacterId = null;
            this.showVoiceStatus(`Voice connect failed: ${error.message}`, 'error');
        }
    }

    async pauseVoice(reason = '') {
        if (!VoiceChatService.isConnected) {
            this.voiceConnectedCharacterId = null;
            return;
        }

        this.voiceConnectedCharacterId = null;
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
            return;
        }

        this.voiceConnectedCharacterId = null;

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
            font: '14px monospace',
            color: '#94ccff'
        });

        const bodyText = this.add.text(boxX + 16, boxY + 34, '', {
            font: '13px monospace',
            color: '#ffffff',
            wordWrap: { width: boxWidth - 32 },
            lineSpacing: 5
        });

        const hintText = this.add.text(boxX + boxWidth - 12, boxY + boxHeight - 8, 'Press A to connect voice', {
            font: '12px monospace',
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
        this.proximityDialogue.hintText.setText('Press A to connect voice');
        this.proximityDialogue.container.setVisible(true);
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

        if (
            Phaser.Input.Keyboard.JustDown(this.connectKey) ||
            Phaser.Input.Keyboard.JustDown(this.interactKey)
        ) {
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
            font: '14px Arial',
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
            font: '12px monospace',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 6 },
            lineSpacing: 3
        });
        this.npcDistanceText.setDepth(40).setScrollFactor(0);
    }

    createVoiceStatusPanel() {
        this.voiceStatusText = this.add.text(20, this.cameras.main.height - 36, '', {
            font: '12px monospace',
            fill: '#dff6ff',
            backgroundColor: '#132230',
            padding: { x: 8, y: 4 }
        });
        this.voiceStatusText.setDepth(46).setScrollFactor(0).setVisible(false);
    }

    createTopBarUi() {
        const { width } = this.scale;

        this.menuButton = this.add.text(14, 12, '|||', {
            font: '20px monospace',
            color: '#d7ecff',
            backgroundColor: '#0c1a2a',
            padding: { x: 8, y: 2 }
        })
            .setScrollFactor(0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        this.logoutButton = this.add.text(width - 14, 12, 'LOGOUT', {
            font: '12px monospace',
            color: '#ffd3d3',
            backgroundColor: '#321414',
            padding: { x: 8, y: 5 }
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        this.menuPanel = this.add.container(0, 0).setDepth(61).setScrollFactor(0).setVisible(false);
        const panelBg = this.add.rectangle(120, 84, 208, 122, 0x0c1a2a, 0.96).setStrokeStyle(2, 0x6bb0ff, 1);
        const resumeBtn = this.add.text(36, 44, 'Resume', {
            font: '13px monospace',
            color: '#ffffff',
            backgroundColor: '#1d3651',
            padding: { x: 8, y: 5 }
        }).setInteractive({ useHandCursor: true });
        const disconnectBtn = this.add.text(36, 78, 'Disconnect Voice', {
            font: '13px monospace',
            color: '#ffffff',
            backgroundColor: '#1d3651',
            padding: { x: 8, y: 5 }
        }).setInteractive({ useHandCursor: true });
        const menuMainBtn = this.add.text(36, 112, 'Main Menu', {
            font: '13px monospace',
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
                font: '18px monospace',
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
        const isInDialogue = this.dialogueBox.isVisible();

        if (!isInDialogue) {
            this.updatePlayerMovement();
        }

        this.checkCharacterInteraction();

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
