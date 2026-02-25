import { Scene, GameObjects, Physics } from 'phaser';
import { EventBus } from '../EventBus';

export class Act1Scene extends Scene
{
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private speed: number = 180;
    private exitZone!: GameObjects.Zone;
    private clues: GameObjects.Graphics[] = [];
    private cluesCollected: number = 0;
    private clueCountText!: GameObjects.Text;
    private dialogueBox!: GameObjects.Container | null;
    private isShowingDialogue: boolean = false;
    private transitioned: boolean = false;

    // World and map properties
    private map!: Phaser.Tilemaps.Tilemap;
    private worldW = 1584; // 99 tiles * 16px
    private worldH = 1328; // 83 tiles * 16px

    constructor ()
    {
        super('Act1Scene');
    }

    create ()
    {
        // Reset state
        this.isShowingDialogue = false;
        this.transitioned = false;
        this.cluesCollected = 0;
        this.dialogueBox = null;

        this.cameras.main.setBackgroundColor(0x05070B);
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        // --- TILEMAP ---
        this.map = this.make.tilemap({ key: 'act1-map' });
        const tileset = this.map.addTilesetImage('spritefusion', 'act1-tiles');
        
        // Create layers
        const layer0 = this.map.createLayer('Layer_0', tileset!, 0, 0);
        
        // Update world dimensions based on map
        this.worldW = this.map.widthInPixels;
        this.worldH = this.map.heightInPixels;

        // Set world physics bounds
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

        // Set up collisions (we can use setCollisionByExclusion([-1]) for simplicity or check properties)
        layer0?.setCollisionByProperty({ collider: true });

        // --- SCANLINE OVERLAY (fixed to camera) ---
        const { width, height } = this.scale;
        const scanlines = this.add.graphics();
        scanlines.setDepth(200);
        scanlines.setScrollFactor(0);
        scanlines.setAlpha(0.04);
        for (let y = 0; y < height; y += 2) {
            scanlines.fillStyle(0x000000);
            scanlines.fillRect(0, y, width, 1);
        }

        // --- PLAYER ---
        // Aarav sprite: 1536x1024 image with 2x2 grid (front, back, left, right)
        // Front-facing is top-left quadrant
        this.player = this.physics.add.sprite(200, this.worldH / 2, 'aarav');
        this.player.setDisplaySize(150, 200);
        this.player.setDepth(50);
        // Crop to front-facing quadrant (top-left of 2x2 grid)
        this.player.setCrop(230, 50, 310, 420);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(220, 300);
        this.player.body.setOffset(40, 60);

        // --- COLLISIONS ---
        if (layer0) {
            this.physics.add.collider(this.player, layer0);
        }

        // --- CAMERA follow ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        // --- COLLECTIBLE CLUES ---
        this.createClues();

        // --- EXIT ZONE (far right side of world) ---
        this.exitZone = this.add.zone(this.worldW - 40, this.worldH / 2, 80, this.worldH);
        this.physics.add.existing(this.exitZone, true);

        // Exit visual indicator
        const exitGfx = this.add.graphics();
        exitGfx.setDepth(40);
        exitGfx.fillStyle(0x4466aa, 0.12);
        exitGfx.fillRect(this.worldW - 80, 0, 80, this.worldH);

        // Pulsing exit arrow
        const exitArrow = this.add.text(this.worldW - 50, this.worldH / 2, '▶', {
            fontSize: '36px',
            color: '#6688cc'
        }).setOrigin(0.5).setDepth(41);

        this.tweens.add({
            targets: exitArrow,
            alpha: { from: 0.3, to: 1 },
            x: { from: this.worldW - 55, to: this.worldW - 35 },
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Exit overlap
        this.physics.add.overlap(this.player, this.exitZone, () => {
            this.transitionToNext();
        });

        // --- HUD (fixed to camera) ---
        this.createHUD();

        // --- CONTROLS ---
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        // --- INTRO DIALOGUE ---
        this.time.delayedCall(1200, () => {
            this.showDialogue([
                'SYSTEM LOG: Subject detected — Sector A-7.',
                'Dr. Aarav Sen… you shouldn\'t be here.',
                'Archive records are corrupted. Find the data fragments.',
                'Move with ARROW KEYS or WASD. Explore → reach the exit on the right.'
            ]);
        });

        EventBus.emit('current-scene-ready', this);
    }


    createClues ()
    {
        // Spread clues across the large world
        const positions = [
            { x: 350, y: 350 },
            { x: 700, y: 900 },
            { x: 1100, y: 250 },
            { x: 900, y: 700 },
            { x: 1500, y: 1200 },
        ];

        positions.forEach((pos) => {
            const orb = this.add.graphics();
            orb.setDepth(45);
            // Layered glow circles
            orb.fillStyle(0x4488ff, 0.08);
            orb.fillCircle(0, 0, 24);
            orb.fillStyle(0x4488ff, 0.15);
            orb.fillCircle(0, 0, 14);
            orb.fillStyle(0x88bbff, 0.5);
            orb.fillCircle(0, 0, 6);
            orb.fillStyle(0xffffff, 0.9);
            orb.fillCircle(0, 0, 2);
            orb.setPosition(pos.x, pos.y);

            this.tweens.add({
                targets: orb,
                scaleX: { from: 0.8, to: 1.4 },
                scaleY: { from: 0.8, to: 1.4 },
                alpha: { from: 0.5, to: 1 },
                duration: 1200 + Math.random() * 600,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            const clueZone = this.add.zone(pos.x, pos.y, 40, 40);
            this.physics.add.existing(clueZone, true);

            this.physics.add.overlap(this.player, clueZone, () => {
                if (!orb.active) return;
                orb.setActive(false);
                this.cluesCollected++;
                this.clueCountText.setText(`DATA FRAGMENTS: ${this.cluesCollected}/5`);

                this.tweens.add({
                    targets: orb,
                    scaleX: 2.5, scaleY: 2.5, alpha: 0,
                    duration: 300,
                    onComplete: () => { orb.destroy(); clueZone.destroy(); }
                });
                this.cameras.main.flash(200, 40, 60, 120);
            });

            this.clues.push(orb);
        });
    }

    createHUD ()
    {
        this.add.text(20, 20, 'ACT I — THE ARCHIVE', {
            fontFamily: '"Courier New", monospace',
            fontSize: '16px',
            color: '#667799',
            letterSpacing: 3
        }).setDepth(300).setScrollFactor(0);

        this.clueCountText = this.add.text(20, 48, 'DATA FRAGMENTS: 0/5', {
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#556677'
        }).setDepth(300).setScrollFactor(0);

        const hudLine = this.add.graphics();
        hudLine.lineStyle(1, 0x334455, 0.5);
        hudLine.lineBetween(20, 68, 220, 68);
        hudLine.setDepth(300).setScrollFactor(0);

        // Mini instruction
        this.add.text(20, 78, '→ Explore and reach the exit', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#445566'
        }).setDepth(300).setScrollFactor(0);
    }

    showDialogue (lines: string[])
    {
        if (this.isShowingDialogue) return;
        this.isShowingDialogue = true;

        const { width, height } = this.scale;
        const boxHeight = 130;
        const boxY = height - boxHeight - 20;

        this.dialogueBox = this.add.container(0, 0).setDepth(500).setScrollFactor(0);

        const panel = this.add.graphics();
        panel.fillStyle(0x0a0e18, 0.93);
        panel.fillRoundedRect(40, boxY, width - 80, boxHeight, 4);
        panel.lineStyle(1, 0x334466, 0.6);
        panel.strokeRoundedRect(40, boxY, width - 80, boxHeight, 4);
        this.dialogueBox.add(panel);

        const sysLabel = this.add.text(60, boxY + 10, '◆ SYSTEM', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#4466aa'
        });
        this.dialogueBox.add(sysLabel);

        let lineIndex = 0;
        const textContent = this.add.text(60, boxY + 30, '', {
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            color: '#aabbdd',
            wordWrap: { width: width - 140 },
            lineSpacing: 5
        });
        this.dialogueBox.add(textContent);

        const continueHint = this.add.text(width - 80, boxY + boxHeight - 20, '[CLICK]', {
            fontFamily: '"Courier New", monospace',
            fontSize: '10px',
            color: '#556688'
        });
        this.dialogueBox.add(continueHint);

        this.tweens.add({
            targets: continueHint,
            alpha: { from: 0.4, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        const advance = () => {
            if (lineIndex < lines.length) {
                textContent.setText(lines[lineIndex]);
                lineIndex++;
            } else {
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
            this.scene.start('Act2Scene');
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
