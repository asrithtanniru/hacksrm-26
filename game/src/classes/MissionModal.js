import { gameFont } from '../constants/fonts';

class MissionModal {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.onClose = null;
    this.onClaim = null;
    this.elements = null;
    this._build();
  }

  _build() {
    const { width, height } = this.scene.scale;
    const panelWidth = Math.min(820, width - 70);
    const panelHeight = 370;
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2;

    const container = this.scene.add.container(0, 0).setDepth(180).setScrollFactor(0).setVisible(false);

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', (_pointer, _lx, _ly, event) => {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    });

    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x02070d, 0.9);
    shadow.fillRect(x + 8, y + 8, panelWidth, panelHeight);

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x07111c, 0.98);
    panel.fillRect(x, y, panelWidth, panelHeight);
    panel.lineStyle(3, 0x6bd4ff, 1);
    panel.strokeRect(x, y, panelWidth, panelHeight);
    panel.lineStyle(1, 0x16324a, 0.95);
    for (let lineY = y + 8; lineY < y + panelHeight - 8; lineY += 4) {
      panel.lineBetween(x + 6, lineY, x + panelWidth - 6, lineY);
    }

    const title = this.scene.add.text(x + panelWidth / 2, y + 40, '', {
      font: gameFont(30),
      color: '#cdeeff',
      align: 'center',
      stroke: '#081a29',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const body = this.scene.add.text(x + 30, y + 82, '', {
      font: gameFont(15),
      color: '#eff9ff',
      wordWrap: { width: panelWidth - 60 },
      lineSpacing: 6,
    });

    const status = this.scene.add.text(x + 30, y + panelHeight - 132, '', {
      font: gameFont(14),
      color: '#ffe0a8',
      backgroundColor: '#2f1f0f',
      padding: { x: 8, y: 5 },
    });

    const closeButton = this._createButton(x + panelWidth - 130, y + panelHeight - 52, 'Close', () => {
      this.hide();
      if (this.onClose) this.onClose();
    }, false);

    const claimButton = this._createButton(x + 130, y + panelHeight - 52, 'Claim Reward', () => {
      if (this.onClaim) this.onClaim();
    }, true);
    claimButton.container.setVisible(false);

    container.add([
      overlay,
      shadow,
      panel,
      title,
      body,
      status,
      closeButton.container,
      claimButton.container,
    ]);

    this.elements = {
      container,
      title,
      body,
      status,
      closeButton,
      claimButton,
      panelWidth,
      panelHeight,
      panelX: x,
      panelY: y,
    };
  }

  _createButton(x, y, label, onClick, isPrimary) {
    const width = isPrimary ? 210 : 120;
    const height = 42;
    const container = this.scene.add.container(0, 0);
    const button = this.scene.add.graphics().setScrollFactor(0);
    const text = this.scene.add.text(x, y, label, {
      font: gameFont(14),
      color: isPrimary ? '#1a1306' : '#e9f6ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);

    const draw = (hover = false) => {
      button.clear();
      if (isPrimary) {
        button.fillStyle(hover ? 0xffd377 : 0xf0b74a, 1);
        button.lineStyle(2, 0x4e3206, 1);
      } else {
        button.fillStyle(hover ? 0x2b5675 : 0x1b3b54, 1);
        button.lineStyle(2, 0x9bd8ff, 1);
      }
      button.fillRect(x - width / 2, y - height / 2, width, height);
      button.strokeRect(x - width / 2, y - height / 2, width, height);
    };

    draw(false);
    const hit = this.scene.add
      .rectangle(x, y, width, height, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', (_pointer, _lx, _ly, event) => {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    });
    hit.on('pointerup', (_pointer, _lx, _ly, event) => {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      onClick();
    });

    container.add([button, text, hit]);
    return { container, text, setLabel: (next) => text.setText(next) };
  }

  show({ title, body, status, showClaim, onClose, onClaim, claimLabel = 'Claim Reward' }) {
    this.onClose = onClose || null;
    this.onClaim = onClaim || null;
    this.elements.title.setText(title || '');
    this.elements.body.setText(body || '');
    this.elements.status.setText(status || '');
    this.elements.claimButton.setLabel(claimLabel);
    this.elements.claimButton.container.setVisible(Boolean(showClaim));

    this.elements.container.setVisible(true);
    this.elements.container.setAlpha(0);
    this.elements.container.setScale(0.96);
    this.isOpen = true;

    this.scene.tweens.add({
      targets: this.elements.container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: 'Quad.Out',
    });
  }

  hide() {
    this.elements.container.setVisible(false);
    this.isOpen = false;
    this.onClose = null;
    this.onClaim = null;
  }
}

export default MissionModal;
