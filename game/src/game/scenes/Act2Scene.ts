import { Scene, GameObjects, Physics } from 'phaser';
import { EventBus } from '../EventBus';

export class Act2Scene extends Scene
{
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private speed: number = 180;
    private exitZone!: GameObjects.Zone;
    private janitorNpc!: GameObjects.Image;
    private dialogueBox!: GameObjects.Container | null;
    private isShowingDialogue: boolean = false;
    private janitorTalked: boolean = false;
    private transitioned: boolean = false;
    private cluesCollected: number = 0;
    private clueCountText!: GameObjects.Text;

    // Scrollable world
    private worldW = 2048;
    private worldH = 1536;

    constructor ()
    {
        super('Act2Scene');
    }

    create ()
    {
        this.isShowingDialogue = false;
        this.janitorTalked = false;
        this.transitioned = false;
        this.cluesCollected = 0;
        this.dialogueBox = null;

        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor(0x05070B);
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        // --- WORLD BACKGROUND ---
        const bg = this.add.image(this.worldW / 2, this.worldH / 2, 'trauma-bg');
        bg.setDisplaySize(this.worldW, this.worldH);

        // Danger overlay
        const dangerOverlay = this.add.graphics();
        dangerOverlay.fillStyle(0x330000, 0.08);
        dangerOverlay.fillRect(0, 0, this.worldW, this.worldH);
        dangerOverlay.setDepth(5);

        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

        // Scanline (fixed to screen)
        const scanlines = this.add.graphics();
        scanlines.setDepth(200);
        scanlines.setScrollFactor(0);
        scanlines.setAlpha(0.05);
        for (let y = 0; y < height; y += 2) {
            scanlines.fillStyle(0x000000);
            scanlines.fillRect(0, y, width, 1);
        }

        // --- DECORATIVE PROPS from Security Room tileset ---
        this.placeProps();

        // --- PLAYER ---
        this.player = this.physics.add.sprite(150, this.worldH / 2, 'aarav');
        this.player.setDisplaySize(150, 200);
        this.player.setDepth(50);
        this.player.setCrop(230, 50, 310, 420);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(220, 300);
        this.player.body.setOffset(40, 60);

        // --- CAMERA ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        // --- JANITOR NPC ---
        // Crop front-facing from the janitor turnaround (leftmost quarter)
        this.janitorNpc = this.add.image(this.worldW / 2, this.worldH / 2 - 50, 'janitor');
        this.janitorNpc.setDisplaySize(180, 270);
        this.janitorNpc.setDepth(49);
        this.janitorNpc.setCrop(30, 50, 310, 400);

        // Janitor interaction zone
        const janitorZone = this.add.zone(this.worldW / 2, this.worldH / 2 - 50, 200, 250);
        this.physics.add.existing(janitorZone, true);

        // Janitor collision body
        const janitorBody = this.physics.add.image(this.worldW / 2, this.worldH / 2 - 50, 'janitor');
        janitorBody.setDisplaySize(150, 220);
        janitorBody.setAlpha(0);
        janitorBody.setImmovable(true);
        janitorBody.body.setSize(180, 240);
        this.physics.add.collider(this.player, janitorBody);

        // Interact prompt
        const interactPrompt = this.add.text(this.worldW / 2, this.worldH / 2 - 110, '[E] TALK', {
            fontFamily: '"Courier New", monospace',
            fontSize: '11px',
            color: '#aa8844',
            backgroundColor: '#1a1510',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setDepth(55).setAlpha(0);

        // Janitor idle bob
        this.tweens.add({
            targets: this.janitorNpc,
            y: this.janitorNpc.y - 3,
            duration: 2500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Proximity check
        let nearJanitor = false;
        this.physics.add.overlap(this.player, janitorZone, () => {
            if (!nearJanitor && !this.janitorTalked) {
                nearJanitor = true;
                interactPrompt.setAlpha(1);
            }
        });

        // E key interaction
        const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        eKey.on('down', () => {
            if (nearJanitor && !this.janitorTalked && !this.isShowingDialogue) {
                this.janitorTalked = true;
                interactPrompt.setAlpha(0);
                this.showDialogue([
                    '⚠ The Janitor stares at you without blinking.',
                    '"You\'re looking for something you\'ve already lost."',
                    '"The patients… they remember things the system deleted."',
                    '"Room 14-B. That\'s where they kept the neural backups."',
                    '"But I wouldn\'t go there if I were you. The machines… they listen."',
                    'The Janitor turns away, resuming his endless sweeping.'
                ]);
            }
        });

        // --- COLLECTIBLES ---
        this.createClues();

        // --- EXIT ZONE ---
        this.exitZone = this.add.zone(this.worldW - 40, this.worldH / 2, 80, this.worldH);
        this.physics.add.existing(this.exitZone, true);

        const exitGfx = this.add.graphics();
        exitGfx.setDepth(40);
        exitGfx.fillStyle(0x662222, 0.12);
        exitGfx.fillRect(this.worldW - 80, 0, 80, this.worldH);

        const exitArrow = this.add.text(this.worldW - 50, this.worldH / 2, '▶', {
            fontSize: '36px',
            color: '#cc6644'
        }).setOrigin(0.5).setDepth(41);

        this.tweens.add({
            targets: exitArrow,
            alpha: { from: 0.3, to: 1 },
            x: { from: this.worldW - 55, to: this.worldW - 35 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        this.physics.add.overlap(this.player, this.exitZone, () => {
            this.transitionToNext();
        });

        // --- HUD ---
        this.createHUD();

        // --- CONTROLS ---
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        // Periodic glitch
        this.time.addEvent({
            delay: 8000 + Math.random() * 5000,
            callback: () => {
                if (!this.transitioned) {
                    this.cameras.main.shake(200, 0.005);
                }
            },
            loop: true
        });

        // Intro
        this.time.delayedCall(1200, () => {
            this.showDialogue([
                'ACT II — THE TRAUMA ROOM',
                'Neural residue detected in this sector.',
                'A figure stands motionless ahead…',
                'Approach with caution. Press [E] to interact with NPCs.'
            ]);
        });

        EventBus.emit('current-scene-ready', this);
    }

    placeProps ()
    {
        // Scatter props from security tiles around the trauma room world
        const props = [
            { x: 400, y: 350, cropX: 30, cropY: 30, cropW: 380, cropH: 200, sc: 0.45 },
            { x: 1400, y: 500, cropX: 450, cropY: 30, cropW: 350, cropH: 200, sc: 0.4 },
            { x: 800, y: 1200, cropX: 0, cropY: 500, cropW: 300, cropH: 200, sc: 0.5 },
        ];

        props.forEach(p => {
            const img = this.add.image(p.x, p.y, 'security-tiles');
            img.setCrop(p.cropX, p.cropY, p.cropW, p.cropH);
            img.setScale(p.sc);
            img.setDepth(12);
            img.setAlpha(0.6);
        });
    }

    createClues ()
    {
        const positions = [
            { x: 400, y: 600 },
            { x: 1300, y: 300 },
            { x: 900, y: 1100 },
        ];

        positions.forEach((pos) => {
            const orb = this.add.graphics();
            orb.setDepth(45);
            orb.fillStyle(0xff6644, 0.08);
            orb.fillCircle(0, 0, 24);
            orb.fillStyle(0xff6644, 0.15);
            orb.fillCircle(0, 0, 14);
            orb.fillStyle(0xffaa88, 0.5);
            orb.fillCircle(0, 0, 6);
            orb.fillStyle(0xffffff, 0.9);
            orb.fillCircle(0, 0, 2);
            orb.setPosition(pos.x, pos.y);

            this.tweens.add({
                targets: orb,
                scaleX: { from: 0.8, to: 1.4 },
                scaleY: { from: 0.8, to: 1.4 },
                alpha: { from: 0.5, to: 1 },
                duration: 1000 + Math.random() * 800,
                yoyo: true,
                repeat: -1
            });

            const clueZone = this.add.zone(pos.x, pos.y, 40, 40);
            this.physics.add.existing(clueZone, true);

            this.physics.add.overlap(this.player, clueZone, () => {
                if (!orb.active) return;
                orb.setActive(false);
                this.cluesCollected++;
                this.clueCountText.setText(`NEURAL LOGS: ${this.cluesCollected}/3`);

                this.tweens.add({
                    targets: orb,
                    scaleX: 2.5, scaleY: 2.5, alpha: 0,
                    duration: 300,
                    onComplete: () => { orb.destroy(); clueZone.destroy(); }
                });
                this.cameras.main.flash(200, 60, 30, 20);
            });
        });
    }

    createHUD ()
    {
        this.add.text(20, 20, 'ACT II — THE TRAUMA ROOM', {
            fontFamily: '"Courier New", monospace',
            fontSize: '16px',
            color: '#996644',
            letterSpacing: 3
        }).setDepth(300).setScrollFactor(0);

        this.clueCountText = this.add.text(20, 48, 'NEURAL LOGS: 0/3', {
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#775544'
        }).setDepth(300).setScrollFactor(0);

        const hudLine = this.add.graphics();
        hudLine.lineStyle(1, 0x553322, 0.5);
        hudLine.lineBetween(20, 68, 220, 68);
        hudLine.setDepth(300).setScrollFactor(0);
    }

    showDialogue (lines: string[])
    {
        if (this.isShowingDialogue) return;
        this.isShowingDialogue = true;

        const { width, height } = this.scale;
        const boxH = 130;
        const boxY = height - boxH - 20;

        this.dialogueBox = this.add.container(0, 0).setDepth(500).setScrollFactor(0);

        const panel = this.add.graphics();
        panel.fillStyle(0x120e0a, 0.93);
        panel.fillRoundedRect(40, boxY, width - 80, boxH, 4);
        panel.lineStyle(1, 0x443322, 0.6);
        panel.strokeRoundedRect(40, boxY, width - 80, boxH, 4);
        this.dialogueBox.add(panel);

        const label = this.add.text(60, boxY + 10, '◆ NEURAL LOG', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#aa6633'
        });
        this.dialogueBox.add(label);

        let idx = 0;
        const txt = this.add.text(60, boxY + 30, '', {
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            color: '#ddbb99',
            wordWrap: { width: width - 140 },
            lineSpacing: 5
        });
        this.dialogueBox.add(txt);

        const hint = this.add.text(width - 80, boxY + boxH - 20, '[CLICK]', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#665533'
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
            }
        };

        advance();
        this.input.on('pointerdown', advance);
    }

    transitionToNext ()
    {
        if (this.transitioned || this.isShowingDialogue) return;
        this.transitioned = true;

        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Act3Scene');
        });
    }

    update ()
    {
        if (this.isShowingDialogue) {
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
