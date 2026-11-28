// Executed by /usr/bin/osascript -l JavaScript (JavaScript for Automation).
ObjC.import('AppKit')

function run([action, kind, expectedPath, generation, nonce, boardName]) {
  const board = boardName
    ? $.NSPasteboard.pasteboardWithName(boardName)
    : $.NSPasteboard.generalPasteboard
  const observed = String(board.changeCount)
  if (action === 'expire' && observed !== generation) return
  if (Number(board.pasteboardItems.count) !== 1) return

  const item = board.pasteboardItems.firstObject
  if (kind === 'file') {
    const value = item.stringForType($.NSPasteboardTypeFileURL)
    if (!value.js) return
    const file = $.NSURL.URLWithString(value)
    if (
      !file.isFileURL ||
      file.URLByStandardizingPath.path.js !==
        $.NSURL.fileURLWithPath(expectedPath).URLByStandardizingPath.path.js
    )
      return
  } else if (kind === 'text') {
    if (item.stringForType($.NSPasteboardTypeString).js !== expectedPath) return
  } else {
    return
  }

  const ownerType = 'com.memebank.raycast.copy-id'
  if (action === 'arm') {
    // Another process owns the item written by Raycast. Preserve its file formats
    // and concealed marker when taking ownership with the per-copy identifier.
    const stamped = $.NSPasteboardItem.alloc.init
    for (const type of item.types.js) {
      const data = item.dataForType(type)
      if (!data.isNil()) stamped.setDataForType(data, type)
    }
    stamped.setStringForType(nonce, ownerType)
    if (String(board.changeCount) !== observed) return
    board.clearContents
    if (!board.writeObjects($.NSArray.arrayWithObject(stamped))) return
    return String(board.changeCount)
  }
  if (item.stringForType(ownerType).js !== nonce || String(board.changeCount) !== observed) return
  if (action === 'settle') {
    const restoredByRaycast = item.types.containsObject('com.raycast.RestoredType')
    if (observed === generation || restoredByRaycast) return observed
  }
  if (action === 'expire') board.clearContents
}
