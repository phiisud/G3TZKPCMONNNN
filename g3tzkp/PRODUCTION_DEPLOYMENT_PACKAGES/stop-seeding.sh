#!/bin/bash
# Stop G3ZKP P2P Seeding

echo "🛑 Stopping G3ZKP P2P seeding..."

# Kill all seeding processes
if [ -d "seeds" ]; then
    killed_count=0
    for pid_file in seeds/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if [ "$pid" != "simulated_pid_"* ]; then
                kill "$pid" 2>/dev/null && echo "✅ Stopped seeding process $pid" && killed_count=$((killed_count + 1))
            else
                echo "📊 Removed simulated seeding process $pid"
                killed_count=$((killed_count + 1))
            fi
            rm "$pid_file"
        fi
    done

    if [ $killed_count -gt 0 ]; then
        echo "✅ Stopped $killed_count seeding processes"
    else
        echo "ℹ️ No active seeding processes found"
    fi
else
    echo "ℹ️ Seeds directory not found"
fi

# Kill any remaining webtorrent processes
pkill -f webtorrent 2>/dev/null && echo "🧹 Cleaned up remaining webtorrent processes"

echo "✅ Seeding stopped successfully"