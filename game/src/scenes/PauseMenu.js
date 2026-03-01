import { Scene } from 'phaser';
import ApiService from '../services/ApiService';
import { GAME_FONT_FAMILY } from '../constants/fonts';

export class PauseMenu extends Scene {
    constructor() {
        super('PauseMenu');
    }

    create() {
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        
        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 1);
        panel.fillRoundedRect(centerX - 200, centerY - 150, 400, 300, 20);
        panel.lineStyle(4, 0x000000, 1);
        panel.strokeRoundedRect(centerX - 200, centerY - 150, 400, 300, 20);

        this.add.text(centerX, centerY - 120, 'GAME PAUSED', {
            fontSize: '28px',
            fontFamily: GAME_FONT_FAMILY,
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const buttonY = centerY - 50;
        const buttonSpacing = 70;

        this.createButton(centerX, buttonY, 'Resume Game', () => {
            this.resumeGame();
        }, {
            palette: {
                top: 0x3dba92,
                bottom: 0x23735a,
                hoverTop: 0x52d1a8,
                hoverBottom: 0x2e8f70,
                pressedBottom: 0x185544,
                border: 0xcff9eb,
                shadow: 0x071b16,
                glow: 0x82ffd8,
                text: '#f6fffb'
            }
        });

        this.createButton(centerX, buttonY + buttonSpacing, 'Main Menu', () => {
            this.returnToMainMenu();
        }, {
            palette: {
                top: 0x4b8fd2,
                bottom: 0x2a5d99,
                hoverTop: 0x67acef,
                hoverBottom: 0x3a74b4,
                pressedBottom: 0x1a3e66,
                border: 0xd8eeff,
                shadow: 0x081624,
                glow: 0x9dd3ff,
                text: '#f7fbff'
            }
        });

        this.createButton(centerX, buttonY + buttonSpacing * 2, 'Reset Game', () => {
            this.resetGame();
        }, {
            palette: {
                top: 0xd86464,
                bottom: 0x903737,
                hoverTop: 0xef7c7c,
                hoverBottom: 0xb94b4b,
                pressedBottom: 0x662323,
                border: 0xffd5d5,
                shadow: 0x250b0b,
                glow: 0xff9f9f,
                text: '#fff6f6'
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.resumeGame();
        });
    }

    createButton(x, y, text, callback, options = {}) {
        const buttonWidth = 250;
        const buttonHeight = 50;
        const cornerRadius = 15;
        const palette = options.palette || {
            top: 0x4b8fd2,
            bottom: 0x2a5d99,
            hoverTop: 0x67acef,
            hoverBottom: 0x3a74b4,
            pressedBottom: 0x1a3e66,
            border: 0xd8eeff,
            shadow: 0x081624,
            glow: 0x9dd3ff,
            text: '#f7fbff'
        };
        
        const shadow = this.add.graphics();
        const button = this.add.graphics();
        button.setInteractive(
            new Phaser.Geom.Rectangle(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight),
            Phaser.Geom.Rectangle.Contains
        );
        this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette);

        const buttonText = this.add.text(x, y, text, {
            fontSize: '22px',
            fontFamily: GAME_FONT_FAMILY,
            color: palette.text, 
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const baseTextY = y;

        button.on('pointerover', () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'hover', palette);
            buttonText.y = baseTextY - 2;
        });

        button.on('pointerout', () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette);
            buttonText.y = baseTextY;
        });

        button.on('pointerdown', () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'pressed', palette);
            buttonText.y = baseTextY + 1;
        });

        button.on('pointerup', () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'hover', palette);
            buttonText.y = baseTextY - 2;
            callback();
        });

        button.on('pointerupoutside', () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette);
            buttonText.y = baseTextY;
        });
        
        return { button, shadow, text: buttonText };
    }

    updateButtonStyle(button, shadow, x, y, width, height, radius, state, palette) {
        button.clear();
        shadow.clear();

        const styleByState = {
            default: { top: palette.top, bottom: palette.bottom, border: palette.border, offset: 5, glow: 0 },
            hover: { top: palette.hoverTop, bottom: palette.hoverBottom, border: 0xffffff, offset: 3, glow: 0.3 },
            pressed: { top: palette.bottom, bottom: palette.pressedBottom, border: palette.border, offset: 1, glow: 0.12 }
        };
        const style = styleByState[state] || styleByState.default;

        shadow.fillStyle(palette.shadow, 0.58);
        shadow.fillRoundedRect(x - width / 2, y - height / 2 + style.offset, width, height, radius);

        if (style.glow > 0) {
            shadow.lineStyle(3, palette.glow, style.glow);
            shadow.strokeRoundedRect(x - width / 2 - 1, y - height / 2 - 1, width + 2, height + 2, radius + 1);
        }

        button.fillGradientStyle(style.top, style.top, style.bottom, style.bottom, 1);
        button.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
        button.lineStyle(2, style.border, 1);
        button.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    }

    resumeGame() {
        this.scene.resume('Game');
        this.scene.stop();
    }

    returnToMainMenu() {
        this.scene.stop('Game');
        this.scene.start('MainMenu');
    }

    async resetGame() {
        try {
            await ApiService.resetMemory();
            
            this.scene.stop('Game');
            this.scene.start('Game');
            this.scene.stop();
        } catch (error) {
            console.error('Failed to reset game:', error);

            const centerX = this.cameras.main.width / 2;
            const centerY = this.cameras.main.height / 2 + 120;
            
            const errorText = this.add.text(centerX, centerY, 'Failed to reset game. Try again.', {
                fontSize: '16px',
                fontFamily: GAME_FONT_FAMILY,
                color: '#FF0000'
            }).setOrigin(0.5);
            
            this.time.delayedCall(3000, () => {
                errorText.destroy();
            });
        }
    }
} 
