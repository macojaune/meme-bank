type FileClipboard = {
  copy: (content: { file: string }) => Promise<void>
  paste: (content: { file: string }) => Promise<void>
}

// Copy first so a composer that ignores the paste leaves a usable file on ⌘V.
export async function transferAttachment(
  file: string,
  clipboard: FileClipboard,
  paste: boolean,
  onCopied: () => Promise<void>
): Promise<'copied' | 'paste-requested' | 'manual-paste'> {
  const content = { file }
  await clipboard.copy(content)
  await onCopied()
  if (!paste) return 'copied'
  try {
    await clipboard.paste(content)
    return 'paste-requested'
  } catch {
    return 'manual-paste'
  }
}
