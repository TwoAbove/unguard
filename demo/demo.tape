# Renders demo.gif. Requires vhs (brew install vhs), bat, and the Berkeley Mono font.
# Run from the repo root: npm run demo (or: vhs demo/demo.tape)
#
# Rendered at 2x (FontSize/Width/Height doubled) so the GIF downscales smooth
# in the README instead of showing quantized 1x text.
# Theme is seva.dev's palette: ink/paper plus the spark/signal/danger accents.

Output demo/demo.gif

Set Shell bash
Set FontFamily "Berkeley Mono"
Set FontSize 30
# Twitter rejects GIFs over 2048px in either dimension; stay under it.
Set Width 2000
Set Height 1960
Set Padding 48
Set Theme { "background": "#161618", "foreground": "#d4d4d3", "cursor": "#e89960", "selection": "#363638", "black": "#161618", "red": "#ff5f5b", "green": "#6fb07d", "yellow": "#e89960", "blue": "#6da3da", "magenta": "#ba8ac5", "cyan": "#5daeae", "white": "#d4d4d3", "brightBlack": "#6d6d6f", "brightRed": "#ff6b66", "brightGreen": "#79c289", "brightYellow": "#fea668", "brightBlue": "#76b3f1", "brightMagenta": "#cd97d9", "brightCyan": "#61c0bf", "brightWhite": "#e5e4e4" }

Hide
Type@1ms `rm -rf /tmp/unguard-demo && mkdir -p /tmp/unguard-demo && cp demo/job.ts demo/tsconfig.json /tmp/unguard-demo/ && cd /tmp/unguard-demo`
Enter
Type@1ms `npx() { shift; node "$OLDPWD/bin/unguard.mjs" "$@"; }; bat() { command bat --theme=ansi "$@"; }; export PS1='\[\e[2m\]demo\[\e[0m\] ❯ '`
Enter
Type@1ms "clear"
Enter
Show

Sleep 600ms
Type@110ms "ba"
Type@60ms "t "
Sleep 150ms
Type@90ms "jo"
Type@55ms "b."
Type@130ms "ts"
Sleep 350ms
Enter
Sleep 5s

Type@95ms "np"
Type@60ms "x "
Sleep 250ms
Type@120ms "ung"
Type@70ms "ua"
Type@100ms "rd"
Sleep 400ms
Enter
Sleep 10s
