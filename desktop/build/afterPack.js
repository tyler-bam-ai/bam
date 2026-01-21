/**
 * afterPack hook to install backend dependencies
 * This runs after the app is packaged but before it's signed
 * 
 * No electron-rebuild needed since we use sql.js (pure JavaScript, no native modules)
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
    const appOutDir = context.appOutDir;
    const platform = context.packager.platform.name;

    console.log('[afterPack] Platform:', platform);

    // Determine resources path based on platform
    let backendPath;
    if (platform === 'mac') {
        backendPath = path.join(appOutDir, 'BAM-AI.app', 'Contents', 'Resources', 'backend');
    } else {
        // Windows/Linux
        backendPath = path.join(appOutDir, 'resources', 'backend');
    }

    console.log('[afterPack] Backend path:', backendPath);

    if (!fs.existsSync(backendPath)) {
        console.log('[afterPack] Backend path not found, trying alternative...');
        const altPath = path.join(appOutDir, 'BAM-AI.app', 'Contents', 'Resources', 'backend');
        if (fs.existsSync(altPath)) {
            backendPath = altPath;
        }
    }

    if (fs.existsSync(backendPath)) {
        console.log('[afterPack] Installing backend dependencies in:', backendPath);
        try {
            execSync('npm install --production', {
                cwd: backendPath,
                stdio: 'inherit'
            });
            console.log('[afterPack] Backend dependencies installed successfully');
            // No electron-rebuild needed - sql.js is pure JavaScript!
        } catch (err) {
            console.error('[afterPack] Failed to install backend dependencies:', err.message);
        }
    } else {
        console.log('[afterPack] Backend path not found:', backendPath);
    }
};
