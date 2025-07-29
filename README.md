# Dify Sync Plugin for Obsidian

A plugin that automatically syncs your Obsidian notes to a Dify knowledge base with intelligent content hashing to avoid unnecessary uploads.

## Features

- **Manual Sync**: Click the sync button in the ribbon or use the command palette
- **Auto Sync**: Set up automatic syncing at regular intervals (5-120 minutes)
- **Smart Content Detection**: Only syncs files that have been modified using content hash comparison
- **Visual Feedback**: Status bar shows sync status and last sync time
- **Folder Filtering**: Option to sync only specific folders
- **Error Handling**: Clear error messages and status indicators

## Installation

1. Copy the plugin files to your Obsidian vault's plugins folder:
   ```
   .obsidian/plugins/dify-sync-plugin/
   ```

2. The plugin folder should contain:
   - `main.js` (compiled from main.ts)
   - `manifest.json`
   - `styles.css`

3. Enable the plugin in Obsidian Settings > Community Plugins

## Configuration

Go to Settings > Dify Sync Plugin and configure:

### Required Settings
- **Dify API Key**: Your Dify API key for authentication
- **Dify Knowledge Base ID**: The ID of your target knowledge base
- **Dify API URL**: Your local Dify deployment URL (e.g., `http://localhost:5000`)

### Optional Settings
- **Obsidian Folder Path**: Specific folder to sync (leave empty to sync all notes)
- **Enable Auto Sync**: Toggle automatic syncing
- **Sync Interval**: How often to auto-sync (5-120 minutes)

## Usage

### Manual Sync
- Click the sync icon in the left ribbon
- Use Command Palette: "Sync to Dify Knowledge Base"
- Click "Sync Now" button in settings

### Auto Sync
1. Enable "Auto Sync" in settings
2. Set your preferred sync interval
3. The plugin will automatically sync at the specified intervals

### Status Monitoring
- Check the status bar (bottom right) for sync status
- Green text indicates successful sync
- Red text indicates errors
- Timestamp shows when the last sync occurred

## How It Works

1. **Content Hashing**: The plugin creates a hash of each file's content
2. **Change Detection**: Only files with changed content or modification time are synced
3. **API Integration**: Files are uploaded to Dify using the `/v1/datasets/{id}/document/create_by_text` endpoint
4. **Automatic Vectorization**: Dify automatically processes and vectorizes the uploaded content

## Troubleshooting

### Common Issues

**"Cannot find module 'obsidian'" error**
- Make sure you're building the plugin correctly with the provided build tools
- Run `npm run build` to compile the TypeScript

**Sync fails with HTTP errors**
- Verify your Dify API URL is correct and accessible
- Check that your API key has the necessary permissions
- Ensure your knowledge base ID is valid

**Files not syncing**
- Check if you have folder filtering enabled
- Verify the files are markdown (.md) files
- Look at the console for detailed error messages

### Debug Mode
Enable the Developer Console (Ctrl+Shift+I) to see detailed sync logs and error messages.

## Development

### Building the Plugin

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build for development:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

### File Structure
```
dify-sync-plugin/
├── main.ts          # Main plugin code
├── manifest.json    # Plugin manifest
├── package.json     # Node.js dependencies
├── tsconfig.json    # TypeScript configuration
├── styles.css       # Plugin styles
├── esbuild.config.mjs # Build configuration
└── README.md        # This file
```

## API Compatibility

This plugin is designed to work with Dify's API v1. Make sure your Dify deployment supports:
- `/v1/datasets/{dataset_id}/document/create_by_text` endpoint
- Bearer token authentication
- High-quality indexing technique

## License

MIT License - feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please check the console logs first and provide detailed error messages when reporting problems.