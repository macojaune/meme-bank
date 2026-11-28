type FileClipboard = {
  copy: (content: { file: string }, options: { concealed: boolean }) => Promise<void>
  paste: (content: { file: string }) => Promise<void>
}

// Copy first so a composer that ignores the paste leaves a usable file on ⌘V.
export async function transferAttachment(
  file: string,
  clipboard: FileClipboard,
  paste: boolean,
  onCopied: () => Promise<void>,
  scheduleExpiry: (file: string) => Promise<void> = async () => {}
): Promise<'copied' | 'paste-requested' | 'manual-paste'> {
  const content = { file }
  await clipboard.copy(content, { concealed: true })
  await onCopied()
  // Clipboard.paste can close the extension before its promise resumes.
  await scheduleExpiry(file)
  if (!paste) return 'copied'
  try {
    await clipboard.paste(content)
    return 'paste-requested'
  } catch {
    return 'manual-paste'
  }
}
