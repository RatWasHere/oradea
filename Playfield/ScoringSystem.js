
class ScoringSystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  judge(noteTime, affectCombo = true, note, timeOverwrite = null) {
    if (!timeOverwrite) timeOverwrite = this.gameState.currentTime;
    const currentTime = timeOverwrite - (CONFIG.AUDIO_OFFSET || 0);

    const difference = Math.abs(noteTime - currentTime);

    let accuracy = 'miss';
    for (const [key, range] of Object.entries(CONFIG.ACCURACY_RANGES)) {
      if (difference >= range[0] && difference < range[1]) {
        accuracy = key;
        break;
      }
    }

    this.gameState.score += CONFIG.ACCURACY_SCORES[accuracy] || 0;

    if (affectCombo) {
      if (difference > 200 || isNaN(difference)) {
        this.gameState.combo = 0;
      } else {
        this.gameState.combo++;
        if (this.gameState.combo > this.gameState.maxCombo) {
          this.gameState.maxCombo = this.gameState.combo;
        }
      }
      this.updateScoreDisplays();
    }
    this.gameState.scoringPad[accuracy].push(noteTime - currentTime);

    if (CONFIG.SCORING_INDICATORS) {
      if (this.gameState.lastScoringIndicatorDisplayed) {
        this.gameState.lastScoringIndicatorDisplayed.style.visibility = 'hidden';
        this.gameState.lastScoringIndicatorDisplayed.style.animation = 'none'
      }
      this.gameState.elements.scoringIndicators[accuracy].style.visibility = 'hidden';
      this.gameState.elements.scoringIndicators[accuracy].style.animation = 'none';
      requestAnimationFrame(() => {
        this.gameState.elements.scoringIndicators[accuracy].style.visibility = 'visible'
        this.gameState.elements.scoringIndicators[accuracy].style.animation = null;
        this.gameState.lastScoringIndicatorDisplayed = this.gameState.elements.scoringIndicators[accuracy];
      });
    }



    if (note?.slider) return;
    try {
      this.gameState.playHitSound(note)
    } catch (error) { console.log(error) }
    return accuracy;
  }

  updateScoreDisplays() {
    let scoreLength = `${this.gameState.score}`.length;
    let lastScoreLength = this.gameState.cachedScoreLength || 0;
    if (scoreLength > lastScoreLength) {
      this.gameState.elements.unusedScoreNumber.textContent = '0'.repeat(15 - scoreLength);
    }
    this.gameState.cachedScoreLength = scoreLength;
    this.gameState.elements.usedScoreNumber.textContent = this.gameState.score;

    const comboText = `${this.gameState.combo}`;
    if (this.gameState.elements.comboDisplay.innerHTML !== comboText) {
      this.gameState.elements.comboDisplay.style.animation = 'none';
      this.gameState.elements.comboDisplay.textContent = comboText;
      requestAnimationFrame(() => {
        this.gameState.elements.comboDisplay.style.animation = null;
      })
    }
  }
}
