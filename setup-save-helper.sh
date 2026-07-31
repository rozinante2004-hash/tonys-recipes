#!/bin/bash
# Tony's Recipes — Save Helper Setup
# Run once to install, configure autostart, and start.
# Safe to re-run anytime to restart or update.

HELPER_PATH="$HOME/local-save-helper.py"
DESKTOP_PATH="$HOME/.config/autostart/tonys-recipes-helper.desktop"
PORT=27182

echo ""
echo "🍴 Tony's Recipes — Save Helper Setup"
echo "======================================"
echo ""

# Step 1: Write helper script
echo "📝 Writing helper to $HELPER_PATH ..."
curl -fsSL "https://rozinante2004-hash.github.io/tonys-recipes/local-save-helper.py" \
  -o "$HELPER_PATH" 2>/dev/null || \
cp ~/Downloads/local-save-helper.py "$HELPER_PATH" 2>/dev/null || \
echo "   ⚠️  Could not download — using existing file if present"

if [ ! -f "$HELPER_PATH" ]; then
    echo "   ❌ $HELPER_PATH not found. Please download it from the app repo first."
    exit 1
fi
echo "   ✓ Helper script ready"

# Step 2: Kill existing instances
echo ""
echo "🔍 Killing any existing instances ..."
pkill -f "local-save-helper.py" 2>/dev/null && echo "   ✓ Killed existing process(es)" || echo "   ✓ No existing processes"
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null || true
    echo "   ✓ Freed port $PORT"
fi
sleep 1

# Step 3: Configure autostart
echo ""
echo "🚀 Configuring autostart ..."
mkdir -p "$HOME/.config/autostart"
cat > "$DESKTOP_PATH" << ENDOFDESKTOP
[Desktop Entry]
Type=Application
Name=Tony's Recipes Save Helper
Comment=Saves recipe exports with correct Hebrew/Russian filenames
Exec=python3 $HELPER_PATH
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
ENDOFDESKTOP
echo "   ✓ Autostart configured"

# Step 4: Start now
echo ""
echo "▶  Starting helper ..."
python3 "$HELPER_PATH" &
HELPER_PID=$!
sleep 1

if kill -0 $HELPER_PID 2>/dev/null; then
    echo "   ✓ Running (PID $HELPER_PID)"
else
    echo "   ❌ Failed to start"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Done! The ⚙️ dot in Tony's Recipes should turn GREEN."
echo ""
echo "   Save location: ~/Documents/Projects/Recipes App (change in ⚙️ → 💾 Save Helper)"
echo "   To stop:       pkill -f local-save-helper.py"
echo "   To restart:    bash ~/Downloads/setup-save-helper.sh"
echo ""
