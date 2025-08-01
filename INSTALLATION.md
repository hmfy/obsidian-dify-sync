# Dify Sync Plugin - Installation Guide

## Prerequisites

- Obsidian installed
- Local Dify deployment running
- Dify API key and knowledge base ID

## Installation Steps

### 1. Build the Plugin

```bash
npm install
npm run build
```

This will create a `main.js` file in the root directory.

### 2. Install in Obsidian

1. Navigate to your Obsidian vault folder
2. Go to `.obsidian/plugins/` directory
3. Create a new folder called `dify-sync-plugin`
4. Copy these files into the `dify-sync-plugin` folder:
   - `main.js` (generated by build)
   - `manifest.json`
   - `styles.css`

### 3. Enable the Plugin

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Turn off "Safe mode" if it's enabled
4. Find "Dify Sync Plugin" in the installed plugins list
5. Toggle it on

### 4. Configure the Plugin

1. Go to Settings → Dify Sync Plugin
2. Fill in the required settings:
   - **Dify API Key**: Your API key from Dify
   - **Dify Knowledge Base ID**: The ID of your target knowledge base
   - **Dify API URL**: Your local Dify URL (e.g., `http://localhost:5000`)

### 5. Optional Configuration

- **Obsidian Folder Path**: Specify a folder to sync (leave empty for all notes)
- **Enable Auto Sync**: Turn on automatic syncing
- **Sync Interval**: Set how often to auto-sync (5-120 minutes)

## Usage

### Manual Sync
- Click the sync icon (⟲) in the left ribbon
- Use Command Palette (Ctrl+P): "Sync to Dify Knowledge Base"
- Click "Sync Now" in plugin settings

### Auto Sync
1. Enable "Auto Sync" in settings
2. Set your preferred interval
3. Plugin will sync automatically

### Monitor Status
- Check the status bar at the bottom for sync status
- Green text = success, Red text = error
- Shows last sync time

## Troubleshooting

### Build Issues
- Make sure Node.js is installed
- Run `npm install` first
- Check for any error messages during build

### Sync Issues
- Verify Dify is running and accessible
- Check API key permissions
- Ensure knowledge base ID is correct
- Look at browser console for detailed errors

### Plugin Not Appearing
- Make sure all files are in the correct folder
- Restart Obsidian
- Check that Safe mode is disabled

## File Structure After Installation

```
your-vault/
└── .obsidian/
    └── plugins/
        └── dify-sync-plugin/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

## Getting Dify API Information

1. **API Key**: Go to Dify Settings → API Keys → Create new key
2. **Knowledge Base ID**: Go to your knowledge base → Settings → copy the ID from URL
3. **API URL**: Your Dify deployment URL (default: `http://localhost:5000`)

## Features

✅ Manual sync with ribbon button  
✅ Automatic scheduled sync  
✅ Smart content hashing (only sync changed files)  
✅ Visual status feedback  
✅ Folder filtering  
✅ Error handling and notifications  

The plugin is now ready to use! Your Obsidian notes will be automatically synced to your Dify knowledge base.