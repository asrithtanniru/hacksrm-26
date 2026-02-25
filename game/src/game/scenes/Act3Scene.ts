import { Scene, GameObjects, Physics } from 'phaser';
import { EventBus } from '../EventBus';

export class Act3Scene extends Scene
{
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private speed: number = 160;
    private coreZone!: GameObjects.Zone;
    private dialogueBox!: GameObjects.Container | null;
    private isShowingDialogue: boolean = false;
    private hasReachedCore: boolean = false;

    // World dimensions
    private worldW = 2048;
    private worldH = 1536;

    constructor ()
    {
        super('Act3Scene');
    }

    create ()
    {
        this.isShowingDialogue = false;
        this.hasReachedCore = false;
        this.dialogueBox = null;

        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor(0x050205);
        this.cameras.main.fadeIn(1200, 0, 0, 0);

        // --- WORLD BACKGROUND: Neuro-Core ---
        const bg = this.add.image(this.worldW / 2, this.worldH / 2, 'neurocore-bg');
        bg.setDisplaySize(this.worldW, this.worldH);

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

        // Red atmospheric overlay
        const redOverlay = this.add.graphics();
        redOverlay.fillStyle(0x440000, 0.12);
        redOverlay.fillRect(0, 0, this.worldW, this.worldH);
        redOverlay.setDepth(5);

        // Pulsing energy at center
        const energyPulse = this.add.graphics();
        energyPulse.setDepth(6);
        energyPulse.fillStyle(0xff2200, 0.04);
        energyPulse.fillCircle(this.worldW / 2, this.worldH / 2, 250);
        energyPulse.fillStyle(0xff2200, 0.02);
        energyPulse.fillCircle(this.worldW / 2, this.worldH / 2, 400);

        this.tweens.add({
            targets: energyPulse,
            scaleX: { from: 0.85, to: 1.2 },
            scaleY: { from: 0.85, to: 1.2 },
            alpha: { from: 0.5, to: 1 },
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Scanline overlay (fixed to screen)
        const scanlines = this.add.graphics();
        scanlines.setDepth(200);
        scanlines.setScrollFactor(0);
        scanlines.setAlpha(0.06);
        for (let y = 0; y < height; y += 2) {
            scanlines.fillStyle(0x000000);
            scanlines.fillRect(0, y, width, 1);
        }

        // --- PLAYER (starts at bottom of world) ---
        this.player = this.physics.add.sprite(this.worldW / 2, this.worldH - 150, 'aarav');
        this.player.setDisplaySize(150, 200);
        this.player.setDepth(50);
        this.player.setCrop(230, 50, 310, 420);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(220, 300);
        this.player.body.setOffset(40, 60);

        // --- CAMERA ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        // --- CORE ZONE (center of world) ---
        this.coreZone = this.add.zone(this.worldW / 2, this.worldH / 2, 100, 100);
        this.physics.add.existing(this.coreZone, true);

        // Core glow visual
        const coreGlow = this.add.graphics();
        coreGlow.setDepth(7);
        coreGlow.fillStyle(0xff3300, 0.12);
        coreGlow.fillCircle(this.worldW / 2, this.worldH / 2, 70);
        coreGlow.fillStyle(0xff4400, 0.25);
        coreGlow.fillCircle(this.worldW / 2, this.worldH / 2, 40);
        coreGlow.fillStyle(0xff6600, 0.45);
        coreGlow.fillCircle(this.worldW / 2, this.worldH / 2, 18);

        this.tweens.add({
            targets: coreGlow,
            scaleX: { from: 0.85, to: 1.15 },
            scaleY: { from: 0.85, to: 1.15 },
            alpha: { from: 0.6, to: 1 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        const coreLabel = this.add.text(this.worldW / 2, this.worldH / 2 + 55, '[ NEURO-CORE ]', {
            fontFamily: '"Courier New", monospace',
            fontSize: '11px',
            color: '#cc4420'
        }).setOrigin(0.5).setDepth(8);

        this.tweens.add({
            targets: coreLabel,
            alpha: { from: 0.3, to: 1 },
            duration: 1200,
            yoyo: true,
            repeat: -1
        });

        // Core overlap detection
        this.physics.add.overlap(this.player, this.coreZone, () => {
            if (!this.hasReachedCore && !this.isShowingDialogue) {
                this.hasReachedCore = true;
                this.triggerEnding();
            }
        });

        // --- HUD ---
        this.add.text(20, 20, 'ACT III — THE NEURO-CORE', {
            fontFamily: '"Courier New", monospace',
            fontSize: '16px',
            color: '#cc4433',
            letterSpacing: 3
        }).setDepth(300).setScrollFactor(0);

        this.add.text(20, 48, 'OBJECTIVE: REACH THE CORE', {
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#993322'
        }).setDepth(300).setScrollFactor(0);

        const hudLine = this.add.graphics();
        hudLine.lineStyle(1, 0x662211, 0.5);
        hudLine.lineBetween(20, 68, 260, 68);
        hudLine.setDepth(300).setScrollFactor(0);

        // --- CONTROLS ---
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        // Intense glitch effects
        this.time.addEvent({
            delay: 4000 + Math.random() * 3000,
            callback: () => {
                if (!this.hasReachedCore) {
                    this.cameras.main.shake(300, 0.008);
                    this.cameras.main.flash(100, 40, 0, 0);
                }
            },
            loop: true
        });

        // Intro
        this.time.delayedCall(1200, () => {
            this.showDialogue([
                'ACT III — THE NEURO-CORE',
                '⚠ CRITICAL SECTOR — UNAUTHORIZED ACCESS',
                'The air vibrates with electromagnetic interference.',
                'The Neuro-Core pulses at the center… the source of everything.',
                'Walk toward the core to make your final decision.'
            ]);
        });

        EventBus.emit('current-scene-ready', this);
    }

    triggerEnding ()
    {
        this.isShowingDialogue = true;
        this.player.body.setVelocity(0);

        this.cameras.main.shake(500, 0.01);
        this.cameras.main.flash(500, 60, 10, 10);

        this.time.delayedCall(800, () => {
            this.showDialogue([
                'The Neuro-Core activates. Mira\'s voice echoes through the chamber.',
                '"Aarav… you found me. All those minds, trapped in the system."',
                '"I tried to protect them. The protocol was supposed to heal, not contain."',
                '"Now you must choose. The system awaits your command."',
            ], () => {
                this.showChoices();
            });
        });
    }

    showChoices ()
    {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setDepth(600).setScrollFactor(0);

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(0, 0, width, height);
        container.add(overlay);

        // Title
        container.add(this.add.text(width / 2, height * 0.22, 'WHAT WILL YOU DO?', {
            fontFamily: '"Courier New", monospace',
            fontSize: '22px',
            color: '#cc4433',
            letterSpacing: 4
        }).setOrigin(0.5));

        const choices = [
            { text: '⚡ DESTROY THE SYSTEM', desc: 'Release the trapped minds. Erase Mira forever.', color: '#ff4444' },
            { text: '🧠 UPLOAD YOURSELF', desc: 'Join Mira in the archive. Preserve all knowledge.', color: '#4488ff' },
            { text: '⚖ MERGE & REFORM', desc: 'Rebuild the system ethically. A new beginning.', color: '#44cc66' },
        ];

        choices.forEach((choice, i) => {
            const y = height * 0.38 + i * 95;

            const btnBg = this.add.graphics();
            btnBg.fillStyle(0x111122, 0.9);
            btnBg.fillRoundedRect(width / 2 - 200, y - 18, 400, 65, 4);
            btnBg.lineStyle(1, Phaser.Display.Color.HexStringToColor(choice.color).color, 0.5);
            btnBg.strokeRoundedRect(width / 2 - 200, y - 18, 400, 65, 4);
            container.add(btnBg);

            const btn = this.add.text(width / 2, y + 2, choice.text, {
                fontFamily: '"Courier New", monospace',
                fontSize: '16px',
                color: choice.color,
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            container.add(btn);

            const desc = this.add.text(width / 2, y + 25, choice.desc, {
                fontFamily: '"Courier New", monospace',
                fontSize: '10px',
                color: '#667788',
            }).setOrigin(0.5);
            container.add(desc);

            btn.on('pointerover', () => btn.setColor('#ffffff'));
            btn.on('pointerout', () => btn.setColor(choice.color));

            btn.on('pointerdown', () => {
                this.cameras.main.fadeOut(1500, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('GameOver', { ending: choice.text, description: choice.desc });
                });
            });
        });
    }

    showDialogue (lines: string[], onComplete?: () => void)
    {
        this.isShowingDialogue = true;

        const { width, height } = this.scale;
        const boxH = 130;
        const boxY = height - boxH - 20;

        this.dialogueBox = this.add.container(0, 0).setDepth(500).setScrollFactor(0);

        const panel = this.add.graphics();
        panel.fillStyle(0x120508, 0.93);
        panel.fillRoundedRect(40, boxY, width - 80, boxH, 4);
        panel.lineStyle(1, 0x553322, 0.6);
        panel.strokeRoundedRect(40, boxY, width - 80, boxH, 4);
        this.dialogueBox.add(panel);

        this.dialogueBox.add(this.add.text(60, boxY + 10, '◆ MIRA / SYSTEM', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#cc4433'
        }));

        let idx = 0;
        const txt = this.add.text(60, boxY + 30, '', {
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            color: '#ddaaaa',
            wordWrap: { width: width - 140 },
            lineSpacing: 5
        });
        this.dialogueBox.add(txt);

        const hint = this.add.text(width - 80, boxY + boxH - 20, '[CLICK]', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#664433'
        });
        this.dialogueBox.add(hint);

        this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

        const advance = () => {
            if (idx < lines.length) { txt.setText(lines[idx]); idx++; }
            else {
                this.dialogueBox?.destroy();
                this.dialogueBox = null;
                this.isShowingDialogue = false;
                this.input.off('pointerdown', advance);
                if (onComplete) onComplete();
            }
        };

        advance();
        this.input.on('pointerdown', advance);
    }

    update ()
    {
        if (this.isShowingDialogue || this.hasReachedCore) {
            this.player.body.setVelocity(0);
            return;
        }

        this.player.body.setVelocity(0);

        const left = this.cursors.left?.isDown || this.wasd.A.isDown;
        const right = this.cursors.right?.isDown || this.wasd.D.isDown;
        const up = this.cursors.up?.isDown || this.wasd.W.isDown;
        const down = this.cursors.down?.isDown || this.wasd.S.isDown;

        if (left) this.player.body.setVelocityX(-this.speed);
        else if (right) this.player.body.setVelocityX(this.speed);

        if (up) this.player.body.setVelocityY(-this.speed);
        else if (down) this.player.body.setVelocityY(this.speed);

        this.player.body.velocity.normalize().scale(this.speed);

        this.updatePlayerPose();
    }

    private updatePlayerPose() {
        const vx = this.player.body.velocity.x;
        const vy = this.player.body.velocity.y;

        if (Math.abs(vx) > Math.abs(vy)) {
            if (vx > 0) {
                // Moving Right -> Bottom Left quadrant in sheet
                this.player.setCrop(230, 562, 310, 420);
            } else if (vx < 0) {
                // Moving Left -> Bottom Right quadrant in sheet
                this.player.setCrop(998, 562, 310, 420);
            }
        } else if (Math.abs(vy) > Math.abs(vx)) {
            if (vy > 0) {
                // Moving Down -> Top Left quadrant
                this.player.setCrop(230, 50, 310, 420);
            } else if (vy < 0) {
                // Moving Up -> Top Right quadrant
                this.player.setCrop(998, 50, 310, 420);
            }
        }
    }
}
