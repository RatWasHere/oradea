function dismissContent(content) {
  if (!settingsFS.existsSync('./Dismissed Content')) {
    settingsFS.mkdirSync('./Dismissed Content')
  }

  settingsFS.writeFileSync(`./Dismissed Content/${content}`, '1')
}
function isDismissed(content) {
  return settingsFS.existsSync(`./Dismissed Content/${content}`, () => { })
}