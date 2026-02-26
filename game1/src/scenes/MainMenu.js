import { Scene } from 'phaser'
import ApiService from '../services/ApiService'
import { walletAuthContext } from '../contexts/WalletAuthContext'
import { GAME_FONT_FAMILY } from '../constants/fonts'

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu')
    this.walletUnsubscribe = null
    this.walletButtonElements = null
    this.walletStatusText = null
    this.walletAddressText = null
    this.nameEntryModal = null
    this.nameEntryInput = ''
    this.nameEntryKeyHandler = null
  }

  create() {
    this.add.image(0, 0, 'background').setOrigin(0, 0)
    this.addGameTitle()
    this.add.image(510, 260, 'logo').setScale(0.55)

    const centerX = this.cameras.main.width / 2
    const startY = 524
    const buttonSpacing = 70

    this.createButton(centerX, startY, "Let's Play!", () => {
      this.showNameEntryDialog()
    })

    this.createButton(centerX, startY + buttonSpacing, 'Instructions', () => {
      this.showInstructions()
    })

    // this.createButton(centerX, startY + buttonSpacing * 2, 'Support Philoagents', () => {
    //   window.open('https://github.com/neural-maze/philoagents-course', '_blank')
    // })

    this.setupWalletUI()
    this.events.once('shutdown', () => {
      this.cleanupWalletUI()
      this.destroyNameEntryDialog()
    })
  }

  addGameTitle() {
    const centerX = this.cameras.main.width / 2
    const titleY = this.cameras.main.height / 2

    const titleText = this.add
      .text(centerX, titleY, 'Mystic\nWorld', {
        fontSize: '54px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#000000',
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)

    const paddingX = 54
    const paddingY = 30
    const radius = 44
    const panelWidth = titleText.width + paddingX * 2
    const panelHeight = titleText.height + paddingY * 2

    const titleBg = this.add.graphics()
    titleBg.fillStyle(0xffffff, 1)
    titleBg.fillRoundedRect(centerX - panelWidth / 2, titleY - panelHeight / 2, panelWidth, panelHeight, radius)
    titleBg.lineStyle(3, 0x000000, 1)
    titleBg.strokeRoundedRect(centerX - panelWidth / 2, titleY - panelHeight / 2, panelWidth, panelHeight, radius)

    titleBg.setDepth(4)
    titleText.setDepth(5)
  }

  async startGameWithName(playerNameInput) {
    const playerName = playerNameInput?.trim() || 'Subject-0'

    const startPayload = { playerName }

    try {
      const roomName = `quiet-protocol-session-${playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const identity = `subject-${Date.now()}`

      // 1) First call must be token API.
      const tokenResponse = await ApiService.createLivekitToken({
        roomName,
        identity,
        name: playerName,
        metadata: JSON.stringify({ player_name: playerName, role: 'subject' }),
        ttlMinutes: 60,
      })

      // 2) Then fetch live character list.
      const charactersResponse = await ApiService.listLivekitCharacters()
      const availableCharacters = Array.isArray(charactersResponse?.characters) ? charactersResponse.characters : []
      startPayload.availableCharacters = availableCharacters

      // 3) Then launch selected/default character agent.
      if (availableCharacters.length > 0) {
        const defaultCharacter = availableCharacters[0]
        const launchResponse = await ApiService.launchCharacterRoom({
          roomName,
          characterToken: defaultCharacter.character_token,
          userIdentity: identity,
          userName: playerName,
          replaceExistingDispatches: true,
        })

        startPayload.launchBootstrap = {
          roomName,
          characterToken: defaultCharacter.character_token,
          userToken: launchResponse?.user_token || tokenResponse?.token || null,
          url: launchResponse?.livekit_url || launchResponse?.url || null,
        }
      } else {
        startPayload.launchBootstrap = {
          roomName,
          characterToken: null,
          userToken: tokenResponse?.token || null,
          url: tokenResponse?.url || null,
        }
      }
    } catch (error) {
      // Non-blocking bootstrapping. Game can still start and launch lazily.
      console.warn('LiveKit prelaunch failed at start flow:', error)
    }

    this.scene.start('Game', startPayload)
  }

  showNameEntryDialog() {
    if (this.nameEntryModal) {
      return
    }

    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const centerX = width / 2
    const centerY = height / 2
    const panelWidth = 560
    const panelHeight = 280
    const panelX = centerX - panelWidth / 2
    const panelY = centerY - panelHeight / 2
    const depth = 90

    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0.74)
    overlay.fillRect(0, 0, width, height)
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains).setDepth(depth)

    const panel = this.add.graphics()
    panel.fillStyle(0x090909, 0.96)
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 18)
    panel.lineStyle(3, 0x6bb0ff, 0.95)
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 18)
    panel.lineStyle(1, 0x1f2f4f, 0.9)
    for (let lineY = panelY + 10; lineY < panelY + panelHeight - 10; lineY += 4) {
      panel.lineBetween(panelX + 8, lineY, panelX + panelWidth - 8, lineY)
    }
    panel.setDepth(depth + 1)

    const title = this.add
      .text(centerX, panelY + 44, 'ENTER SUBJECT NAME', {
        fontSize: '28px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#cce8ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    const subtitle = this.add
      .text(centerX, panelY + 78, 'Type and press Enter (max 24 chars)', {
        fontSize: '16px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#8db9de',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    const inputBg = this.add
      .rectangle(centerX, panelY + 132, panelWidth - 80, 56, 0x0d1e31, 0.95)
      .setStrokeStyle(2, 0x6bb0ff, 1)
      .setDepth(depth + 2)

    this.nameEntryInput = ''

    const inputText = this.add
      .text(panelX + 54, panelY + 113, 'Type your name...', {
        fontSize: '26px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#7fa2c2',
        fontStyle: 'bold',
      })
      .setDepth(depth + 3)

    const errorText = this.add
      .text(centerX, panelY + 174, '', {
        fontSize: '16px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#ffb2b2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    const startButton = this.createButton(
      centerX - 92,
      panelY + 226,
      'Start',
      () => {
        this.submitNameEntry()
      },
      {
        buttonWidth: 160,
        buttonHeight: 48,
        cornerRadius: 14,
        maxFontSize: 22,
        palette: {
          top: 0x3dba92,
          bottom: 0x23735a,
          border: 0xcff9eb,
          shadow: 0x071b16,
          glow: 0x82ffd8,
          text: '#f6fffb',
        },
      },
    )
    startButton.shadow.setDepth(depth + 2)
    startButton.button.setDepth(depth + 3)
    startButton.text.setDepth(depth + 4)

    const cancelButton = this.createButton(
      centerX + 92,
      panelY + 226,
      'Cancel',
      () => {
        this.destroyNameEntryDialog()
      },
      {
        buttonWidth: 160,
        buttonHeight: 48,
        cornerRadius: 14,
        maxFontSize: 22,
        palette: {
          top: 0x4b8fd2,
          bottom: 0x2a5d99,
          border: 0xd8eeff,
          shadow: 0x081624,
          glow: 0x9dd3ff,
          text: '#f7fbff',
        },
      },
    )
    cancelButton.shadow.setDepth(depth + 2)
    cancelButton.button.setDepth(depth + 3)
    cancelButton.text.setDepth(depth + 4)

    this.nameEntryModal = {
      overlay,
      panel,
      title,
      subtitle,
      inputBg,
      inputText,
      errorText,
      startButton,
      cancelButton,
    }

    this.nameEntryKeyHandler = (event) => {
      if (!this.nameEntryModal) {
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        this.nameEntryInput = this.nameEntryInput.slice(0, -1)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        this.submitNameEntry()
        return
      } else if (event.key === 'Escape') {
        event.preventDefault()
        this.destroyNameEntryDialog()
        return
      } else if (event.key?.length === 1 && /^[a-zA-Z0-9 _-]$/.test(event.key) && this.nameEntryInput.length < 24) {
        this.nameEntryInput += event.key
      } else {
        return
      }

      this.updateNameEntryInputText()
    }

    this.input.keyboard.on('keydown', this.nameEntryKeyHandler)
    this.updateNameEntryInputText()
  }

  updateNameEntryInputText() {
    if (!this.nameEntryModal) {
      return
    }

    if (this.nameEntryInput.length > 0) {
      this.nameEntryModal.inputText.setText(`${this.nameEntryInput}_`)
      this.nameEntryModal.inputText.setColor('#f2fbff')
      return
    }

    this.nameEntryModal.inputText.setText('Type your name...')
    this.nameEntryModal.inputText.setColor('#7fa2c2')
  }

  submitNameEntry() {
    if (!this.nameEntryModal) {
      return
    }

    const trimmedName = this.nameEntryInput.trim()
    if (!trimmedName) {
      this.nameEntryModal.errorText.setText('Name cannot be empty.')
      return
    }

    this.destroyNameEntryDialog()
    this.startGameWithName(trimmedName)
  }

  destroyNameEntryDialog() {
    if (!this.nameEntryModal) {
      return
    }

    if (this.nameEntryKeyHandler) {
      this.input.keyboard.off('keydown', this.nameEntryKeyHandler)
      this.nameEntryKeyHandler = null
    }

    const { overlay, panel, title, subtitle, inputBg, inputText, errorText, startButton, cancelButton } = this.nameEntryModal
    overlay.destroy()
    panel.destroy()
    title.destroy()
    subtitle.destroy()
    inputBg.destroy()
    inputText.destroy()
    errorText.destroy()
    startButton.button.destroy()
    startButton.shadow.destroy()
    startButton.text.destroy()
    cancelButton.button.destroy()
    cancelButton.shadow.destroy()
    cancelButton.text.destroy()

    this.nameEntryInput = ''
    this.nameEntryModal = null
  }

  createButton(x, y, text, callback, options = {}) {
    const buttonWidth = options.buttonWidth || 350
    const buttonHeight = options.buttonHeight || 60
    const cornerRadius = options.cornerRadius || 20
    const maxFontSize = options.maxFontSize || 28
    const padding = options.padding || 10
    const palette = options.palette || {
      top: 0x2e7bb7,
      bottom: 0x1f4d84,
      border: 0xa6ddff,
      shadow: 0x071625,
      glow: 0x63c8ff,
      text: '#f7fbff',
    }

    const shadow = this.add.graphics()
    const button = this.add.graphics()
    button.setInteractive(new Phaser.Geom.Rectangle(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains)
    this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette)

    let fontSize = maxFontSize
    let buttonText
    do {
      if (buttonText) buttonText.destroy()

      buttonText = this.add
        .text(x, y, text, {
          fontSize: `${fontSize}px`,
          fontFamily: GAME_FONT_FAMILY,
          color: palette.text,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)

      fontSize -= 1
    } while (buttonText.width > buttonWidth - padding && fontSize > 10)

    const baseTextY = y

    button.on('pointerover', () => {
      this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'hover', palette)
      buttonText.y = baseTextY - 2
    })

    button.on('pointerout', () => {
      this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette)
      buttonText.y = baseTextY
    })

    button.on('pointerdown', () => {
      this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'pressed', palette)
      buttonText.y = baseTextY + 1
    })

    button.on('pointerup', () => {
      this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'hover', palette)
      buttonText.y = baseTextY - 2
      callback()
    })

    button.on('pointerupoutside', () => {
      this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, 'default', palette)
      buttonText.y = baseTextY
    })

    return { button, shadow, text: buttonText }
  }

  updateButtonStyle(button, shadow, x, y, width, height, radius, state, palette) {
    button.clear()
    shadow.clear()

    const styleByState = {
      default: { top: palette.top, bottom: palette.bottom, border: palette.border, offset: 5, glow: 0 },
      hover: { top: 0x4197d6, bottom: 0x2a629f, border: 0xd4efff, offset: 3, glow: 0.35 },
      pressed: { top: 0x1f4d84, bottom: 0x173b63, border: 0x8ec8ef, offset: 1, glow: 0.15 },
    }
    const style = styleByState[state] || styleByState.default

    shadow.fillStyle(palette.shadow, 0.55)
    shadow.fillRoundedRect(x - width / 2, y - height / 2 + style.offset, width, height, radius)

    if (style.glow > 0) {
      shadow.lineStyle(3, palette.glow, style.glow)
      shadow.strokeRoundedRect(x - width / 2 - 1, y - height / 2 - 1, width + 2, height + 2, radius + 1)
    }

    button.fillGradientStyle(style.top, style.top, style.bottom, style.bottom, 1)
    button.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
    button.lineStyle(2, style.border, 1)
    button.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  }

  showInstructions() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const centerX = width / 2
    const centerY = height / 2

    const elements = this.createInstructionPanel(centerX, centerY)

    const instructionContent = this.addInstructionContent(centerX, centerY, elements.panel)
    elements.title = instructionContent.title
    elements.textElements = instructionContent.textElements

    const closeElements = this.addCloseButton(centerX, centerY + 79, () => {
      this.destroyInstructionElements(elements)
    })
    elements.closeButton = closeElements.button
    elements.closeText = closeElements.text

    elements.overlay.on('pointerdown', () => {
      this.destroyInstructionElements(elements)
    })
  }

  createInstructionPanel(centerX, centerY) {
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height)
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.cameras.main.width, this.cameras.main.height), Phaser.Geom.Rectangle.Contains)

    const panel = this.add.graphics()
    panel.fillStyle(0xffffff, 1)
    panel.fillRoundedRect(centerX - 200, centerY - 150, 400, 300, 20)
    panel.lineStyle(4, 0x000000, 1)
    panel.strokeRoundedRect(centerX - 200, centerY - 150, 400, 300, 20)

    return { overlay, panel }
  }

  addInstructionContent(centerX, centerY, panel) {
    const title = this.add
      .text(centerX, centerY - 110, 'INSTRUCTIONS', {
        fontSize: '28px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#000000',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    const instructions = ['Arrow keys for moving', 'A (or E) near entity to connect voice', 'ESC for closing the dialogue']

    const textElements = []
    let yPos = centerY - 59
    instructions.forEach((instruction) => {
      textElements.push(
        this.add
          .text(centerX, yPos, instruction, {
            fontSize: '22px',
            fontFamily: GAME_FONT_FAMILY,
            color: '#000000',
          })
          .setOrigin(0.5),
      )
      yPos += 40
    })

    return { title, textElements }
  }

  addCloseButton(x, y, callback) {
    return this.createButton(x, y + 10, 'Close', callback, {
      buttonWidth: 130,
      buttonHeight: 42,
      cornerRadius: 12,
      maxFontSize: 20,
      palette: {
        top: 0x4eb5e7,
        bottom: 0x2a85b5,
        border: 0xdaf4ff,
        shadow: 0x04131d,
        glow: 0x8fdfff,
        text: '#f7fbff',
      },
    })
  }

  destroyInstructionElements(elements) {
    elements.overlay.destroy()
    elements.panel.destroy()
    elements.title.destroy()

    elements.textElements.forEach((text) => text.destroy())

    elements.closeButton.destroy()
    elements.closeText.destroy()
  }

  setupWalletUI() {
    const panelCenterX = this.cameras.main.width - 170
    const panelTopY = 64

    this.walletStatusText = this.add
      .text(panelCenterX, panelTopY - 24, 'Pelagus: checking...', {
        fontSize: '16px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#000000',
      })
      .setPadding(8, 4)
      .setOrigin(0.5)

    this.walletButtonElements = this.createButton(
      panelCenterX,
      panelTopY + 24,
      'Connect Wallet',
      () => {
        this.handleWalletButtonClick()
      },
      {
        buttonWidth: 250,
        buttonHeight: 46,
        cornerRadius: 14,
        maxFontSize: 20,
      },
    )

    this.walletAddressText = this.add
      .text(panelCenterX, panelTopY + 64, '', {
        fontSize: '14px',
        fontFamily: GAME_FONT_FAMILY,
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#000000',
      })
      .setPadding(6, 3)
      .setOrigin(0.5)

    this.walletUnsubscribe = walletAuthContext.subscribe((state) => {
      this.renderWalletState(state)
    })

    walletAuthContext.initialize()
  }

  cleanupWalletUI() {
    if (this.walletUnsubscribe) {
      this.walletUnsubscribe()
      this.walletUnsubscribe = null
    }
  }

  renderWalletState(state) {
    if (!this.walletStatusText || !this.walletButtonElements || !this.walletAddressText) {
      return
    }

    if (!state.isPelagusInstalled) {
      this.walletStatusText.setText('Pelagus not detected')
      this.walletStatusText.setColor('#ffdf6b')
      this.walletButtonElements.text.setText('Install Pelagus')
      this.walletAddressText.setText('')
      return
    }

    if (state.isConnected && state.address) {
      this.walletStatusText.setText('Wallet connected')
      this.walletStatusText.setColor('#90ee90')
      this.walletButtonElements.text.setText('Disconnect Wallet')
      this.walletAddressText.setText(this.formatAddress(state.address))
      return
    }

    this.walletStatusText.setText('Wallet not connected')
    this.walletStatusText.setColor('#ffffff')
    this.walletButtonElements.text.setText('Connect Wallet')
    this.walletAddressText.setText('')
  }

  formatAddress(address) {
    if (!address || address.length < 12) {
      return address || ''
    }

    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  async handleWalletButtonClick() {
    const state = walletAuthContext.getState()

    if (!state.isPelagusInstalled) {
      window.open('https://pelaguswallet.io/docs/develop/get-started/detecting-pelagus/', '_blank')
      return
    }

    if (state.isConnected) {
      walletAuthContext.disconnect()
      return
    }

    try {
      await walletAuthContext.connect()
    } catch (error) {
      if (error?.code === 4001) {
        console.log('Pelagus wallet connection request was rejected by the user.')
        return
      }
      console.error('Failed to connect Pelagus wallet:', error)
    }
  }
}
