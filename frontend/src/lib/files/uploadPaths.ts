/**
 * The destination path an upload writes to, relative to the batch destination directory.
 *
 * Browsers only populate `webkitRelativePath` for directory picks, and it is the single source of
 * truth for where a file lands. It is a read-only accessor on `File`, so {@link withUploadPath} has
 * to redefine it rather than assign to it.
 */
export const uploadPathOf = (file: File) => file.webkitRelativePath || file.name;

export const withUploadPath = (file: File, path: string) => {
  Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: path });
  return file;
};
