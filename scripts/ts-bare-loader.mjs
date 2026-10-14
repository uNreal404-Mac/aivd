/** Resolve extensionless relative imports to `.ts` (Pages Functions style). */
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await nextResolve(specifier + ".ts", context);
    } catch {
      return nextResolve(specifier + ".js", context);
    }
  }
  return nextResolve(specifier, context);
}
