/**
 * Host half of the theme-studio bundle.
 *
 * The bundle exists for its Client module: the wallpaper, the header title and
 * icon, the sidebar entry, and the panel are all browser presentation, so the
 * Host row has nothing to register. It stays because a bundle's patch inserts a
 * Loader entry, and that entry needs a Host plugin to load.
 */
export function apply() {}
