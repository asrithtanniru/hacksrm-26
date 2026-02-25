import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        // Dark tinted background
        const bg = this.add.image(512, 384, 'background');
        bg.setTint(0x222233);

        // Title while loading
        this.add.text(512, 280, 'THE QUIET PROTOCOL', {
            fontFamily: '"Courier New", monospace',
            fontSize: '28px',
            color: '#8899bb',
            letterSpacing: 6
        }).setOrigin(0.5);

        // Loading bar outline
        this.add.rectangle(512, 384, 400, 8).setStrokeStyle(1, 0x445577);

        // Loading bar fill
        const bar = this.add.rectangle(512 - 198, 384, 4, 6, 0x6688cc);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (396 * progress);
        });

        // Loading status text
        this.add.text(512, 410, 'INITIALIZING NEURAL ARCHIVE...', {
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#556688'
        }).setOrigin(0.5);
    }

    preload ()
    {
        this.load.setPath('assets');
        // Environment backgrounds
        this.load.image('hallway-bg', 'TQP_A1_ENV_Hallway_Base.png');
        this.load.image('trauma-bg', 'TQP_A1_ENV_TraumaRoom_Base.png');
        this.load.image('neurocore-bg', 'TQP_AF_ENV_NeuroCore_Base.png');
        this.load.image('security-tiles', 'TQP_A1_TILE_SecurityRoom_Modular.png');

        // Tilemaps
        this.load.tilemapTiledJSON('act1-map', 'act1-map.json');
        this.load.image('act1-tiles', 'act1-tiles.png');

        // Character sprites
        this.load.image('aarav', 'TQP_NPC_Aarav_Idle.png');
        this.load.image('janitor', 'TQP_A3_NPC_Janitor_Idle.png');
    }

    create ()
    {
        this.scene.start('MainMenu');
    }
}
